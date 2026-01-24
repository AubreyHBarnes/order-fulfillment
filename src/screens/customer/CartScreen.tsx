/**
 * Cart Screen
 * File: src/screens/customer/CartScreen.tsx
 *
 * PURPOSE: Main shopping cart interface where customers review and manage cart items
 *
 * RESPONSIBILITIES:
 * - Display cart items in scrollable list
 * - Handle quantity changes (+/-)
 * - Handle item removal
 * - Show cart summary (total items, subtotal)
 * - Navigate to checkout
 * - Show empty state when cart is empty
 *
 * WHY THIS STRUCTURE:
 * This is a "Container Component" - it manages state and orchestrates
 * presentational components (CartItemCard, CartSummary, EmptyCart).
 * This separation makes testing easier and components more reusable.
 *
 * FOLLOWS PATTERN FROM: CustomerHomeScreen.tsx
 * - Same Container/Presentational pattern
 * - Same FlatList approach
 * - Same styling organization
 */

import React from 'react';
import { View, FlatList, StyleSheet, ListRenderItemInfo } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCart } from '../../context/CartContext';
import CartItemCard from '../../components/customer/CartItemCard';
import CartSummary from '../../components/customer/CartSummary';
import EmptyCart from '../../components/customer/EmptyCart';
import type { MainStackParamList, CartItem } from '../../types';

/**
 * WHY THESE IMPORTS?
 *
 * React Native components:
 * - View: Container for layout
 * - FlatList: Optimized list for cart items (virtual scrolling)
 * - ListRenderItemInfo: TypeScript type for renderItem
 *
 * React Native Paper components:
 * - ActivityIndicator: Loading spinner while cart loads
 * - Text: Typography (used in loading state)
 *
 * Navigation:
 * - NativeStackScreenProps: Type-safe navigation props
 *
 * Context:
 * - useCart: Access cart state and functions
 *
 * Custom components:
 * - CartItemCard: Displays individual cart item
 * - CartSummary: Shows totals and checkout button
 * - EmptyCart: Empty state when cart has no items
 */

type CartScreenProps = NativeStackScreenProps<MainStackParamList, 'Cart'>;

