/**
 * Shopper Status Service
 * File: src/services/shopperStatusService.ts
 *
 * PURPOSE: Handles shopper status operations with Appwrite
 *
 * RESPONSIBILITIES:
 * - Fetch shopper status from database
 * - Update shopper availability
 * - Assign orders to shoppers
 * - Clear current order when task completes
 *
 * KEY INTEGRATION:
 * - Works with orderService for auto-assignment when shopper becomes available
 * - ShopperStatus collection tracks real-time availability
 */

import { Query } from 'appwrite';
import { databases, config } from './appwrite';
import {
  getNextOrderForAssignment,
  assignOrderToShopper as assignOrderInOrderService,
  unassignOrder as unassignOrderInOrderService,
} from './orderService';
import type {
  ShopperStatus,
  ShopperStatusResponse,
  UpdateShopperStatusData,
  Order,
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

/**
 * Find the next idle, available shopper to hand an order to
 *
 * WHY isAvailable + empty currentOrderId?
 * - isAvailable alone isn't enough - a shopper can be available but already
 *   mid-task (currentOrderId set) if they haven't finished their current order
 * - Only truly idle shoppers should receive an immediate hand-off
 *
 * WHY orderAsc(lastActiveTimeStamp)?
 * - Prefer the shopper who's been idle longest (fairest distribution)
 *
 * @param excludeShopperId - Shopper to exclude (e.g. the one just going unavailable)
 * @returns ShopperStatusResponse with the next idle shopper or null if none
 */
export const getNextAvailableShopper = async (
  excludeShopperId?: string
): Promise<ShopperStatusResponse> => {
  try {
    const queries = [
      Query.equal('isAvailable', true),
      Query.equal('currentOrderId', ''),
      Query.orderAsc('lastActiveTimeStamp'),
      Query.limit(1),
    ];
    if (excludeShopperId) {
      queries.push(Query.notEqual('shopperID', excludeShopperId));
    }

    const response = await databases.listDocuments<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      queries
    );

    return {
      success: true,
      data: response.documents[0] ?? null,
    };
  } catch (error) {
    console.error('Error finding next available shopper:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to find next available shopper';

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
 * If `orderId` is now the most urgent order in the pending queue (closest
 * scheduledReadyTime), hand it straight to the next idle available shopper
 * instead of leaving it to sit until someone next toggles available.
 *
 * WHY CHECK "MOST URGENT" FIRST?
 * - Only the single most urgent pending order gets this immediate hand-off
 * - Less urgent orders just wait in the queue for the normal
 *   become-available flow, same as any other pending order
 *
 * @param orderId - The order that was just unassigned
 * @param excludeShopperId - The shopper who just went unavailable (don't reassign to them)
 */
const reassignIfMostUrgent = async (
  orderId: string,
  excludeShopperId: string
): Promise<void> => {
  const nextResult = await getNextOrderForAssignment();
  if (!nextResult.success || nextResult.data?.$id !== orderId) {
    // Some other pending order is more urgent (or the order is gone) - leave it queued
    return;
  }

  const shopperResult = await getNextAvailableShopper(excludeShopperId);
  if (!shopperResult.success || !shopperResult.data) {
    // No other shopper free right now - it stays at the front of the queue
    return;
  }

  const nextShopper = shopperResult.data;
  const assignResult = await assignOrderInOrderService(orderId, nextShopper.shopperID);
  if (assignResult.success) {
    await databases.updateDocument<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      nextShopper.$id,
      {
        currentOrderId: orderId,
        lastActiveTimeStamp: new Date().toISOString(),
      }
    );
  }
};

/**
 * Update shopper availability and optionally trigger auto-assignment
 *
 * FLOW:
 * 1. Fetch current shopper status to get document $id
 * 2. Update isAvailable field
 * 3. If becoming available AND not already working an order, check for pending
 *    orders and assign one to this shopper
 * 4. If becoming unavailable while working an order, release that order back to
 *    the queue, then immediately hand it to another idle shopper if it's now
 *    the most urgent order pending
 * 5. Return updated status and any assigned order
 *
 * @param shopperId - The shopper's user ID
 * @param isAvailable - New availability status
 * @returns Object with updated status and optionally assigned order
 */
export const updateShopperAvailability = async (
  shopperId: string,
  isAvailable: boolean
): Promise<{
  success: boolean;
  status: ShopperStatus | null;
  assignedOrder: Order | null;
  error?: string;
}> => {
  try {
    // First, get the current status document
    const statusResult = await getShopperStatus(shopperId);
    if (!statusResult.success || !statusResult.data) {
      return {
        success: false,
        status: null,
        assignedOrder: null,
        error: statusResult.error ?? 'Shopper status not found',
      };
    }

    const statusDocId = statusResult.data.$id;
    const previousOrderId = statusResult.data.currentOrderId;
    let assignedOrder: Order | null = null;

    // Update the availability
    const updateData: UpdateShopperStatusData = {
      isAvailable,
      lastActiveTimeStamp: new Date().toISOString(),
    };

    if (isAvailable && !previousOrderId) {
      // Becoming available with no order already in flight - auto-assign the next pending one.
      // WHY GUARD ON !previousOrderId?
      // - A shopper can already have a currentOrderId while isAvailable is false
      //   (e.g. they went on break mid-task under the old buggy flow, or a status
      //   flip happened out of band). Auto-assigning on top of that orphans a
      //   second order under the same shopperID, which no one is ever asked to
      //   release since it's not tracked by currentOrderId.
      // - If a current order is already set, we leave it alone here - the dashboard
      //   will show it as the current task same as if the shopper never left.
      const orderResult = await getNextOrderForAssignment();
      if (orderResult.success && orderResult.data) {
        const order = orderResult.data;

        const assignResult = await assignOrderInOrderService(order.$id, shopperId);
        if (assignResult.success && assignResult.data) {
          assignedOrder = assignResult.data;
          updateData.currentOrderId = order.$id;
        }
      }
    } else if (previousOrderId && !isAvailable) {
      // Becoming unavailable while working an order - release it back to the queue
      await unassignOrderInOrderService(previousOrderId);
      updateData.currentOrderId = '';

      // If that order is now the most urgent one pending, hand it to the next
      // idle shopper right away instead of letting it sit
      await reassignIfMostUrgent(previousOrderId, shopperId);
    }

    // Perform the status update
    const updatedStatus = await databases.updateDocument<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      statusDocId,
      updateData
    );

    return {
      success: true,
      status: updatedStatus,
      assignedOrder,
    };
  } catch (error) {
    console.error('Error updating shopper availability:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update availability';

    return {
      success: false,
      status: null,
      assignedOrder: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// ORDER ASSIGNMENT
// ============================================================

/**
 * Assign an order to a shopper (update ShopperStatus.currentOrderId)
 *
 * WHY SEPARATE FROM ORDER ASSIGNMENT?
 * - ShopperStatus tracks which order a shopper is working on
 * - Order tracks which shopper is assigned to it
 * - Both need to be updated, but this function handles shopper side
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
 * - Clearing currentOrderId allows auto-assignment to work again
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
