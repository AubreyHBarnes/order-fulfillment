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
  interruptOrder as interruptOrderInOrderService,
  startShopping as startShoppingInOrderService,
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

/**
 * Find a busy shopper (available, already working an order) whose current
 * order is the safest to interrupt - the one with the furthest-out
 * scheduledReadyTime among all busy shoppers, i.e. the least time-urgent
 * order in progress right now.
 *
 * WHY scheduledReadyTime AS THE HEURISTIC, NOT SHOPPING PROGRESS?
 * - It's the same signal getNextOrderForAssignment/reassignIfMostUrgent
 *   already sort by everywhere else in this file - reusing it keeps the
 *   interrupt decision consistent with the rest of the assignment logic
 *   instead of introducing a second, more complex signal (e.g. picked
 *   item count vs. total) for this first version.
 *
 * @param excludeShopperId - Shopper to exclude, if any
 * @returns The shopper to interrupt and their current order, or nulls if no busy shopper exists
 */
export const getInterruptCandidateShopper = async (
  excludeShopperId?: string
): Promise<{
  success: boolean;
  shopper: ShopperStatus | null;
  order: Order | null;
  error?: string;
}> => {
  try {
    const queries = [
      Query.equal('isAvailable', true),
      Query.notEqual('currentOrderId', ''),
      Query.limit(50),
    ];
    if (excludeShopperId) {
      queries.push(Query.notEqual('shopperID', excludeShopperId));
    }

    const shoppersResponse = await databases.listDocuments<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      queries
    );

    if (shoppersResponse.documents.length === 0) {
      return { success: true, shopper: null, order: null };
    }

    const orderIds = shoppersResponse.documents.map((s) => s.currentOrderId);
    const ordersResponse = await databases.listDocuments<Order>(
      config.databaseId,
      config.ordersCollectionId,
      [Query.equal('$id', orderIds), Query.limit(orderIds.length)]
    );

    if (ordersResponse.documents.length === 0) {
      return { success: true, shopper: null, order: null };
    }

    // Least urgent = furthest-out scheduledReadyTime, the safest to bump
    const leastUrgentOrder = ordersResponse.documents.reduce((latest, candidate) =>
      candidate.scheduledReadyTime > latest.scheduledReadyTime ? candidate : latest
    );

    const shopper = shoppersResponse.documents.find(
      (s) => s.currentOrderId === leastUrgentOrder.$id
    );
    if (!shopper) {
      return { success: true, shopper: null, order: null };
    }

    return { success: true, shopper, order: leastUrgentOrder };
  } catch (error) {
    console.error('Error finding interrupt candidate shopper:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to find interrupt candidate';

    return { success: false, shopper: null, order: null, error: errorMessage };
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
export const reassignIfMostUrgent = async (
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
 * Try to hand the next pending order to an idle shopper who just became
 * free (going Available with no current order, or just completed one).
 *
 * WHY A SHARED HELPER?
 * - Both updateShopperAvailability's "becoming available" branch and
 *   OrderCompletionScreen's post-completion flow need the exact same
 *   "find the next pending order, assign it, stamp currentOrderId"
 *   sequence - this was inline in updateShopperAvailability only,
 *   duplicating it for completion would be two copies of one thing.
 *
 * @param shopperId - The now-free shopper's user ID
 * @returns The newly assigned order, or null if none was available
 */
export const autoAssignNextOrderTo = async (shopperId: string): Promise<Order | null> => {
  const statusResult = await getShopperStatus(shopperId);
  if (!statusResult.success || !statusResult.data) {
    return null;
  }

  const orderResult = await getNextOrderForAssignment();
  if (!orderResult.success || !orderResult.data) {
    return null;
  }

  const order = orderResult.data;
  const assignResult = await assignOrderInOrderService(order.$id, shopperId);
  if (!assignResult.success || !assignResult.data) {
    return null;
  }

  await databases.updateDocument<ShopperStatus>(
    config.databaseId,
    config.shopperStatusCollectionId,
    statusResult.data.$id,
    {
      currentOrderId: order.$id,
      lastActiveTimeStamp: new Date().toISOString(),
    }
  );

  return assignResult.data;
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
      // WHY NOT ALSO SET updateData.currentOrderId HERE?
      // autoAssignNextOrderTo already persisted ShopperStatus.currentOrderId
      // (and lastActiveTimeStamp) itself via its own updateDocument call -
      // the updateDocument below only patches the fields listed in
      // updateData (isAvailable, lastActiveTimeStamp), so it won't
      // clobber what autoAssignNextOrderTo just wrote
      const nextOrder = await autoAssignNextOrderTo(shopperId);
      if (nextOrder) {
        assignedOrder = nextOrder;
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

// ============================================================
// RUSH ORDER PLACEMENT
// ============================================================

/**
 * Handle a newly placed rush order: try to get it to a shopper right
 * away instead of leaving it to sit in the pending queue until someone's
 * availability happens to change.
 *
 * WHY SCOPED TO RUSH ORDERS ONLY (caller only invokes this for priority === 1)?
 * - Normal orders keep their existing behavior - assigned only when a
 *   shopper toggles Available via updateShopperAvailability. Proactively
 *   pushing every new order to an idle shopper the instant it's placed
 *   would be a broader behavior change than what was asked for here.
 *
 * ORDER OF PREFERENCE:
 * 1. A truly idle shopper - same hand-off used by the become-available
 *    and reassignIfMostUrgent paths, no interruption needed.
 * 2. If everyone's busy, interrupt the least-urgent in-progress order
 *    (via getInterruptCandidateShopper) and hand that shopper the rush
 *    order instead. The bumped order goes back to the normal pending
 *    queue - no special handling needed there, it's picked up the same
 *    way any other pending order is.
 * 3. If there are no shoppers at all (idle or busy), do nothing - the
 *    rush order just sits pending, same as it would without this feature.
 *
 * @param order - The newly created rush order
 */
export const handleRushOrderPlacement = async (order: Order): Promise<void> => {
  const idleResult = await getNextAvailableShopper();
  if (idleResult.success && idleResult.data) {
    const idleShopper = idleResult.data;
    const assignResult = await assignOrderInOrderService(order.$id, idleShopper.shopperID);
    if (assignResult.success) {
      await databases.updateDocument<ShopperStatus>(
        config.databaseId,
        config.shopperStatusCollectionId,
        idleShopper.$id,
        {
          currentOrderId: order.$id,
          lastActiveTimeStamp: new Date().toISOString(),
        }
      );
    }
    return;
  }

  const candidateResult = await getInterruptCandidateShopper();
  if (!candidateResult.success || !candidateResult.shopper || !candidateResult.order) {
    // No idle or interruptible shopper exists right now - leave it queued
    return;
  }

  const candidateShopper = candidateResult.shopper;
  const victimOrder = candidateResult.order;

  // WHY A FIXED, SHORT STRING?
  // interruptReason is capped at 40 characters on the Appwrite schema -
  // there isn't room for the rush order's own ID, so it stays generic.
  const interruptResult = await interruptOrderInOrderService(
    victimOrder.$id,
    'Bumped for a rush order'
  );
  if (!interruptResult.success) {
    return;
  }

  const assignResult = await assignOrderInOrderService(order.$id, candidateShopper.shopperID);
  if (assignResult.success) {
    await databases.updateDocument<ShopperStatus>(
      config.databaseId,
      config.shopperStatusCollectionId,
      candidateShopper.$id,
      {
        currentOrderId: order.$id,
        lastActiveTimeStamp: new Date().toISOString(),
      }
    );
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

// ============================================================
// SWAP CURRENT ORDER
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
 * WHY reassignIfMostUrgent ON THE RELEASED ORDER?
 * - Same reasoning as the "shopper goes unavailable mid-order" flow in
 *   updateShopperAvailability - a released order shouldn't just sit
 *   there if it's now the single most urgent thing pending and another
 *   shopper is idle right now.
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

    // Best-effort - the swap itself already succeeded regardless of whether
    // the released order gets an immediate hand-off to another shopper
    reassignIfMostUrgent(previousOrderId, shopperId).catch((error) => {
      console.error('Error reassigning released order after swap:', error);
    });

    return { success: true };
  } catch (error) {
    console.error('Error swapping current order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to swap order';
    return { success: false, error: errorMessage };
  }
};
