/**
 * Function Action Service
 * File: src/services/functionActionService.ts
 *
 * Client-side entry point for the auto-assignment Function's
 * HTTP-triggered actions (docs/DECISIONS.md's "Permission tightening"
 * entry) - the server-side authorization boundary for writes that used
 * to go straight to Orders/ShopperStatus/CustomerArrivals from the
 * client. Every action follows the same shape: mint a fresh JWT for the
 * current session, pass it in the execution body so the Function can
 * verify who's actually calling (resolveCaller() in main.js - Appwrite
 * forwards no caller identity on its own, confirmed live), and return
 * the same plain success/error shape every other service function in
 * this app already returns.
 */
import { Functions, ExecutionMethod } from 'appwrite';
import appwriteClient, { account } from './appwrite';

const functions = new Functions(appwriteClient);

const FUNCTION_ID = 'auto-assignment';

export interface FunctionActionResponse {
  success: boolean;
  error?: string;
}

async function callFunctionAction(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<FunctionActionResponse> {
  try {
    const jwt = await account.createJWT();
    const execution = await functions.createExecution({
      functionId: FUNCTION_ID,
      body: JSON.stringify({ action, jwt: jwt.jwt, ...payload }),
      async: false,
      method: ExecutionMethod.POST,
    });

    const body = JSON.parse(execution.responseBody || '{}');
    if (!body.ok) {
      return { success: false, error: body.error ?? 'Action failed' };
    }
    return { success: true };
  } catch (error) {
    console.error(`Error calling function action "${action}":`, error);
    const errorMessage = error instanceof Error ? error.message : 'Action failed';
    return { success: false, error: errorMessage };
  }
}

/**
 * Manually claim an unclaimed order and start shopping it, verified and
 * written server-side - replaces the client's own three-write sequence
 * (assignOrderToShopper on Orders, assignOrderToShopper on
 * ShopperStatus, then startShopping) in TaskDetailScreen's 'claim'
 * branch. See docs/DECISIONS.md's "Permission tightening" entry.
 *
 * @param orderId - The order's document ID to claim
 */
export const claimOrder = async (orderId: string): Promise<FunctionActionResponse> => {
  return callFunctionAction('claimOrder', { orderId });
};

/**
 * Swap off the caller's current order onto a different pending one,
 * releasing the previous order back to the queue - replaces
 * TaskDetailScreen's 'swap' branch (swapCurrentOrder in
 * shopperStatusService.ts). Note there's no `previousOrderId`
 * parameter here, unlike the old client function - which order gets
 * released is always derived server-side from the caller's own
 * ShopperStatus, not taken from the client's claim. See
 * docs/DECISIONS.md's "Permission tightening" entry.
 *
 * @param newOrderId - The order's document ID to swap onto
 */
export const swapOrder = async (newOrderId: string): Promise<FunctionActionResponse> => {
  return callFunctionAction('swapOrder', { newOrderId });
};

/**
 * Accept an arrival hand-off (ArrivalNotificationModal's "Hand Off
 * Order") - replaces ShopperAssignmentContext's direct
 * updateArrivalStatus() call. Verified server-side to actually be the
 * shopper this arrival is addressed to. See docs/DECISIONS.md's
 * "Permission tightening" entry.
 *
 * @param arrivalId - The CustomerArrival document ID to accept
 */
export const acceptArrivalHandoff = async (arrivalId: string): Promise<FunctionActionResponse> => {
  return callFunctionAction('acceptArrivalHandoff', { arrivalId });
};

/**
 * Decline an arrival hand-off (ArrivalNotificationModal's
 * "Unavailable") - replaces ShopperAssignmentContext's
 * recordArrivalDecline() + releaseArrivalHandoff() pair with one
 * verified, ordered server-side write. See docs/DECISIONS.md's
 * "Permission tightening" entry.
 *
 * @param arrivalId - The CustomerArrival document ID to decline
 */
export const declineArrivalHandoff = async (arrivalId: string): Promise<FunctionActionResponse> => {
  return callFunctionAction('declineArrivalHandoff', { arrivalId });
};

/**
 * Complete an arrival hand-off from Customer Check-ins ("Hand Off
 * Order") - replaces CustomerCheckInsScreen's separate
 * updateArrivalStatus() + completeOrder() calls with one write. Any
 * on-duty shopper can call this, not just whoever the arrival was
 * originally addressed to - see docs/DECISIONS.md's "Permission
 * tightening" entry for why that's intentional.
 *
 * @param arrivalId - The CustomerArrival document ID to complete
 */
export const completeArrivalHandoff = async (arrivalId: string): Promise<FunctionActionResponse> => {
  return callFunctionAction('completeArrivalHandoff', { arrivalId });
};

/**
 * Progress an order to the next fulfillment-lifecycle status
 * (OrderCompletionScreen's "Mark Ready for Pickup"/"Mark Out for
 * Delivery", DropOffsScreen's "Mark Delivered") - replaces
 * orderService.ts's completeOrder (removed - this was its only
 * remaining set of callers). Verified server-side that the order
 * actually belongs to the calling shopper. See docs/DECISIONS.md's
 * "Permission tightening" entry.
 *
 * @param orderId - The order's document ID
 * @param nextStatus - The status to progress the order to
 */
export const completeOrder = async (
  orderId: string,
  nextStatus: 'ready_for_pickup' | 'out_for_delivery' | 'completed'
): Promise<FunctionActionResponse> => {
  return callFunctionAction('completeOrder', { orderId, nextStatus });
};

/**
 * Free the caller's own ShopperStatus after completing an order -
 * replaces shopperStatusService.ts's clearCurrentOrder(shopperId). No
 * shopperId parameter, unlike the old client function - always clears
 * the caller's own current order, derived server-side from their
 * resolved identity, never taken from the client. See
 * docs/DECISIONS.md's "Permission tightening" entry.
 */
export const releaseAfterCompletion = async (): Promise<FunctionActionResponse> => {
  return callFunctionAction('releaseAfterCompletion');
};

/**
 * Move an already-assigned order from 'assigned' to 'shopping'
 * (TaskDetailScreen's 'start' action, ShopperDashboardScreen's
 * current-task tap) - replaces orderService.ts's startShopping (removed
 * - this was its only remaining set of callers). Verified server-side
 * that the order actually belongs to the calling shopper. See
 * docs/DECISIONS.md's "Permission tightening" entry.
 *
 * @param orderId - The order's document ID
 */
export const startShopping = async (orderId: string): Promise<FunctionActionResponse> => {
  return callFunctionAction('startShopping', { orderId });
};

/**
 * Flip the caller's own on-duty status (ShopperDashboardScreen's status
 * dropdown, ShopperAssignmentContext's decline-a-fresh-assignment path)
 * - replaces shopperStatusService.ts's updateShopperAvailability
 * (removed). No shopperId parameter, unlike the old client function -
 * always targets the caller's own ShopperStatus, derived server-side
 * from their resolved identity. See docs/DECISIONS.md's "Permission
 * tightening" entry.
 *
 * @param isAvailable - The new availability status
 */
export const toggleAvailability = async (isAvailable: boolean): Promise<FunctionActionResponse> => {
  return callFunctionAction('toggleAvailability', { isAvailable });
};

/**
 * Cancel the caller's own order (OrderDetailScreen's "Cancel Order") -
 * replaces orderService.ts's cancelOrder (removed - this was its only
 * remaining set of callers). Verified server-side that the order
 * belongs to the calling customer and is still in a cancellable status
 * (`pending`/`assigned`) - a real gate the old client version never
 * enforced, only its own Cancel button's visibility did. See
 * docs/DECISIONS.md's "Permission tightening" entry.
 *
 * @param orderId - The order's document ID
 */
export const cancelOrder = async (orderId: string): Promise<FunctionActionResponse> => {
  return callFunctionAction('cancelOrder', { orderId });
};

/**
 * Record the customer's approve/reject decision on a pending
 * substitution proposal (OrderDetailScreen's SubstitutionApprovalCard) -
 * replaces orderService.ts's respondToSubstitution (removed - this was
 * its only remaining set of callers). Verified server-side that the
 * order belongs to the calling customer. See docs/DECISIONS.md's
 * "Permission tightening" entry.
 *
 * @param orderId - The order's document ID
 * @param productId - The product whose substitution is being responded to
 * @param approve - true to approve the substitute, false to reject it
 */
export const respondToSubstitution = async (
  orderId: string,
  productId: string,
  approve: boolean
): Promise<FunctionActionResponse> => {
  return callFunctionAction('respondToSubstitution', { orderId, productId, approve });
};

/**
 * Update the picked items for an order (ShoppingScreen's `persistPicked`,
 * fired on every Found/quantity change) - replaces orderService.ts's
 * updatePickedItems (removed - this was its only remaining set of
 * callers). Verified server-side that the order is assigned to the
 * calling shopper. See docs/DECISIONS.md's "Permission tightening" entry.
 *
 * @param orderId - The order's document ID
 * @param pickedItems - Compact "productId:qty,..." string
 */
export const updatePickedItems = async (
  orderId: string,
  pickedItems: string
): Promise<FunctionActionResponse> => {
  return callFunctionAction('updatePickedItems', { orderId, pickedItems });
};

/**
 * Update the item issues for an order (ShoppingScreen's `persistIssues`,
 * fired on out-of-stock/substitute/found-clears-issue) - replaces
 * orderService.ts's updateItemIssues (removed - this was its only
 * remaining set of callers). Same shopper-ownership check as
 * updatePickedItems above. See docs/DECISIONS.md's "Permission
 * tightening" entry.
 *
 * @param orderId - The order's document ID
 * @param itemIssues - Compact item-issues string (see src/utils/orderItems.ts)
 */
export const updateItemIssues = async (
  orderId: string,
  itemIssues: string
): Promise<FunctionActionResponse> => {
  return callFunctionAction('updateItemIssues', { orderId, itemIssues });
};
