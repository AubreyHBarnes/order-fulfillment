/**
 * Type Definitions
 * File: src/types/index.ts
 *
 * Shared TypeScript types for the GroceryFulfillmentApp
 */

import type { Models } from 'appwrite';

// ============================================================
// PRODUCT TYPES
// ============================================================

/**
 * Product from the Products collection
 * Extends Appwrite's Document type for proper SDK integration
 */
export interface Product extends Models.Document {
  name: string;
  price: number;
  category: string;
  unit: string;
  inStock: boolean;
  aisle?: string;
  description?: string;
  imageUrl?: string;
}

// ============================================================
// ORDER TYPES
// ============================================================

/**
 * Order status throughout its lifecycle
 *
 * WHY THESE SPECIFIC STATUSES?
 * - pending: Order just created, waiting for shopper assignment
 * - assigned: Shopper has been assigned to the order
 * - shopping: Shopper is actively shopping for items
 * - ready_for_pickup: Order is ready for customer pickup (pickup orders only)
 * - completed: Order delivered/picked up successfully
 * - cancelled: Order was cancelled by customer or system
 */
export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'shopping'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled';

/**
 * Fulfillment type for the order
 *
 * WHY SEPARATE TYPE?
 * - Clear distinction between delivery and pickup flows
 * - Type safety prevents typos
 * - Easy to extend (e.g., 'curbside' in future)
 */
export type FulfillmentType = 'delivery' | 'pickup';

/**
 * Order document from the Orders collection
 * Extends Appwrite's Document type for proper SDK integration
 *
 * WHY items as JSON string?
 * - Appwrite doesn't support nested arrays of objects natively
 * - JSON string allows storing complex cart data
 * - Parsed on read with JSON.parse()
 */
export interface Order extends Models.Document {
  customerID: string;
  shopperID: string;
  status: OrderStatus;
  items: string; // Compact format: "productId:quantity,productId:quantity,..."
  totalAmount: number;
  deliveryAddress: string; // For pickup orders, prefixed with "PICKUP: "
  deliveryNotes?: string;
  autoAssigned: boolean;
  priority: number;
  orderDate: string;
  scheduledReadyTime: string; // ISO timestamp - when order should be ready
  pickedItems: string; // Format: "productId:pickedQty,..." (empty = none picked)
}

/**
 * Data required to create a new order
 *
 * WHY SEPARATE FROM Order?
 * - Order has Appwrite document fields ($id, $createdAt, etc.)
 * - CreateOrderData only has user-provided fields
 * - Prevents accidentally passing document fields to create
 */
export interface CreateOrderData {
  customerID: string;
  shopperID: string;
  status: OrderStatus;
  items: string;
  totalAmount: number;
  deliveryAddress: string;
  deliveryNotes?: string;
  autoAssigned: boolean;
  priority: number;
  orderDate: string;
  scheduledReadyTime: string;
  pickedItems: string;
}

/**
 * Pickup location for store pickup orders
 *
 * WHY THIS STRUCTURE?
 * - id: Unique identifier for the location
 * - name: Display name (e.g., "Main Store")
 * - address: Full address for customer reference
 * - Simple structure, easy to extend with hours, phone, etc.
 */
export interface PickupLocation {
  id: string;
  name: string;
  address: string;
}

/**
 * Order service response types
 */
export interface OrderResponse {
  success: boolean;
  data: Order | null;
  error?: string;
}

export interface OrderListResponse {
  success: boolean;
  data: Order[];
  total?: number;
  error?: string;
}

// ============================================================
// CUSTOMER ARRIVAL TYPES
// ============================================================

