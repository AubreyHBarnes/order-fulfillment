/**
 * Environment Variable Type Declarations
 * File: src/types/env.d.ts
 *
 * Declares types for environment variables loaded from @env
 * These are loaded by react-native-dotenv
 */

declare module '@env' {
  export const APPWRITE_ENDPOINT: string;
  export const APPWRITE_PROJECT_ID: string;
  export const APPWRITE_DATABASE_ID: string;
  export const APPWRITE_USERS_COLLECTION_ID: string;
  export const APPWRITE_PRODUCTS_COLLECTION_ID: string;
  export const APPWRITE_ORDERS_COLLECTION_ID: string;
  export const APPWRITE_SHOPPER_STATUS_COLLECTION_ID: string;
  export const APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID: string;
  export const APPWRITE_ORDER_QUEUE_COLLECTION_ID: string;
  export const APPWRITE_ORDER_MESSAGES_COLLECTION_ID: string;
}
