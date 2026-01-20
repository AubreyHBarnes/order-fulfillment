/**
 * Product Service
 * File: src/services/productService.ts
 *
 * WHY: Separating data fetching logic from UI components
 *
 * BENEFITS:
 * 1. Reusability - Multiple components can use the same functions
 * 2. Testability - Easy to unit test data logic separately from UI
 * 3. Maintainability - If Appwrite API changes, update in one place
 * 4. Single Responsibility - Service handles data, components handle UI
 */

import { databases, config, Query } from './appwrite';
import type {
  Product,
  ProductListResponse,
  ProductResponse,
  CategoriesResponse,
} from '../types';

/**
 * Fetch all products from database
 *
 * WHY use queries parameter?
 * - Allows filtering, sorting, pagination from the caller
 * - Flexible for different use cases (search, category filter, etc.)
 * - Follows Open/Closed Principle - function is open for extension
 */
export const getAllProducts = async (
  queries: string[] = []
): Promise<ProductListResponse> => {
  try {
    const response = await databases.listDocuments<Product>(
      config.databaseId,
      config.productsCollectionId,
      queries
    );
    return {
      success: true,
      data: response.documents,
      total: response.total,
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      data: [],
    };
  }
};

/**
 * Get products by category
 *
 * WHY separate function instead of just using getAllProducts?
 * - Clearer intent - caller's intention is obvious
 * - Encapsulation - Hides Query implementation details
 * - Future-proof - Can add category-specific logic later
 */
export const getProductsByCategory = async (
  category: string
): Promise<ProductListResponse> => {
  const queries = [Query.equal('category', category)];
  return await getAllProducts(queries);
};

/**
 * Search products by name
 *
 * WHY use search() instead of contains()?
 * - search() is full-text search, faster for large datasets
 * - Handles multiple words, partial matches better
 * - Case-insensitive by default
 */
export const searchProducts = async (
  searchTerm: string
): Promise<ProductListResponse> => {
  if (!searchTerm || searchTerm.trim() === '') {
    return await getAllProducts();
  }

  const queries = [Query.search('name', searchTerm)];
  return await getAllProducts(queries);
};

/**
 * Get a single product by ID
 *
 * WHY separate function for single product?
 * - Different API call (getDocument vs listDocuments)
 * - More efficient than filtering a list
 * - Used for product detail views
 */
export const getProductById = async (
  productId: string
): Promise<ProductResponse> => {
  try {
    const product = await databases.getDocument<Product>(
      config.databaseId,
      config.productsCollectionId,
      productId
    );
    return {
      success: true,
      data: product,
    };
  } catch (error) {
    console.error('Error fetching product:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      data: null,
    };
  }
};

/**
 * Get products with pagination
 *
 * WHY pagination?
 * - Performance - Don't load 1000 products at once
 * - User Experience - Faster initial load, smooth scrolling
 * - Data costs - Less bandwidth usage on mobile
 * - Best Practice - Standard for lists with many items
 */
export const getProductsPaginated = async (
  page: number = 1,
  limit: number = 20,
  category: string | null = null
): Promise<ProductListResponse> => {
  const offset = (page - 1) * limit;

  const queries = [
    Query.limit(limit),
    Query.offset(offset),
    Query.orderAsc('name'), // Alphabetical order
  ];

  // Add category filter if provided
  if (category) {
    queries.push(Query.equal('category', category));
  }

  return await getAllProducts(queries);
};

/**
 * Get all unique categories
 *
 * WHY fetch categories separately?
 * - Used for filter UI (category buttons/dropdown)
 * - Could be cached to avoid repeated queries
 * - In production, you might have a separate Categories collection
 */
export const getCategories = async (): Promise<CategoriesResponse> => {
  try {
    // Get all products and extract unique categories
    // WHY this approach?
    // - Simple for small datasets (your 30 products)
    // - In production with 10,000+ products, you'd want a Categories collection
    const response = await databases.listDocuments<Product>(
      config.databaseId,
      config.productsCollectionId,
      [Query.limit(100)] // Get enough to find all categories
    );

    // Extract unique categories using Set
    // WHY Set?
    // - Automatically removes duplicates
    // - O(1) lookup time
    // - Clean, readable code
    const categories = [
      ...new Set(response.documents.map((p) => p.category)),
    ];

    return {
      success: true,
      data: categories.sort(), // Alphabetical order
    };
  } catch (error) {
    console.error('Error fetching categories:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      data: [],
    };
  }
};

/**
 * Check if product is in stock
 *
 * WHY separate function for simple boolean?
 * - Encapsulates business logic
 * - Single source of truth for "in stock" definition
 * - Easy to extend (e.g., check quantity threshold later)
 */
export const isProductInStock = (product: Product | null): boolean => {
  return product?.inStock === true;
};

/**
 * Format product price for display
 *
 * WHY formatting function?
 * - Consistent price display across app
 * - Handles currency, decimals uniformly
 * - Easy to internationalize later
 */
export const formatPrice = (price: number): string => {
  return `$${price.toFixed(2)}`;
};
