/**
 * Order Service
 * File: src/services/orderService.ts
 *
 * PURPOSE: Handles all order-related operations with Appwrite
 *
 * RESPONSIBILITIES:
 * - Create new orders in the database
 * - Provide pickup location data
 * - Format delivery addresses for storage
 *
 * WHY SEPARATE SERVICE?
 * - Same benefits as productService (reusability, testability, maintainability)
 * - Single Responsibility Principle - all order logic in one place
 * - If order logic changes, only update here
 *
 * FOLLOWS PATTERN FROM: productService.ts
 */

import { ID, Query } from 'appwrite';
import { databases, config } from './appwrite';
import { parseItemIssues, formatItemIssues } from '../utils/orderItems';
import type {
  Order,
  CreateOrderData,
  OrderResponse,
  OrderListResponse,
  PickupLocation,
  PickupTimeSlot,
} from '../types';

// ============================================================
// PICKUP LOCATIONS
// ============================================================

/**
 * Get available pickup locations
 *
 * WHY HARDCODED?
 * - Simple for MVP (no separate collection needed)
 * - Easy to convert to database-driven later
 * - Locations rarely change
 *
 * WHY RETURN AS ARRAY?
 * - Consistent with other service functions
 * - Easy to map over in UI
 * - Can add filtering/sorting later
 */
export const getPickupLocations = (): PickupLocation[] => {
  /**
   * WHY THESE SPECIFIC LOCATIONS?
   * - Matches the plan UI mockup
   * - Provides realistic examples
   * - Three options gives good UX choice
   */
  return [
    {
      id: 'main-store',
      name: 'Main Store',
      address: '123 Main St, Anytown, ST 12345',
    },
    {
      id: 'downtown',
      name: 'Downtown',
      address: '456 Center Ave, Anytown, ST 12345',
    },
    {
      id: 'westside',
      name: 'Westside',
      address: '789 West Blvd, Anytown, ST 12345',
    },
  ];
};

// ============================================================
// PICKUP TIME SLOTS
// ============================================================

const STORE_OPEN_HOUR = 9; // 9:00 AM
const STORE_CLOSE_HOUR = 21; // 9:00 PM
const SLOT_INTERVAL_MINUTES = 60; // normal pickup slots land on the hour (12:00, 1:00, 2:00, ...)
const MIN_PREP_MINUTES = 30; // earliest a new order can realistically be ready

/**
 * How far out a rush order is ready, measured from when it's placed
 *
 * WHY 30 MINUTES?
 * - Matches the reference production app's rush window
 * - Rush is the one exception to the on-the-hour rule: ready ASAP instead
 *   of waiting for the next hourly slot
 */
export const RUSH_PREP_MINUTES = 30;

/**
 * Get the scheduledReadyTime for a rush order: RUSH_PREP_MINUTES from now
 *
 * @returns ISO timestamp RUSH_PREP_MINUTES minutes from the current time
 */
export const getRushReadyTime = (): string =>
  new Date(Date.now() + RUSH_PREP_MINUTES * 60 * 1000).toISOString();

