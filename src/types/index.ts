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
 */
export type MainStackParamList = {
  CustomerHome: undefined;
  Cart: undefined;
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
