/**
 * Shopper Status Service
 * File: src/services/shopperStatusService.ts
 *
 * PURPOSE: Handles shopper status operations with Appwrite
 *
 * RESPONSIBILITIES:
 * - Fetch shopper status from database
 * - Update shopper availability
 * - Clear current order when task completes
 * - Manual order claim/swap (a shopper's own explicit choice, not
 *   auto-assignment - see below)
 *
 * WHERE DID AUTO-ASSIGNMENT GO?
 * This file used to also decide *which* shopper an order went to -
 * finding the next idle shopper, finding the next pending order,
 * interrupting a busy shopper for a rush order, and re-checking a
 * released order's urgency. All of that moved server-side into
 * `functions/auto-assignment/`, an Appwrite Function triggered directly
 * by database events (a new order, a released order, a shopper
 * becoming available) rather than by any client's own code path. See
 * docs/DECISIONS.md's two "Auto-assignment" entries for the full
 * reasoning (a permission-model gap and a race-condition risk, both
 * inherent to deciding assignment from inside a customer's or shopper's
 * own app) and what was verified live.
 *
 * WHAT STAYS HERE, AND WHY:
 * `updateShopperAvailability` still writes `isAvailable` directly - a
 * shopper toggling their own status is their own action, not an
 * assignment decision - and now does *only* that; the Function reacts
 * to the resulting `shopperStatus` update event to handle whatever
 * follows (auto-assign if now idle, release-and-requeue if now
 * unavailable mid-order). `swapCurrentOrder` (a shopper manually
 * claiming a specific order from the available-tasks list) also stays
 * client-side - it's an explicit human choice, not the automated
 * "system decides" flow, and was deliberately left out of the
 * server-side migration for that reason (see the "Consequences / left
 * open" note on the Function entry in docs/DECISIONS.md about why full
 * write-path lockdown wasn't taken on here).
 */

import { Query } from 'appwrite';
import { databases, config } from './appwrite';
import {
  assignOrderToShopper as assignOrderInOrderService,
  unassignOrder as unassignOrderInOrderService,
  startShopping as startShoppingInOrderService,
} from './orderService';
import type {
  ShopperStatus,
  ShopperStatusResponse,
  UpdateShopperStatusData,
} from '../types';

// ============================================================
// SHOPPER STATUS FETCHING
// ============================================================

/**
 * Get shopper status by shopper ID
 *
 * WHY QUERY BY shopperId?
 * - The document $id is not the same as shopperId
 * - Need to find the status document for a specific shopper
 *
 * @param shopperId - The shopper's user ID
 * @returns ShopperStatusResponse with status or error
 */
