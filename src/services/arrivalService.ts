/**
 * Customer Arrival Service
 * File: src/services/arrivalService.ts
 *
 * PURPOSE:
 * Handles all operations related to customer arrival notifications for
 * curbside/store pickup orders. When a customer arrives to pick up their
 * order, this service records that arrival and allows staff to be notified.
 *
 * ============================================================
 * FEATURE CONTEXT: CURBSIDE PICKUP FLOW
 * ============================================================
 *
 * The complete curbside pickup flow works like this:
 *
 * 1. CUSTOMER places a pickup order (status: 'pending')
 * 2. SHOPPER is assigned and shops the order (status: 'assigned' → 'shopping')
 * 3. SHOPPER completes shopping (status: 'ready_for_pickup')
 * 4. CUSTOMER receives notification that order is ready
 * 5. CUSTOMER drives to store
 * 6. CUSTOMER opens OrderDetailScreen and taps "I've Arrived" ← THIS SERVICE
 * 7. STAFF sees arrival notification and brings order to customer
 * 8. STAFF marks arrival as 'completed'
 * 9. Order status changes to 'completed'
 *
 * This service handles step 6 - recording the customer's arrival.
 *
 * ============================================================
 * WHY A SEPARATE SERVICE FILE?
 * ============================================================
 *
 * We follow the "Single Responsibility Principle" - each service handles
 * one domain of our app:
 * - authService.ts → Authentication
 * - productService.ts → Products
 * - orderService.ts → Orders
 * - arrivalService.ts → Customer Arrivals (this file)
 *
 * Benefits:
 * 1. ORGANIZATION: Easy to find arrival-related code
 * 2. TESTING: Can test arrival logic in isolation
 * 3. REUSABILITY: Multiple screens can use these functions
 * 4. MAINTAINABILITY: Changes to arrival logic happen in one place
 *
 * ============================================================
 * FOLLOWS PATTERN FROM: orderService.ts
 * ============================================================
 */

import { ID, Query } from 'appwrite';
import { databases, config } from './appwrite';
import type {
  CustomerArrival,
  CreateArrivalData,
  ArrivalResponse,
  ArrivalListResponse,
} from '../types';

// ============================================================
// RECORD CUSTOMER ARRIVAL
// ============================================================

/**
 * Record that a customer has arrived for pickup
 *
 * WHEN TO CALL:
 * Call this when the customer taps the "I've Arrived" button on the
 * OrderDetailScreen for a pickup order that's ready.
 *
 * WHAT IT DOES:
 * 1. Creates a new document in the CustomerArrivals collection
 * 2. Returns the created arrival record
 *
 * WHY RETURN THE CREATED RECORD?
 * - UI can immediately show the arrival details
 * - Can display the arrival time back to the user
 * - Enables optimistic UI updates (show success before server confirms)
 *
 * ERROR HANDLING:
 * - Returns { success: false, error: message } on failure
 * - Caller should show user-friendly error (Alert.alert)
 * - Logs technical error for debugging
 *
 * @param arrivalData - The arrival information to record
 * @returns ArrivalResponse with created arrival or error
 *
 * EXAMPLE USAGE:
 * ```typescript
 * const result = await recordArrival({
 *   orderID: order.$id,
 *   customerID: user.$id,
 *   arrivalTime: new Date().toISOString(),
 *   status: 'waiting',
 *   vehicleDescription: 'Blue Honda Civic',
 *   parkingSpot: 'Spot 3',
 * });
 *
 * if (result.success) {
 *   // Show success UI
 * } else {
 *   Alert.alert('Error', result.error);
 * }
 * ```
 */
