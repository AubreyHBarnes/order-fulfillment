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

// ============================================================
// AVAILABILITY MANAGEMENT
// ============================================================

/**
 * Update shopper availability and optionally trigger auto-assignment
 *
 * FLOW:
 * 1. Fetch current shopper status to get document $id
 * 2. Update isAvailable field
 * 3. If becoming available, check for pending orders
 * 4. If order found, assign it to this shopper
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
    let assignedOrder: Order | null = null;

    // Update the availability
    const updateData: UpdateShopperStatusData = {
      isAvailable,
      lastActiveTimeStamp: new Date().toISOString(),
    };

    // If becoming available, try to auto-assign an order
    if (isAvailable) {
      const orderResult = await getNextOrderForAssignment();
      if (orderResult.success && orderResult.data) {
        // Found an order to assign
        const order = orderResult.data;

        // Assign the order to this shopper
        const assignResult = await assignOrderInOrderService(order.$id, shopperId);
        if (assignResult.success && assignResult.data) {
          assignedOrder = assignResult.data;
          // Update shopper's currentOrderId
          updateData.currentOrderId = order.$id;
        }
      }
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