/**
 * CustomerArrival - Records when a customer arrives for pickup
 *
 * PURPOSE:
 * When a customer has a pickup order that's ready, they drive to the store
 * and tap "I've Arrived" in the app. This creates a CustomerArrival record
 * that notifies store staff to bring the order out.
 *
 * WHY A SEPARATE COLLECTION?
 * We could have added an "arrivalTime" field to the Order, but a separate
 * collection is better because:
 * 1. Separation of concerns - Orders track order data, Arrivals track arrival data
 * 2. Multiple arrivals possible - Customer might leave and come back
 * 3. Audit trail - Can track arrival history without cluttering Order
 * 4. Real-time subscriptions - Easier to subscribe to new arrivals only
 * 5. Different permissions - Staff might need arrival access but not full order access
 *
 * WHY THESE FIELDS?
 * - orderID: Links to the order being picked up
 * - customerID: Who arrived (for verification)
 * - arrivalTime: When they arrived
 * - status: Tracks if staff has acknowledged/completed the handoff
 * - vehicleDescription: Optional - helps staff find the customer
 * - parkingSpot: Optional - specific location info for curbside
 * - notes: Optional - any special instructions
 */
export type ArrivalStatus = 'waiting' | 'acknowledged' | 'completed';

export interface CustomerArrival extends Models.Document {
  orderID: string;
  customerID: string;
  arrivalTime: string;
  status: ArrivalStatus;
  vehicleDescription?: string;
  parkingSpot?: string;
  notes?: string;
}

/**
 * Data required to create a new arrival notification
 *
 * WHY SEPARATE FROM CustomerArrival?
 * Same pattern as CreateOrderData - we don't want to accidentally
 * include Appwrite document fields ($id, $createdAt) when creating.
 * This type only includes the fields WE provide, not system fields.
 */
export interface CreateArrivalData {
  orderID: string;
  customerID: string;
  arrivalTime: string;
  status: ArrivalStatus;
  vehicleDescription?: string;
  parkingSpot?: string;
  notes?: string;
}

/**
 * Service response types for arrival operations
 *
 * WHY CONSISTENT RESPONSE PATTERN?
 * All our services return { success, data, error } format. This:
 * 1. Makes error handling predictable across the app
 * 2. Allows UI to check success before using data
 * 3. Provides user-friendly error messages
 * 4. TypeScript can narrow the type based on success value
 */
export interface ArrivalResponse {
  success: boolean;
  data: CustomerArrival | null;
  error?: string;
}

export interface ArrivalListResponse {
  success: boolean;
  data: CustomerArrival[];
  error?: string;
}

// ============================================================
// CART TYPES
// ============================================================

/**
 * Cart item extends Product with quantity
 */
export interface CartItem extends Product {
  quantity: number;
}

// ============================================================
// USER TYPES
// ============================================================

/**
 * User role type
 */
export type UserRole = 'customer' | 'shopper';

/**
 * User profile from the Users collection
 * Extends Appwrite's Document type for proper SDK integration
 *
 * WHY customerID AND shopperID?
 * - Appwrite schema requires both fields
 * - customerID is set for customers, empty for shoppers
 * - shopperID is set for shoppers, empty for customers
 * - Allows queries like "find all shoppers" or "find customer by ID"
 */
export interface UserProfile extends Models.Document {
  userID: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  profileImage?: string;
  customerID?: string;
  shopperID?: string;
}

// ============================================================
// AUTH TYPES
// ============================================================

/**
 * Result type for auth operations
 */
export interface AuthResult {
  success: boolean;
  error?: string;
}

/**
 * Profile update data
 */
export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profileImage?: string;
}

// ============================================================
// SERVICE RESPONSE TYPES
// ============================================================

/**
 * Generic service response type for success cases
 */
export interface ServiceResponse<T> {
  success: true;
  data: T;
  total?: number;
}

/**
 * Service error response type
 */
export interface ServiceErrorResponse {
  success: false;
  error: string;
  data: null | [];
}

/**
 * Union type for all service responses
 */
export type ServiceResult<T> = ServiceResponse<T> | ServiceErrorResponse;

/**
 * Product list response
 */