export const recordArrival = async (
  arrivalData: CreateArrivalData
): Promise<ArrivalResponse> => {
  try {
    /**
     * WHY ID.unique()?
     * Appwrite's ID.unique() generates a unique document ID.
     * Alternatives:
     * - Custom ID: Could use `${orderID}_${timestamp}` but unique() is simpler
     * - Let Appwrite generate: ID.unique() is the standard approach
     */
    const arrival = await databases.createDocument<CustomerArrival>(
      config.databaseId,
      config.customerArrivalsCollectionId,
      ID.unique(),
      arrivalData
    );

    /**
     * WHY LOG SUCCESS?
     * During development, console logs help verify the flow works.
     * In production, you might:
     * - Remove these logs
     * - Send to analytics service
     * - Keep for debugging but filter in production builds
     */
    console.log('Customer arrival recorded:', arrival.$id);

    return {
      success: true,
      data: arrival,
    };
  } catch (error) {
    /**
     * WHY THIS ERROR PATTERN?
     *
     * 1. console.error() - Logs full error for developer debugging
     * 2. Check instanceof Error - TypeScript requires this to access .message
     * 3. Return user-friendly message - Don't expose technical details to users
     *
     * COMMON ERRORS:
     * - Network error (no internet)
     * - Permission denied (Appwrite collection permissions)
     * - Invalid data (missing required fields)
     */
    console.error('Error recording arrival:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to record arrival';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// CHECK EXISTING ARRIVAL
// ============================================================

/**
 * Check if customer has already recorded an arrival for an order
 *
 * WHY THIS FUNCTION?
 * We don't want customers to spam the "I've Arrived" button. This function
 * checks if they've already notified for this order so we can:
 * 1. Show "Already notified" state instead of button
 * 2. Display their arrival time
 * 3. Prevent duplicate notifications to staff
 *
 * QUERY EXPLANATION:
 * We query for arrivals where:
 * - orderID matches the current order
 * - status is 'waiting' (not yet completed)
 *
 * WHY CHECK STATUS = 'waiting'?
 * If a previous arrival was 'completed', the customer might have left
 * and come back. We only care about active/pending arrivals.
 *
 * @param orderID - The order to check arrivals for
 * @returns ArrivalResponse with existing arrival or null
 *
 * EXAMPLE USAGE:
 * ```typescript
 * const existing = await getActiveArrivalForOrder(order.$id);
 * if (existing.success && existing.data) {
 *   // Customer already arrived, show waiting state
 *   setArrivalStatus('waiting');
 *   setArrivalTime(existing.data.arrivalTime);
 * } else {
 *   // Show "I've Arrived" button
 *   setArrivalStatus('not_arrived');
 * }
 * ```
 */
export const getActiveArrivalForOrder = async (
  orderID: string
): Promise<ArrivalResponse> => {
  try {
    /**
     * WHY listDocuments WITH QUERIES?
     *
     * Appwrite Query system works like this:
     * - Query.equal('field', value) - Exact match
     * - Query.orderDesc('field') - Sort descending
     * - Query.limit(n) - Limit results
     *
     * We use multiple queries to:
     * 1. Find arrivals for THIS order (Query.equal)
     * 2. Only 'waiting' status (Query.equal)
     * 3. Get most recent first (Query.orderDesc)
     * 4. Only need one result (Query.limit)
     */
    const response = await databases.listDocuments<CustomerArrival>(
      config.databaseId,
      config.customerArrivalsCollectionId,
      [
        Query.equal('orderID', orderID),
        Query.equal('status', 'waiting'),
        Query.orderDesc('arrivalTime'),
        Query.limit(1),
      ]
    );

    /**
     * WHY CHECK documents.length?
     * listDocuments returns an array. If empty, no active arrival exists.
     * We return null for data to indicate "no arrival found" vs "error".
     *
     * WHY firstArrival VARIABLE?
     * TypeScript doesn't narrow array access (response.documents[0] could be undefined
     * even after length check). Assigning to a variable with explicit check satisfies TS.
     */
    const firstArrival = response.documents[0];
    if (firstArrival) {
      return {
        success: true,
        data: firstArrival,
      };
    }

    // No active arrival found - this is NOT an error, just no data
    return {
      success: true,
      data: null,
    };
  } catch (error) {
    console.error('Error checking arrival:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to check arrival status';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// UPDATE ARRIVAL STATUS
// ============================================================

/**
 * Update the status of an arrival (for staff use)
 *
 * WHY THIS FUNCTION?
 * When staff acknowledges or completes an arrival, we need to update
 * the status. This is primarily for the staff/shopper side of the app,
 * but we include it here for completeness.
 *
 * STATUS FLOW:
 * 'waiting' → 'acknowledged' → 'completed'
 *
 * - waiting: Customer just arrived, staff not yet notified
 * - acknowledged: Staff has seen the notification
 * - completed: Order has been handed to customer
 *
 * @param arrivalId - The arrival document ID to update
 * @param status - The new status
 * @returns ArrivalResponse with updated arrival or error
 *
 * EXAMPLE USAGE (staff app):
 * ```typescript
 * // Staff taps "On my way" button
 * await updateArrivalStatus(arrival.$id, 'acknowledged');
 *
 * // Staff completes handoff
 * await updateArrivalStatus(arrival.$id, 'completed');
 * ```
 */
export const updateArrivalStatus = async (
  arrivalId: string,
  status: 'waiting' | 'acknowledged' | 'completed'
): Promise<ArrivalResponse> => {
  try {
    /**
     * WHY updateDocument?
     * Appwrite's updateDocument only changes specified fields.
     * Unspecified fields remain unchanged.
     * This is different from PUT (replace entire document) in REST APIs.
     */
    const updated = await databases.updateDocument<CustomerArrival>(
      config.databaseId,
      config.customerArrivalsCollectionId,
      arrivalId,
      { status }
    );

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error updating arrival status:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update arrival';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// GET ALL ARRIVALS FOR ORDER (HISTORY)
// ============================================================

/**
 * Get all arrivals for an order (including completed ones)
 *
 * WHY THIS FUNCTION?
 * For order history or debugging, we might want to see ALL arrivals
 * for an order, not just active ones. This shows the complete history.
 *
 * WHEN TO USE:
 * - Order detail screen (show arrival history)
 * - Admin/debugging views
 * - Analytics (how long did customers wait?)
 *
 * @param orderID - The order to get arrivals for
 * @returns ArrivalListResponse with all arrivals for this order
 */
export const getArrivalsForOrder = async (
  orderID: string
): Promise<ArrivalListResponse> => {
  try {
    const response = await databases.listDocuments<CustomerArrival>(
      config.databaseId,
      config.customerArrivalsCollectionId,
      [
        Query.equal('orderID', orderID),
        Query.orderDesc('arrivalTime'),
      ]
    );

    return {
      success: true,
      data: response.documents,
    };
  } catch (error) {
    console.error('Error fetching arrivals:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch arrivals';

    return {
      success: false,
      data: [],
      error: errorMessage,
    };
  }
};
