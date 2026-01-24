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

import { ID } from 'appwrite';
import { databases, config } from './appwrite';
import type {
  Order,
  CreateOrderData,
  OrderResponse,
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