export interface ProductListResponse {
  success: boolean;
  data: Product[];
  total?: number;
  error?: string;
}

/**
 * Single product response
 */
export interface ProductResponse {
  success: boolean;
  data: Product | null;
  error?: string;
}

/**
 * Categories response
 */
export interface CategoriesResponse {
  success: boolean;
  data: string[];
  error?: string;
}

// ============================================================
// NAVIGATION TYPES
// ============================================================

/**
 * Auth stack navigator param list
 */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

/**
 * Main stack navigator param list
 *
 * WHY Checkout: undefined?
 * - Checkout doesn't need params (uses CartContext)
 * - Cart data already available through context
 *
 * WHY OrderConfirmation needs orderId?
 * - Displays order details after creation
 * - Navigation.replace prevents going back (cart is cleared)
 */
export type MainStackParamList = {
  CustomerHome: undefined;
  Cart: undefined;
  Checkout: undefined;
  OrderConfirmation: { orderId: string };
  ProductDetail: { product: Product };
  OrderTracking: { orderId: string };
  Orders: undefined;
  OrderDetail: { orderId: string };
  Profile: undefined;
  TestConnection: undefined;
};

/**
 * Root stack param list (combines auth and main)
 */
export type RootStackParamList = AuthStackParamList & MainStackParamList;

// ============================================================
// CONTEXT TYPES
// ============================================================

/**
 * Auth context type
 */
export interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: UserRole
  ) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<AuthResult>;
  updateProfile: (updates: ProfileUpdateData) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  isCustomer: boolean;
  isShopper: boolean;
}

/**
 * Cart context type
 */
export interface CartContextType {
  cartItems: CartItem[];
  loading: boolean;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, newQuantity: number) => void;
  clearCart: () => Promise<void>;
  getCartTotal: () => number;
  getItemCount: () => number;
  isInCart: (productId: string) => boolean;
  getCartItem: (productId: string) => CartItem | undefined;
}

// ============================================================
// COMPONENT PROP TYPES
// ============================================================

/**
 * ProductCard component props
 */
export interface ProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
}

/**
 * CartItemCard component props
 *
 * WHY separate from ProductCardProps?
 * - Different responsibilities: ProductCard shows product info, CartItemCard manages quantity
 * - CartItemCard needs quantity controls (+/-), ProductCard doesn't
 * - Follows Interface Segregation Principle - interfaces should be specific to use case
 */
export interface CartItemCardProps {
  item: CartItem;
  onQuantityChange: (productId: string, newQuantity: number) => void;
  onRemove: (productId: string) => void;
}

/**
 * CartSummary component props
 *
 * WHY pass values instead of letting component calculate?
 * - Single source of truth (CartContext does calculations)
 * - Component stays pure/presentational (easier to test)
 * - Allows reuse in different contexts (e.g., order confirmation)
 */
export interface CartSummaryProps {
  itemCount: number;
  subtotal: number;
  onCheckout: () => void;
}

/**
 * EmptyCart component props
 *
 * WHY have props for empty state?
 * - Allows customization of message and action
 * - Can be reused for different "empty" scenarios
 * - Follows composition pattern
 */
export interface EmptyCartProps {
  onContinueShopping: () => void;
}

/**
 * FulfillmentTypeSelector component props
 *
 * WHY pass value and onChange separately?
 * - Follows controlled component pattern
 * - Parent manages state (single source of truth)
 * - Component is reusable and testable
 */
export interface FulfillmentTypeSelectorProps {
  value: FulfillmentType;
  onChange: (type: FulfillmentType) => void;
}

/**
 * DeliveryAddressForm component props
 *
 * WHY pass individual fields instead of an object?
 * - More explicit about what fields are needed
 * - Easier to type and validate
 * - Better alignment with React's useState pattern
 */