const CartScreen: React.FC<CartScreenProps> = ({ navigation }) => {
  // ============================================================
  // CONTEXT - ACCESS CART STATE
  // ============================================================

  const {
    cartItems,
    loading,
    updateQuantity,
    removeFromCart,
    getCartTotal,
    getItemCount,
  } = useCart();

  /**
   * WHY DESTRUCTURE MULTIPLE VALUES?
   * - Each value has specific purpose in this screen
   * - cartItems: Data source for FlatList
   * - loading: Show spinner while loading from storage
   * - updateQuantity: For +/- buttons in CartItemCard
   * - removeFromCart: For remove button in CartItemCard
   * - getCartTotal: For CartSummary subtotal
   * - getItemCount: For CartSummary item count
   *
   * ALTERNATIVE: const cart = useCart();
   * Destructuring is clearer about which features we use
   */

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * Handle quantity change from CartItemCard
   *
   * WHY WRAPPER FUNCTION?
   * - Could pass updateQuantity directly to CartItemCard
   * - Wrapper allows adding logic (analytics, validation)
   * - Consistent with other handlers
   * - Easy to modify behavior later
   */
  const handleQuantityChange = (
    productId: string,
    newQuantity: number
  ): void => {
    updateQuantity(productId, newQuantity);
    /**
     * COULD ADD:
     * - Analytics: trackEvent('cart_quantity_changed', { productId, newQuantity })
     * - Haptic feedback: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
     * - Undo toast: showUndoToast('Quantity updated')
     */
  };

  /**
   * Handle item removal from CartItemCard
   *
   * WHY WRAPPER FUNCTION?
   * - Same reasons as handleQuantityChange
   * - Additionally: could show confirmation dialog for expensive items
   * - Could show undo snackbar
   */
  const handleRemoveItem = (productId: string): void => {
    removeFromCart(productId);
    /**
     * COULD ADD:
     * - Analytics: trackEvent('cart_item_removed', { productId })
     * - Undo snackbar: showSnackbar('Item removed', { action: 'Undo', onPress: () => addToCart(item) })
     */
  };

  /**
   * Navigate to checkout
   *
   * WHY SEPARATE FUNCTION?
   * - Clear intent
   * - Place to add pre-checkout validation
   * - Analytics tracking point
   */
  const handleCheckout = (): void => {
    /**
     * WHY navigation.navigate('Checkout')?
     * - Standard navigation to checkout screen
     * - CheckoutScreen handles the rest of the flow
     * - Cart data accessed via CartContext (not params)
     */
    navigation.navigate('Checkout');
  };

  /**
   * Navigate back to shopping (for empty cart)
   *
   * WHY goBack() instead of navigate('CustomerHome')?
   * - goBack respects navigation history
   * - User could have come from different screen
   * - Standard mobile pattern
   */
  const handleContinueShopping = (): void => {
    navigation.goBack();
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  /**
   * Render individual cart item
   *
   * WHY SEPARATE FUNCTION?
   * - FlatList requires renderItem function
   * - Cleaner than inline arrow function
   * - TypeScript types are clearer
   * - Can add conditional rendering logic
   */
  const renderCartItem = ({
    item,
  }: ListRenderItemInfo<CartItem>): React.ReactElement => {
    return (
      <CartItemCard
        item={item}
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemoveItem}
      />
    );
  };

  /**
   * Render empty state
   *
   * WHY SEPARATE FUNCTION?
   * - Used as ListEmptyComponent
   * - Keeps FlatList props clean
   * - Could add conditional logic (e.g., different message if search active)
   */
  const renderEmptyState = (): React.ReactElement | null => {
    /**
     * WHY CHECK LOADING?
     * - Don't show "Your cart is empty" while still loading
     * - Prevents flash of empty state
     * - Show spinner first, then empty state if truly empty
     */
    if (loading) return null;

    return <EmptyCart onContinueShopping={handleContinueShopping} />;
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  /**
   * LOADING STATE
   *
   * WHY EARLY RETURN?
   * - Shows spinner while cart loads from AsyncStorage
   * - Prevents rendering incomplete UI
   * - Only brief - cart loads fast from local storage
   */
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading cart...</Text>
      </View>
    );
  }

  /**
   * WHY NO ERROR STATE?
   * - Cart is local (AsyncStorage), not network
   * - Errors are rare and handled in context
   * - If AsyncStorage fails, cartItems is just empty
   * - Could add error state if we add server-side cart sync
   */

  return (
    <View style={styles.container}>
      {/* ========== CART ITEMS LIST ========== */}
      <FlatList
        /**
         * WHY FLATLIST?
         * - Virtualized list (only renders visible items)
         * - Better performance than ScrollView for long lists
         * - Built-in optimization for large carts
         * - Supports pull-to-refresh (if needed later)
         */
        data={cartItems}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.$id}
        /**
         * WHY item.$id for key?
         * - Appwrite document ID is guaranteed unique
         * - Stable across re-renders (better than index)
         * - Required for React's reconciliation algorithm
         */
        ListEmptyComponent={renderEmptyState}
        /**
         * WHY ListEmptyComponent?
         * - Shows when cartItems is empty
         * - Better UX than blank screen
         * - Guides user to continue shopping
         */
        contentContainerStyle={[
          styles.listContent,
          /**
           * WHY CONDITIONAL STYLE?
           * - If cart is empty, list should fill screen
           * - flexGrow: 1 allows EmptyCart to center vertically
           * - When cart has items, normal padding applies
           */
          cartItems.length === 0 && styles.emptyListContent,
        ]}
      />

      {/* ========== CART SUMMARY (FIXED FOOTER) ========== */}
      {/**
       * WHY CONDITIONAL RENDERING?
       * - Only show summary when cart has items
       * - Empty cart shows EmptyCart component instead
       * - Prevents showing $0.00 checkout (confusing)
       */}
      {cartItems.length > 0 && (
        <CartSummary
          itemCount={getItemCount()}
          subtotal={getCartTotal()}
          onCheckout={handleCheckout}
        />
      )}
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

/**
 * WHY StyleSheet.create()?
 * - Performance: Styles created once, not on every render
 * - Validation: Catches style errors in development
 * - Organization: All styles in one place
 *
 * ORGANIZATION:
 * - Layout styles (container, centerContainer)
 * - List styles (listContent, emptyListContent)
 * - State styles (loadingText)
 */
const styles = StyleSheet.create({
  // ===== LAYOUT =====
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    /**
     * WHY flex: 1?
     * - Takes all available screen space
     * - Allows FlatList to scroll
     * - CartSummary can position at bottom
     *
     * WHY gray background?
     * - Creates contrast with white cards
     * - Standard for list screens
     * - Matches CustomerHomeScreen
     */
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    /**
     * WHY centered container?
     * - For loading state
     * - Spinner and text in middle of screen
     * - Consistent with CustomerHomeScreen loading
     */
  },

  // ===== LIST =====
  listContent: {
    paddingTop: 8,
    paddingBottom: 16,
    /**
     * WHY padding?
     * - Space at top before first item
     * - Space at bottom so last item isn't hidden by CartSummary
     * - Visual breathing room
     */
  },

  emptyListContent: {
    flexGrow: 1,
    /**
     * WHY flexGrow: 1?
     * - Makes empty list fill available space
     * - Allows EmptyCart to center vertically
     * - Only applied when cart is empty
     */
  },

  // ===== STATES =====
  loadingText: {
    marginTop: 16,
    color: '#757575',
    /**
     * WHY gray text?
     * - Secondary importance to spinner
     * - Consistent with other loading states
     */
  },
});

export default CartScreen;
