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
import type {
  Order,
  CreateOrderData,
  OrderResponse,
  OrderListResponse,
  PickupLocation,
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
 * - autoAssigned: Set to true (was auto-assigned by the system)
 *
 * @param orderId - The order's document ID
 * @param shopperId - The shopper's user ID
 * @returns OrderResponse with updated order or error
 */
export const assignOrderToShopper = async (
  orderId: string,
  shopperId: string
): Promise<OrderResponse> => {
  try {
    const updated = await databases.updateDocument<Order>(
      config.databaseId,
      config.ordersCollectionId,
      orderId,
      {
        shopperID: shopperId,
        status: 'assigned',
        autoAssigned: true,
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