const formatSlotLabel = (date: Date, dayLabel: string): string =>
  `${dayLabel}, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

/**
 * Build every slot between `earliest` (inclusive) and store close, on `earliest`'s date,
 * rounded up to the next SLOT_INTERVAL_MINUTES boundary.
 */
const buildSlotsForDay = (baseDate: Date, earliest: Date, dayLabel: string): PickupTimeSlot[] => {
  const dayClose = new Date(baseDate);
  dayClose.setHours(STORE_CLOSE_HOUR, 0, 0, 0);

  const cursor = new Date(earliest);
  const remainder = cursor.getMinutes() % SLOT_INTERVAL_MINUTES;
  if (remainder !== 0 || cursor.getSeconds() > 0 || cursor.getMilliseconds() > 0) {
    cursor.setMinutes(cursor.getMinutes() + (SLOT_INTERVAL_MINUTES - remainder));
  }
  cursor.setSeconds(0, 0);

  const slots: PickupTimeSlot[] = [];
  while (cursor <= dayClose) {
    slots.push({
      id: cursor.toISOString(),
      label: formatSlotLabel(cursor, dayLabel),
      startTime: cursor.toISOString(),
    });
    cursor.setMinutes(cursor.getMinutes() + SLOT_INTERVAL_MINUTES);
  }

  return slots;
};

/**
 * Get available pickup time slots for the rest of today, falling back to
 * tomorrow's full store hours if today is already closed (or about to close).
 *
 * WHY HARDCODED STORE HOURS?
 * - Same MVP rationale as getPickupLocations - no store-hours collection yet
 */
export const getAvailableTimeSlots = (): PickupTimeSlot[] => {
  const now = new Date();
  const earliestToday = new Date(now.getTime() + MIN_PREP_MINUTES * 60 * 1000);
  const todayOpen = new Date(now);
  todayOpen.setHours(STORE_OPEN_HOUR, 0, 0, 0);

  const todaySlots = buildSlotsForDay(
    now,
    earliestToday < todayOpen ? todayOpen : earliestToday,
    'Today'
  );
  if (todaySlots.length > 0) {
    return todaySlots;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowOpen = new Date(tomorrow);
  tomorrowOpen.setHours(STORE_OPEN_HOUR, 0, 0, 0);

  return buildSlotsForDay(tomorrow, tomorrowOpen, 'Tomorrow');
};

// ============================================================
// ADDRESS FORMATTING
// ============================================================

/**
 * Format delivery address components into a single string
 *
 * WHY FORMAT?
 * - Single field storage is simpler
 * - Consistent display format
 * - Easy to parse if needed later
 *
 * WHY THIS FORMAT?
 * - Standard US address format
 * - Comma-separated for readability
 * - Apt/Suite on same line as street (common pattern)
 *
 * @param streetAddress - Street number and name
 * @param aptSuite - Apartment or suite number (optional)
 * @param city - City name
 * @param state - State abbreviation
 * @param zipCode - ZIP code
 * @returns Formatted address string
 */
export const formatDeliveryAddress = (
  streetAddress: string,
  aptSuite: string,
  city: string,
  state: string,
  zipCode: string
): string => {
  /**
   * WHY CONDITIONAL APT/SUITE?
   * - Not all addresses have apt/suite
   * - Avoid "123 Main St , City" (extra space/comma)
   * - Clean output regardless of input
   */
  const streetLine = aptSuite
    ? `${streetAddress}, ${aptSuite}`
    : streetAddress;

  /**
   * WHY THIS RETURN FORMAT?
   * - Standard: "123 Main St, Apt 4, City, ST 12345"
   * - Readable in order details
   * - Parseable if we need components later
   */
  return `${streetLine}, ${city}, ${state} ${zipCode}`;
};

// ============================================================
// ORDER CREATION
// ============================================================

/**
 * Create a new order in the database
 *
 * WHY RETURN OrderResponse?
 * - Consistent with service pattern (success/error handling)
 * - Caller can check success before proceeding
 * - Error message available for display
 *
 * WHY GENERATE ID HERE?
 * - Appwrite ID.unique() creates unique document ID
 * - Consistent with Appwrite patterns
 * - Could use custom ID format if needed
 *
 * @param orderData - Order data to create
 * @returns OrderResponse with created order or error
 */
export const createOrder = async (
  orderData: CreateOrderData
): Promise<OrderResponse> => {
  try {
    /**
     * WHY createDocument?
     * - Appwrite SDK method for creating documents
     * - Takes database ID, collection ID, document ID, and data
     * - Returns the created document
     */
    const order = await databases.createDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      ID.unique(),
      orderData
    );

    /**
     * WHY LOG SUCCESS?
     * - Debugging aid during development
     * - Can verify order creation in console
     * - Remove or change to analytics in production
     */
    console.log('Order created successfully:', order.$id);

    return {
      success: true,
      data: order,
    };
  } catch (error) {
    /**
     * WHY CATCH AND RETURN?
     * - Don't crash the app on order failure
     * - Provide meaningful error to user
     * - Log for debugging
     *
     * WHY CHECK instanceof Error?
     * - TypeScript error type is 'unknown'
     * - Need to check before accessing .message
     * - Fallback for non-Error exceptions
     */
    console.error('Error creating order:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Get order by ID
 *
 * WHY THIS FUNCTION?
 * - Needed for OrderConfirmation screen
 * - Fetch order details after creation
 * - Could be used for order tracking
 *
 * @param orderId - Appwrite document ID
 * @returns OrderResponse with order or error
 */
export const getOrderById = async (orderId: string): Promise<OrderResponse> => {
  try {
    const order = await databases.getDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId
    );

    return {
      success: true,
      data: order,
    };
  } catch (error) {
    console.error('Error fetching order:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// ORDER LIST AND MANAGEMENT
// ============================================================

/**
 * Fetch all orders for a customer
 *
 * @param customerId - The customer's user ID
 * @returns OrderListResponse with orders sorted by date (newest first)
 */
export const getOrdersByCustomerId = async (
  customerId: string
): Promise<OrderListResponse> => {
  try {
    const response = await databases.listDocuments<Order>(
      config.databaseId,
      config.ordersCollectionId,
      [
        Query.equal('customerID', customerId),
        Query.orderDesc('orderDate'),
        Query.limit(50),
      ]
    );

    return {
      success: true,
      data: response.documents,
      total: response.total,
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch orders';

    return {
      success: false,
      data: [],
      total: 0,
      error: errorMessage,
    };
  }
};

/**
 * Cancel an order (only if pending or assigned)
 *
 * @param orderId - The order's document ID
 * @returns OrderResponse with updated order or error
 */
export const cancelOrder = async (orderId: string): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      { status: 'cancelled' }
    );

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error cancelling order:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to cancel order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// SHOPPER TASK FUNCTIONS
// ============================================================

/**
 * Fetch available tasks (orders needing shoppers)
 *
 * WHY 'pending' STATUS?
 * - 'pending' means the order was placed but no shopper is working on it yet
 * - These are the orders available for shoppers to pick up
 * - Once a shopper starts, status changes to 'assigned' or 'shopping'
 *
 * WHY CHECK shopperID?
 * - Empty shopperID confirms no one is assigned
 * - Double-check with status for data integrity
 *
 * @returns OrderListResponse with pending orders sorted by date (oldest first for FIFO)
 */
export const getAvailableTasks = async (): Promise<OrderListResponse> => {
  try {
    /**
     * WHY orderAsc (oldest first)?
     * - FIFO (First In, First Out) is fair to customers
     * - Customers who ordered first should be served first
     * - Standard practice in order fulfillment
     */
    const response = await databases.listDocuments<Order>(
      config.databaseId,
      config.ordersCollectionId,
      [
        Query.equal('status', 'pending'),
        Query.equal('shopperID', ''), // No shopper assigned yet
        Query.orderAsc('orderDate'), // Oldest first (FIFO)
        Query.limit(50),
      ]
    );

    return {
      success: true,
      data: response.documents,
      total: response.total,
    };
  } catch (error) {
    console.error('Error fetching available tasks:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch available tasks';

    return {
      success: false,
      data: [],
      total: 0,
      error: errorMessage,
    };
  }
};

/**
 * Get count of available tasks
 *
 * WHY SEPARATE COUNT FUNCTION?
 * - Dashboard only needs the count, not full order data
 * - More efficient than fetching all orders just to count
 * - Appwrite returns total in response, so we use limit(1) for efficiency
 *
 * @returns Object with success status and count
 */
export const getAvailableTasksCount = async (): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> => {
  try {
    /**
     * WHY limit(1)?
     * - We only need the total count, not the actual documents
     * - Appwrite still returns the total in response.total
     * - Minimizes data transfer
     */
    const response = await databases.listDocuments<Order>(
      config.databaseId,
      config.ordersCollectionId,
      [
        Query.equal('status', 'pending'),
        Query.equal('shopperID', ''),
        Query.limit(1), // Only need count, not data
      ]
    );

    return {
      success: true,
      count: response.total,
    };
  } catch (error) {
    console.error('Error fetching task count:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch task count';

    return {
      success: false,
      count: 0,
      error: errorMessage,
    };
  }
};

// ============================================================
// ORDER ASSIGNMENT FUNCTIONS
// ============================================================

/**
 * Get the next order to assign to a shopper
 *
 * WHY SORT BY scheduledReadyTime?
 * - Orders with earlier ready times are more urgent
 * - Ensures customers get their orders on time
 * - Falls back to orderDate if scheduledReadyTime not set
 *
 * @returns OrderResponse with the next order or null if none available
 */
export const getNextOrderForAssignment = async (): Promise<OrderResponse> => {
  try {
    const response = await databases.listDocuments<Order>(
      config.databaseId,
      config.ordersCollectionId,
      [
        Query.equal('status', 'pending'),
        Query.equal('shopperID', ''),
        Query.orderAsc('scheduledReadyTime'), // Closest due time first
        Query.limit(1),
      ]
    );

    if (response.documents.length === 0) {
      return {
        success: true,
        data: null, // No orders available
      };
    }

    return {
      success: true,
      data: response.documents[0] ?? null,
    };
  } catch (error) {
    console.error('Error getting next order for assignment:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to get next order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Assign an order to a shopper
 *
 * UPDATES:
 * - shopperID: The shopper taking this order
 * - status: Changes from 'pending' to 'assigned'
 * - autoAssigned: Whether the system assigned this (true) or the
 *   shopper manually claimed it from the available-tasks list (false)
 * - interruptedAt/interruptReason: cleared (see WHY below)
 *
 * WHY A DEFAULT OF true?
 * - Every existing caller (auto-assignment on becoming available, rush
 *   order placement) is in fact an auto-assignment - defaulting to true
 *   keeps them all unchanged
 * - The one manual-claim caller (TaskDetailScreen) passes false explicitly
 *
 * WHY CLEAR interruptedAt/interruptReason HERE?
 * - Found live: an order interrupted once, then later re-assigned to any
 *   shopper (auto-assignment, manual claim, or a swap) and then
 *   unassigned again for a totally unrelated reason (voluntary swap,
 *   going unavailable) still carried the OLD interruptedAt timestamp -
 *   ShopperAssignmentContext's polling only checks "is interruptedAt
 *   set", not "was this order just interrupted in this transition", so
 *   it fired a false "Order Reassigned" modal off stale history.
 *   Clearing both fields the moment an order is freshly assigned is the
 *   single point where "this interrupt is now resolved" is actually
 *   true, regardless of which of assignOrderToShopper's several callers
 *   does the assigning.
 *
 * @param orderId - The order's document ID
 * @param shopperId - The shopper's user ID
 * @param autoAssigned - Whether this was an automatic assignment (default true)
 * @returns OrderResponse with updated order or error
 */
export const assignOrderToShopper = async (
  orderId: string,
  shopperId: string,
  autoAssigned: boolean = true
): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      {
        shopperID: shopperId,
        status: 'assigned',
        autoAssigned,
        interruptedAt: null,
        interruptReason: null,
      }
    );

    console.log(`Order ${orderId} assigned to shopper ${shopperId}`);

    return {
      success: true,
      data: updated,
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
 * Unassign an order from its shopper, returning it to the pending queue
 *
 * WHY RESET TO 'pending' WITH EMPTY shopperID?
 * - Matches the exact shape getNextOrderForAssignment/getAvailableTasks query for
 * - No separate "queue" collection - the queue IS pending, unassigned orders,
 *   ordered by scheduledReadyTime
 * - autoAssigned resets to false since this is no longer an active assignment
 *
 * @param orderId - The order's document ID
 * @returns OrderResponse with updated order or error
 */
export const unassignOrder = async (orderId: string): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      {
        shopperID: '',
        status: 'pending',
        autoAssigned: false,
      }
    );

    console.log(`Order ${orderId} unassigned, returned to queue`);

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error unassigning order:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to unassign order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Interrupt an order: release it back to the pending queue like
 * unassignOrder does, but also stamp interruptedAt/interruptReason so
 * there's a record of why it was taken from its shopper.
 *
 * WHY A SEPARATE FUNCTION FROM unassignOrder?
 * - unassignOrder models a shopper voluntarily stepping away (going
 *   unavailable) - there's no "reason," it's just released.
 * - interruptOrder models the order being taken from a shopper against
 *   their current work, to make room for something more urgent (a rush
 *   order). Keeping them separate keeps each call site's intent clear
 *   without an optional "was this an interrupt?" flag threaded through
 *   unassignOrder's callers.
 *
 * @param orderId - The order's document ID
 * @param reason - Human-readable reason, stored on the order
 * @returns OrderResponse with updated order or error
 */
export const interruptOrder = async (
  orderId: string,
  reason: string
): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      {
        shopperID: '',
        status: 'pending',
        autoAssigned: false,
        interruptedAt: new Date().toISOString(),
        interruptReason: reason,
      }
    );

    console.log(`Order ${orderId} interrupted and returned to queue: ${reason}`);

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error interrupting order:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to interrupt order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Get the current assigned order for a shopper
 *
 * WHY CHECK 'assigned' OR 'shopping'?
 * - 'assigned': Shopper has been assigned but hasn't started shopping
 * - 'shopping': Shopper is actively shopping for items
 * - Both represent an "active" order the shopper is working on
 *
 * @param shopperId - The shopper's user ID
 * @returns OrderResponse with the current order or null if none
 */
export const getCurrentAssignedOrder = async (
  shopperId: string
): Promise<OrderResponse> => {
  try {
    const response = await databases.listDocuments<Order>(
      config.databaseId,
      config.ordersCollectionId,
      [
        Query.equal('shopperID', shopperId),
        Query.contains('status', ['assigned', 'shopping']),
        Query.limit(1),
      ]
    );

    if (response.documents.length === 0) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: response.documents[0] ?? null,
    };
  } catch (error) {
    console.error('Error fetching current assigned order:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch current order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Update the picked items for an order
 *
 * WHY STRING FORMAT?
 * - Appwrite doesn't support nested arrays of objects
 * - Format: "productId:pickedQty,productId:pickedQty,..."
 * - Example: "abc123:2,def456:1" (picked 2 of abc123, 1 of def456)
 *
 * @param orderId - The order's document ID
 * @param pickedItems - String of picked items in format "productId:qty,..."
 * @returns OrderResponse with updated order or error
 */
export const updatePickedItems = async (
  orderId: string,
  pickedItems: string
): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      { pickedItems }
    );

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error updating picked items:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update picked items';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

// ============================================================
// SHOPPING WORKFLOW
// ============================================================

/**
 * Move an order from 'assigned' to 'shopping' - the shopper has
 * started actively working the item list.
 *
 * @param orderId - The order's document ID
 * @returns OrderResponse with updated order or error
 */
export const startShopping = async (orderId: string): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      { status: 'shopping' }
    );

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error starting shopping:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to start shopping';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Update the item issues for an order (out-of-stock markers and
 * substitution proposals/approval state) - see src/utils/orderItems.ts
 * for the compact string format and its parse/format helpers.
 *
 * @param orderId - The order's document ID
 * @param itemIssues - String of item issues in the compact format
 * @returns OrderResponse with updated order or error
 */
export const updateItemIssues = async (
  orderId: string,
  itemIssues: string
): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      { itemIssues }
    );

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error updating item issues:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update item issues';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Mark an order complete, branching by fulfillment type
 *
 * WHY A nextStatus PARAM INSTEAD OF TWO FUNCTIONS?
 * - Both branches do the exact same write, just a different status
 *   value - the caller (OrderCompletionScreen) already knows which one
 *   applies from the order's fulfillment type
 *
 * @param orderId - The order's document ID
 * @param nextStatus - 'ready_for_pickup' for pickup orders, 'completed' for delivery
 * @returns OrderResponse with updated order or error
 */
export const completeOrder = async (
  orderId: string,
  nextStatus: 'ready_for_pickup' | 'completed'
): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      { status: nextStatus }
    );

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error completing order:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to complete order';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};

/**
 * Record the customer's approve/reject decision on a pending
 * substitution proposal.
 *
 * WHY READ-MODIFY-WRITE INSTEAD OF A TARGETED UPDATE?
 * - itemIssues is a single compact string covering every item on the
 *   order, the same pattern as items/pickedItems - there's no partial
 *   update for one entry within it, so the current value has to be
 *   fetched, the matching issue's status flipped in memory, and the
 *   whole string written back
 *
 * @param orderId - The order's document ID
 * @param productId - The product whose substitution is being responded to
 * @param approve - true to approve the substitute, false to reject it
 * @returns OrderResponse with updated order or error
 */
export const respondToSubstitution = async (
  orderId: string,
  productId: string,
  approve: boolean
): Promise<OrderResponse> => {
  try {
    const orderResult = await getOrderById(orderId);
    if (!orderResult.success || !orderResult.data) {
      return {
        success: false,
        data: null,
        error: orderResult.error ?? 'Order not found',
      };
    }

    const issues = parseItemIssues(orderResult.data.itemIssues ?? '');
    const updatedIssues = issues.map((issue) =>
      issue.kind === 'sub' && issue.productId === productId
        ? { ...issue, status: (approve ? 'approved' : 'rejected') as 'approved' | 'rejected' }
        : issue
    );

    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      { itemIssues: formatItemIssues(updatedIssues) }
    );

    return {
      success: true,
      data: updated,
    };
  } catch (error) {
    console.error('Error responding to substitution:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to respond to substitution';

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
};