export const getShopperStatus = async (
  shopperId: string
): Promise<ShopperStatusResponse> => {
  try {
    const response = await databases.listDocuments<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      [Query.equal('shopperID', shopperId), Query.limit(1)]
    );

    if (response.documents.length === 0) {
      return {
        success: false,
        data: null,
        error: 'Shopper status not found',
      };
    }

    return {
      success: true,
      data: response.documents[0] ?? null,
    };
  } catch (error) {
    console.error('Error fetching shopper status:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch shopper status';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// AVAILABILITY MANAGEMENT
// ============================================================

/**
 * Update a shopper's availability.
 *
 * WHY DOES THIS NO LONGER TRIGGER ASSIGNMENT ITSELF?
 * It used to also auto-assign the next pending order when becoming
 * available, and release+requeue the current order when becoming
 * unavailable mid-task - both moved into the auto-assignment Appwrite
 * Function, which reacts to the `shopperStatus` update event this
 * write produces. This function's only remaining job is the write
 * itself; the Function decides what (if anything) happens next.
 *
 * WHY NOT ALSO CLEAR/RELEASE currentOrderId HERE ANYMORE?
 * The Function's `handleShopperWentUnavailable` handler needs to see
 * the *pre-release* `currentOrderId` in the event payload to know which
 * order to release - if this function cleared it in the same write
 * (like the old client-side version did), the Function would have
 * nothing to go on. It clears `currentOrderId` itself once it's done
 * releasing the order.
 *
 * @param shopperId - The shopper's user ID
 * @param isAvailable - New availability status
 * @returns Object with updated status (no assignedOrder anymore - that
 *   outcome is no longer synchronous with this call; the shopper's own
 *   subsequent status fetch/subscription will reflect it once the
 *   Function has run)
 */
export const updateShopperAvailability = async (
  shopperId: string,
  isAvailable: boolean
): Promise<{
  success: boolean;
  status: ShopperStatus | null;
  error?: string;
}> => {
  try {
    const statusResult = await getShopperStatus(shopperId);
    if (!statusResult.success || !statusResult.data) {
      return {
        success: false,
        status: null,
        error: statusResult.error ?? 'Shopper status not found',
      };
    }

    const updateData: UpdateShopperStatusData = {
      isAvailable,
      lastActiveTimeStamp: new Date().toISOString(),
    };

    const updatedStatus = await databases.updateDocument<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      statusResult.data.$id,
      updateData
    );

    return {
      success: true,
      status: updatedStatus,
    };
  } catch (error) {
    console.error('Error updating shopper availability:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update availability';

    return {
      success: false,
      status: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// ORDER ASSIGNMENT (manual claim only - see file header)
// ============================================================

/**
 * Assign an order to a shopper (update ShopperStatus.currentOrderId)
 *
 * WHY SEPARATE FROM ORDER ASSIGNMENT?
 * - ShopperStatus tracks which order a shopper is working on
 * - Order tracks which shopper is assigned to it
 * - Both need to be updated, but this function handles shopper side
 *
 * WHO CALLS THIS NOW?
 * Only `TaskDetailScreen`'s manual-claim path (a shopper explicitly
 * picking an unclaimed order from the available-tasks list) - every
 * automatic-assignment caller this used to have moved to the
 * server-side Function (see file header).
 *
 * @param shopperId - The shopper's user ID
 * @param orderId - The order ID to assign
 * @returns ShopperStatusResponse with updated status
 */
export const assignOrderToShopper = async (
  shopperId: string,
  orderId: string
): Promise<ShopperStatusResponse> => {
  try {
    const statusResult = await getShopperStatus(shopperId);
    if (!statusResult.success || !statusResult.data) {
      return {
        success: false,
        data: null,
        error: statusResult.error ?? 'Shopper status not found',
      };
    }

    const updatedStatus = await databases.updateDocument<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      statusResult.data.$id,
      {
        currentOrderId: orderId,
        lastActiveTimeStamp: new Date().toISOString(),
      }
    );

    return {
      success: true,
      data: updatedStatus,
    };
  } catch (error) {
    console.error('Error assigning order to shopper:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to assign order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Clear current order from shopper (when task completes)
 *
 * WHY CLEAR ORDER?
 * - When a shopper completes an order, they should be free for new tasks
 * - Clearing currentOrderId puts them back in the "available + idle"
 *   state the auto-assignment Function's `handleShopperBecameAvailable`
 *   reacts to - if a pending order exists, the Function hands them one
 *   automatically off the back of this write; this function no longer
 *   needs to (and doesn't) trigger that itself.
 *
 * @param shopperId - The shopper's user ID
 * @returns ShopperStatusResponse with updated status
 */
export const clearCurrentOrder = async (
  shopperId: string
): Promise<ShopperStatusResponse> => {
  try {
    const statusResult = await getShopperStatus(shopperId);
    if (!statusResult.success || !statusResult.data) {
      return {
        success: false,
        data: null,
        error: statusResult.error ?? 'Shopper status not found',
      };
    }

    const updatedStatus = await databases.updateDocument<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      statusResult.data.$id,
      {
        currentOrderId: '',
        lastActiveTimeStamp: new Date().toISOString(),
      }
    );

    return {
      success: true,
      data: updatedStatus,
    };
  } catch (error) {
    console.error('Error clearing current order:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to clear order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// SWAP CURRENT ORDER (manual claim/swap - see file header)
// ============================================================

/**
 * Swap a shopper off their current order and onto a different pending
 * one they picked from the available-tasks list, releasing the previous
 * order back to the queue.
 *
 * WHY CLAIM THE NEW ORDER BEFORE RELEASING THE OLD ONE?
 * - If claiming the new order fails partway, the shopper still has
 *   their original order intact - nothing is lost. Releasing first
 *   would risk leaving the shopper with neither order if the new claim
 *   then failed.
 *
 * WHY NO EXPLICIT RE-CHECK ON THE RELEASED ORDER ANYMORE?
 * - Releasing it (via unassignOrder) puts it back into the
 *   pending+unassigned state, which the auto-assignment Function's
 *   `handleOrderReleased` reacts to automatically (hands it to an idle
 *   shopper if it's still the single most urgent pending order) - this
 *   function used to do that check itself (`reassignIfMostUrgent`)
 *   before the Function existed; now the same database write triggers
 *   the same outcome without this function needing to ask for it.
 *
 * WHY NOT TOUCH pickedItems/itemIssues ON THE RELEASED ORDER?
 * - unassignOrder() (like the unavailable-mid-order path) leaves any
 *   shopping progress on the order as-is - whoever picks it up next
 *   sees what was already found/substituted rather than starting over.
 *
 * @param shopperId - The shopper making the swap
 * @param previousOrderId - The order to release back to the queue
 * @param newOrderId - The order to claim and start instead
 * @returns Success/error result
 */
export const swapCurrentOrder = async (
  shopperId: string,
  previousOrderId: string,
  newOrderId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const statusResult = await getShopperStatus(shopperId);
    if (!statusResult.success || !statusResult.data) {
      return { success: false, error: statusResult.error ?? 'Shopper status not found' };
    }

    const assignResult = await assignOrderInOrderService(newOrderId, shopperId, false);
    if (!assignResult.success) {
      return { success: false, error: assignResult.error ?? 'Failed to claim new order' };
    }

    const startResult = await startShoppingInOrderService(newOrderId);
    if (!startResult.success) {
      return { success: false, error: startResult.error ?? 'Failed to start shopping' };
    }

    await unassignOrderInOrderService(previousOrderId);

    await databases.updateDocument<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      statusResult.data.$id,
      {
        currentOrderId: newOrderId,
        lastActiveTimeStamp: new Date().toISOString(),
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Error swapping current order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to swap order';
    return { success: false, error: errorMessage };
  }
};
