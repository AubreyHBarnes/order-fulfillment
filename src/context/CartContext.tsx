/**
 * Shopping Cart Context
 * File: src/context/CartContext.tsx
 *
 * WHY: Global state management for shopping cart
 *
 * DECISION: React Context vs Redux vs other state management
 *
 * WHY React Context?
 * 1. Built-in - No additional dependencies
 * 2. Simple - Cart state is straightforward, no complex actions
 * 3. Sufficient - Cart is accessed by multiple screens (Home, Cart, Checkout)
 * 4. Performant - Cart updates are infrequent (user actions, not real-time data)
 *
 * WHEN to use Redux instead?
 * - Very complex state with many actions
 * - Need middleware (logging, async actions)
 * - Time-travel debugging
 * - Very large team needing strict patterns
 */

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartContextType, CartItem, Product } from '../types';

/**
 * WHY AsyncStorage?
 * - Persists cart between app closes
 * - Better UX - User doesn't lose cart if app crashes
 * - Mobile best practice - Users expect cart persistence
 */

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = '@grocery_cart';

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Load cart from storage on app start
   *
   * WHY useEffect with empty dependency array?
   * - Runs once on mount (like componentDidMount)
   * - Loads saved cart when app opens
   */
  useEffect(() => {
    loadCart();
  }, []);

  /**
   * Save cart whenever it changes
   *
   * WHY useEffect with cartItems dependency?
   * - Auto-saves whenever cart updates
   * - User never loses their cart
   * - No need to remember to call saveCart()
   */
  useEffect(() => {
    if (!loading) {
      // WHY check loading?
      // - Prevents saving during initial load
      // - Avoids overwriting saved cart with empty state
      saveCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems]);

  const loadCart = async (): Promise<void> => {
    try {
      const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        setCartItems(JSON.parse(savedCart) as CartItem[]);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCart = async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  /**
   * Add item to cart
   *
   * WHY check if item exists?
   * - Update quantity if already in cart
   * - Prevents duplicate entries
   * - Better UX than having same product listed twice
   */
  const addToCart = useCallback(
    (product: Product, quantity: number = 1): void => {
      setCartItems((prevItems) => {
        // Check if product already in cart
        const existingItem = prevItems.find(
          (item) => item.$id === product.$id
        );

        if (existingItem) {
          // WHY map instead of direct mutation?
          // - React requires immutability for state updates
          // - Creates new array reference
          // - Triggers re-render properly
          return prevItems.map((item) =>
            item.$id === product.$id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }

        // Add new item
        // WHY spread operator {...product}?
        // - Creates copy of product
        // - Prevents mutating original product object
        // - Adds quantity property to copy
        return [...prevItems, { ...product, quantity }];
      });
    },
    []
  );

  /**
   * Remove item from cart
   *
   * WHY filter?
   * - Creates new array without the item
   * - Immutable operation
   * - Clean, functional approach
   */
  const removeFromCart = useCallback((productId: string): void => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.$id !== productId)
    );
  }, []);

  /**
   * Update item quantity
   *
   * WHY remove if quantity <= 0?
   * - Prevents negative quantities
   * - Cleaner than keeping zero-quantity items
   * - Better UX
   */
  const updateQuantity = useCallback(
    (productId: string, newQuantity: number): void => {
      if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
      }

      setCartItems((prevItems) =>
        prevItems.map((item) =>
          item.$id === productId ? { ...item, quantity: newQuantity } : item
        )
      );
    },
    [removeFromCart]
  );

  /**
   * Clear entire cart
   *
   * WHY separate function?
   * - Used after order completion
   * - Clear intent
   * - Single place to add post-clear logic later
   */
  const clearCart = useCallback(async (): Promise<void> => {
    setCartItems([]);
    try {
      await AsyncStorage.removeItem(CART_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  }, []);

  /**
   * Calculate cart totals
   *
   * WHY use reduce?
   * - Functional programming pattern
   * - Transforms array into single value
   * - More elegant than for loop
   * - Standard approach in React
   */
  const getCartTotal = useCallback((): number => {
    return cartItems.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);
  }, [cartItems]);

  const getItemCount = useCallback((): number => {
    return cartItems.reduce((count, item) => {
      return count + item.quantity;
    }, 0);
  }, [cartItems]);

  /**
   * Check if product is in cart
   *
   * WHY helper function?
   * - Used for UI (show "In Cart" vs "Add to Cart")
   * - Encapsulates logic
   * - Easy to change implementation
   */
  const isInCart = useCallback(
    (productId: string): boolean => {
      return cartItems.some((item) => item.$id === productId);
    },
    [cartItems]
  );

  const getCartItem = useCallback(
    (productId: string): CartItem | undefined => {
      return cartItems.find((item) => item.$id === productId);
    },
    [cartItems]
  );

  /**
   * WHY expose all these values/functions?
   * - Components can access what they need
   * - Follows Interface Segregation Principle
   * - Flexible for different use cases
   */
  const value: CartContextType = {
    cartItems,
    loading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getItemCount,
    isInCart,
    getCartItem,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

/**
 * Custom hook for using cart
 *
 * WHY custom hook?
 * - Cleaner import: useCart() vs useContext(CartContext)
 * - Error handling - prevents using outside provider
 * - Standard React pattern
 * - Better developer experience
 */
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