export interface DeliveryAddressFormProps {
  streetAddress: string;
  onStreetAddressChange: (value: string) => void;
  aptSuite: string;
  onAptSuiteChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  state: string;
  onStateChange: (value: string) => void;
  zipCode: string;
  onZipCodeChange: (value: string) => void;
  deliveryNotes: string;
  onDeliveryNotesChange: (value: string) => void;
}

/**
 * PickupLocationSelector component props
 *
 * WHY pass locations array?
 * - Allows parent to control available locations
 * - Easy to filter/sort locations externally
 * - Component stays pure/presentational
 */
export interface PickupLocationSelectorProps {
  locations: PickupLocation[];
  selectedLocationId: string;
  onLocationSelect: (locationId: string) => void;
}

/**
 * OrderSummaryCard component props
 *
 * WHY pass cartItems instead of just totals?
 * - Displays itemized list of cart contents
 * - Shows quantity and price per item
 * - More detailed than CartSummary
 */
export interface OrderSummaryCardProps {
  cartItems: CartItem[];
  subtotal: number;
}

/**
 * OrderCard component props
 *
 * WHY pass order and onPress?
 * - Displays order summary in list
 * - onPress navigates to order detail
 */
export interface OrderCardProps {
  order: Order;
  onPress: (order: Order) => void;
}

/**
 * OrderStatusBadge component props
 *
 * WHY just status?
 * - Simple visual indicator component
 * - Maps status to color and label
 */
export interface OrderStatusBadgeProps {
  status: OrderStatus;
}

/**
 * OrderTimeline component props
 *
 * WHY pass full order?
 * - Needs status, order date, and potentially shopper info
 * - Timeline shows progression through statuses
 */
export interface OrderTimelineProps {
  order: Order;
}

// ============================================================
// SHOPPER TYPES
// ============================================================

/**
 * Shopper availability status
 *
 * WHY ONLY TWO STATUSES?
 * - Simple binary choice: working or not
 * - Easy for shoppers to understand and toggle
 * - Clear for assignment system (only assign to 'available' shoppers)
 *
 * ALTERNATIVE CONSIDERED:
 * Could have 'busy', 'on_break', 'offline' etc., but:
 * - Adds complexity without much benefit for MVP
 * - Shoppers just need to say "I'm ready for tasks" or "I'm not"
 * - Can extend later if needed
 */
export type ShopperAvailability = 'available' | 'unavailable';

/**
 * Shopper status record from the ShopperStatus collection
 *
 * PURPOSE:
 * Tracks whether a shopper is available for task assignment.
 * This is separate from the User profile because:
 * 1. Status changes frequently (multiple times per shift)
 * 2. Profile data is relatively static (name, phone, etc.)
 * 3. Allows real-time subscriptions to status changes only
 * 4. Different access patterns (status queried often for assignment)
 *
 * WHY THESE FIELDS?
 * - shopperID: Links to the user's account
 * - isAvailable: Boolean availability (true = available for tasks)
 * - currentOrderId: If assigned to an order, which one (empty string if none)
 * - location: Store location the shopper is working at
 * - maxConcurrentOrders: How many orders this shopper can handle at once
 * - lastActiveTimeStamp: When the shopper was last active
 */
export interface ShopperStatus extends Models.Document {
  shopperID: string;
  isAvailable: boolean;
  currentOrderId: string;
  location: string;
  maxConcurrentOrders: number;
  lastActiveTimeStamp: string;
}

/**
 * Data for creating/updating shopper status
 */
export interface UpdateShopperStatusData {
  isAvailable?: boolean;
  currentOrderId?: string;
  location?: string;
  maxConcurrentOrders?: number;
  lastActiveTimeStamp?: string;
}

/**
 * Service response for shopper status operations
 */
export interface ShopperStatusResponse {
  success: boolean;
  data: ShopperStatus | null;
  error?: string;
}

// ============================================================
// SHOPPER DASHBOARD TYPES
// ============================================================

