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
 */
export interface UserProfile extends Models.Document {
  userID: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  profileImage?: string;
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
