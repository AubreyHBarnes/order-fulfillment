/**
 * Appwrite Service Configuration
 * File: src/services/appwrite.ts
 *
 * This file sets up the Appwrite client and exports
 * the services we'll use throughout the app
 */

import { Client, Account, Databases, Storage, Query } from 'appwrite';
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_DATABASE_ID,
  APPWRITE_USERS_COLLECTION_ID,
  APPWRITE_PRODUCTS_COLLECTION_ID,
  APPWRITE_ORDERS_COLLECTION_ID,
  APPWRITE_SHOPPER_STATUS_COLLECTION_ID,
  APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID,
  APPWRITE_ORDER_QUEUE_COLLECTION_ID,
  APPWRITE_ORDER_MESSAGES_COLLECTION_ID,
} from '@env';
import type { AppwriteConfig } from '../types';

// Initialize Appwrite Client
const client = new Client();

client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);

// Initialize services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Export the client for real-time subscriptions
export default client;

// Export configuration constants
export const config: AppwriteConfig = {
  databaseId: APPWRITE_DATABASE_ID,
  usersCollectionId: APPWRITE_USERS_COLLECTION_ID,
  productsCollectionId: APPWRITE_PRODUCTS_COLLECTION_ID,
  ordersCollectionId: APPWRITE_ORDERS_COLLECTION_ID,
  shopperStatusCollectionId: APPWRITE_SHOPPER_STATUS_COLLECTION_ID,
  customerArrivalsCollectionId: APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID,
  orderQueueCollectionId: APPWRITE_ORDER_QUEUE_COLLECTION_ID,
  orderMessagesCollectionId: APPWRITE_ORDER_MESSAGES_COLLECTION_ID,
};

// Export Query for easy access
export { Query };