/**
 * Summary data for the shopper dashboard
 *
 * WHY A SEPARATE TYPE?
 * The dashboard needs aggregated counts from multiple sources:
 * - Available tasks count (orders needing shoppers)
 * - Assigned deliveries count (orders ready for delivery)
 * - Customer check-ins count (arrivals waiting)
 *
 * This type represents the data the dashboard displays,
 * not the raw database records. It's a "view model" pattern.
 */
export interface ShopperDashboardData {
  availableTasksCount: number;
  assignedDeliveriesCount: number;
  customerCheckInsCount: number;
}

/**
 * Task card display data
 *
 * WHY NOT JUST USE Order?
 * The task card shows a specific subset of order data plus
 * some computed/derived fields. This type:
 * 1. Documents exactly what the card needs
 * 2. Allows transformation from Order to display format
 * 3. Could include data from multiple sources in future
 */
export interface TaskCardData {
  orderId: string;
  shortOrderId: string;
  itemCount: number;
  uniqueItemCount: number;
  pickedItemCount: number;
  customerName: string;
  shopperName: string;
  fulfillmentType: 'pickup' | 'delivery';
  dueTime?: string;
  status: OrderStatus;
}

// ============================================================
// SHOPPER NAVIGATION TYPES
// ============================================================

/**
 * Shopper stack navigator param list
 *
 * WHY SEPARATE FROM MainStackParamList?
 * - Shoppers and customers have different screens
 * - Different navigation flows
 * - Clearer separation of concerns
 * - Easier to reason about each user type's journey
 *
 * SCREEN PURPOSES:
 * - ShopperHome: Main dashboard (status, current task, quick links)
 * - AvailableTasks: List of orders needing shoppers
 * - DropOffs: Orders ready for delivery
 * - CustomerCheckIns: Customers waiting for pickup
 * - TaskDetail: Details of a specific order/task
 * - ShopperSettings: Shopper preferences
 */
export type ShopperStackParamList = {
  ShopperHome: undefined;
  AvailableTasks: undefined;
  DropOffs: undefined;
  CustomerCheckIns: undefined;
  TaskDetail: { orderId: string };
  ShopperSettings: undefined;
};

// ============================================================
// SHOPPER COMPONENT PROPS
// ============================================================

/**
 * ShopperStatusDropdown component props
 *
 * WHY CONTROLLED COMPONENT PATTERN?
 * - Parent owns the state (single source of truth)
 * - Component is pure/presentational
 * - Easy to test in isolation
 * - Follows React best practices
 */
export interface ShopperStatusDropdownProps {
  status: ShopperAvailability;
  onStatusChange: (status: ShopperAvailability) => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * CurrentTaskCard component props
 *
 * WHY task CAN BE null?
 * - Shopper might not have an assigned task
 * - Component handles both states (has task / no task)
 * - Single component, two visual states
 */
export interface CurrentTaskCardProps {
  task: TaskCardData | null;
  onPress?: (task: TaskCardData) => void;
}

/**
 * QuickLinkCard component props
 *
 * WHY GENERIC DESIGN?
 * Same component used for all three quick links:
 * - Pick Tasks
 * - Drop Offs
 * - Customer Check-ins
 *
 * Benefits:
 * - Consistent visual design
 * - Single component to maintain
 * - Easy to add more links later
 */
export interface QuickLinkCardProps {
  title: string;
  count: number;
  icon: string;
  onPress: () => void;
  subtitle?: string;
}

// ============================================================
// APPWRITE CONFIG TYPES
// ============================================================

/**
 * Appwrite configuration object type
 */
export interface AppwriteConfig {
  databaseId: string;
  usersCollectionId: string;
  productsCollectionId: string;
  ordersCollectionId: string;
  shopperStatusCollectionId: string;
  customerArrivalsCollectionId: string;
  orderQueueCollectionId: string;
  orderMessagesCollectionId: string;
}
