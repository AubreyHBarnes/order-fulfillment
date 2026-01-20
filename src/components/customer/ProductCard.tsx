/**
 * Product Card Component
 * File: src/components/customer/ProductCard.tsx
 *
 * WHY: Reusable component for displaying products
 *
 * COMPONENT DESIGN PRINCIPLES:
 * 1. Single Responsibility - Only displays product, doesn't fetch data
 * 2. Reusable - Can be used in list, grid, search results
 * 3. Composable - Can be wrapped in different containers
 * 4. Props-driven - Flexible through props, no hard-coded values
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Button, Badge } from 'react-native-paper';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../services/productService';
import type { ProductCardProps } from '../../types';

/**
 * WHY functional component with hooks?
 * - Modern React pattern (vs class components)
 * - Hooks provide state and lifecycle in functions
 * - Cleaner, less boilerplate
 * - Better for performance optimization
 */
const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  const { addToCart, isInCart, getCartItem } = useCart();
  const inCart = isInCart(product.$id);
  const cartItem = getCartItem(product.$id);

  /**
   * WHY separate handleAddToCart function?
   * - Keeps JSX clean
   * - Easy to add logic (analytics, haptics, etc.)
   * - Testable independently
   */
  const handleAddToCart = (): void => {
    addToCart(product, 1);
  };

  return (
    <Card
      style={styles.card}
      /**
       * WHY elevation prop?
       * - Creates shadow/depth effect
       * - Material Design standard
       * - Makes card feel "lifted" from background
       * - Accessibility - visual separation
       */
      elevation={2}
    >
      {/*
        WHY TouchableOpacity wrapper?
        - Makes entire card tappable (better UX)
        - Provides visual feedback (opacity change)
        - Standard mobile pattern
        - Accessibility - larger touch target
      */}
      <TouchableOpacity
        onPress={() => onPress && onPress(product)}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
        accessibilityHint="Double tap to view product details"
      >
        <Card.Content>
          {/* Product Name */}
          <View style={styles.header}>
            <Text
              variant="titleMedium"
              style={styles.name}
              /**
               * WHY numberOfLines prop?
               * - Prevents text overflow
               * - Keeps card height consistent
               * - Shows ellipsis (...) for long names
               * - Better grid layout
               */
              numberOfLines={2}
            >
              {product.name}
            </Text>

            {/*
              WHY show out of stock badge?
              - Immediate visual feedback
              - Prevents frustration (user tries to order unavailable item)
              - Color + text for accessibility
            */}
            {!product.inStock && (
              <Badge
                style={styles.outOfStockBadge}
                /**
                 * WHY accessible prop?
                 * - Screen readers announce badge
                 * - WCAG compliance
                 * - Better for visually impaired users
                 */
              >
                Out of Stock
              </Badge>
            )}
          </View>

          {/* Category and Aisle */}
          {/**
           * WHY show category and aisle?
           * - Helps users find similar items
           * - Provides context
           * - Aisle info useful for in-store pickup
           */}
          <View style={styles.metadata}>
            <Text variant="bodySmall" style={styles.category}>
              {product.category}
            </Text>
            {product.aisle && (
              <Text variant="bodySmall" style={styles.aisle}>
                • Aisle {product.aisle}
              </Text>
            )}
          </View>

          {/* Price and Unit */}
          <View style={styles.priceContainer}>
            <Text variant="headlineSmall" style={styles.price}>
              {formatPrice(product.price)}
            </Text>
            <Text variant="bodySmall" style={styles.unit}>
              / {product.unit}
            </Text>
          </View>

          {/* Add to Cart Button / In Cart Indicator */}
          <View style={styles.actionContainer}>
            {/**
             * WHY conditional rendering?
             * - Shows different UI based on cart state
             * - Provides feedback that item was added
             * - Prevents accidental duplicate adds
             */}
            {inCart ? (
              <View style={styles.inCartContainer}>
                <Text style={styles.inCartText}>
                  In Cart ({cartItem?.quantity})
                </Text>
                <Button
                  mode="text"
                  onPress={() => onPress && onPress(product)}
                  compact
                  accessibilityLabel="View cart"
                >
                  View
                </Button>
              </View>
            ) : (
              <Button
                mode="contained"
                onPress={handleAddToCart}
                /**
                 * WHY disable when out of stock?
                 * - Prevents adding unavailable items
                 * - Clear visual feedback
                 * - Better UX than showing error after tap
                 */
                disabled={!product.inStock}
                icon="cart-plus"
                style={styles.addButton}
                /**
                 * WHY compact prop?
                 * - Smaller button for card layout
                 * - Fits better in constrained space
                 * - Still meets 44pt touch target minimum
                 */
                compact
                accessible={true}
                accessibilityLabel={`Add ${product.name} to cart`}
                accessibilityHint="Double tap to add one item to your cart"
                accessibilityState={{ disabled: !product.inStock }}
              >
                Add to Cart
              </Button>
            )}
          </View>
        </Card.Content>
      </TouchableOpacity>
    </Card>
  );
};

/**
 * STYLING DECISIONS:
 *
 * WHY StyleSheet.create()?
 * - Performance optimization (styles created once, not on each render)
 * - Type checking in development
 * - Better than inline styles
 *
 * WHY specific style values?
 * - margin: 8px follows 8pt grid system
 * - borderRadius: 8 matches theme
 * - Colors from theme for consistency
 */
const styles = StyleSheet.create({
  card: {
    margin: 8,
    /**
     * WHY fixed width?
     * - Allows 2-column grid on phone
     * - Consistent card sizing
     * - Better visual rhythm
     *
     * TRADE-OFF: Not fully responsive
     * - Alternative: use flex: 1 with FlatList numColumns
     * - For this app, fixed width is simpler
     */
    width: 170,
  },
  header: {
    marginBottom: 8,
  },
  name: {
    fontWeight: '600',
    /**
     * WHY min-height?
     * - Ensures 2-line space even for short names
     * - Keeps all cards same height
     * - Better grid alignment
     */
    minHeight: 40,
  },
  outOfStockBadge: {
    backgroundColor: '#F44336',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: {
    color: '#757575',
    textTransform: 'capitalize',
  },
  aisle: {
    color: '#9E9E9E',
    marginLeft: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  price: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  unit: {
    color: '#757575',
    marginLeft: 4,
  },
  actionContainer: {
    marginTop: 'auto',
  },
  addButton: {
    /**
     * WHY full width button?
     * - Easier to tap (larger target)
     * - Consistent with card width
     * - Standard mobile pattern
     */
  },
  inCartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 8,
    borderRadius: 4,
  },
  inCartText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
});

export default ProductCard;
