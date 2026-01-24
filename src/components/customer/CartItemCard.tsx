/**
 * Cart Item Card Component
 * File: src/components/customer/CartItemCard.tsx
 *
 * WHY: Displays a single cart item with quantity controls
 *
 * COMPONENT DESIGN PRINCIPLES:
 * 1. Single Responsibility - Displays one cart item and handles quantity changes
 * 2. Presentational - Receives data and callbacks via props
 * 3. Controlled - Parent manages state, this component just renders and calls back
 * 4. Accessible - Full screen reader support for all interactive elements
 *
 * FOLLOWS PATTERN FROM: ProductCard.tsx
 * - Same file structure and commenting style
 * - Same accessibility approach
 * - Same StyleSheet organization
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, IconButton } from 'react-native-paper';
import { formatPrice } from '../../services/productService';
import type { CartItemCardProps } from '../../types';

/**
 * WHY functional component with typed props?
 * - TypeScript ensures type safety
 * - Props interface documents expected inputs
 * - React.FC provides children typing (though we don't use it here)
 * - Consistent with codebase pattern
 */
const CartItemCard: React.FC<CartItemCardProps> = ({
  item,
  onQuantityChange,
  onRemove,
}) => {
  /**
   * WHY calculate subtotal here?
   * - Derived value (price * quantity)
   * - Recalculates when item changes (which it should)
   * - Keeps render logic close to display
   * - Could memoize with useMemo if performance becomes issue
   */
  const subtotal = item.price * item.quantity;

  /**
   * WHY separate handler functions?
   * - Cleaner JSX
   * - Can add logic later (e.g., haptic feedback, analytics)
   * - Testable independently
   * - Clear intent for each action
   */
  const handleIncrement = (): void => {
    onQuantityChange(item.$id, item.quantity + 1);
  };

  const handleDecrement = (): void => {
    /**
     * WHY check quantity > 1?
     * - Prevent going to 0 via decrement
     * - If quantity becomes 0, use remove button instead
     * - Better UX - decrement to 1, then must explicitly remove
     * - Prevents accidental removal
     */
    if (item.quantity > 1) {
      onQuantityChange(item.$id, item.quantity - 1);
    }
  };

  const handleRemove = (): void => {
    onRemove(item.$id);
  };

  return (
    <Card
      style={styles.card}
      /**
       * WHY elevation={1}?
       * - Subtle shadow (less than ProductCard's 2)
       * - Cart items are in a list, don't need to stand out as much
       * - Material Design hierarchy
       */
      elevation={1}
    >
      <Card.Content style={styles.content}>
        {/* ========== PRODUCT INFO SECTION ========== */}
        <View style={styles.infoSection}>
          <Text
            variant="titleMedium"
            style={styles.productName}
            numberOfLines={2}
            /**
             * WHY numberOfLines={2}?
             * - Prevents very long names from breaking layout
             * - Shows ellipsis (...) for truncated names
             * - Consistent card heights in list
             */
          >
            {item.name}
          </Text>

          <Text variant="bodySmall" style={styles.pricePerUnit}>
            {formatPrice(item.price)} / {item.unit}
          </Text>
        </View>

        {/* ========== QUANTITY CONTROLS SECTION ========== */}
        {/**
         * WHY separate section for quantity?
         * - Visual grouping of related controls
         * - Easier to style as a unit
         * - Clear separation from product info
         */}
        <View style={styles.quantitySection}>
          <View style={styles.quantityControls}>
            <IconButton
              icon="minus"
              mode="outlined"
              size={20}
              onPress={handleDecrement}
              disabled={item.quantity <= 1}
              /**
               * WHY disable at quantity 1?
               * - Can't go below 1 with decrement
               * - Visual feedback that action is unavailable
               * - Use remove button to delete item entirely
               */
              style={styles.quantityButton}
              accessible={true}
              accessibilityLabel={`Decrease quantity of ${item.name}`}
              accessibilityHint={
                item.quantity > 1
                  ? `Current quantity is ${item.quantity}. Double tap to decrease to ${item.quantity - 1}`
                  : 'Quantity is at minimum. Use remove button to delete item'
              }
              accessibilityState={{ disabled: item.quantity <= 1 }}
            />

            <Text
              variant="titleMedium"
              style={styles.quantityText}
              accessible={true}
              accessibilityLabel={`Quantity: ${item.quantity}`}
            >
              {item.quantity}
            </Text>

            <IconButton
              icon="plus"
              mode="outlined"
              size={20}
              onPress={handleIncrement}
              style={styles.quantityButton}
              accessible={true}
              accessibilityLabel={`Increase quantity of ${item.name}`}
              accessibilityHint={`Current quantity is ${item.quantity}. Double tap to increase to ${item.quantity + 1}`}
            />
          </View>
        </View>

        {/* ========== SUBTOTAL AND REMOVE SECTION ========== */}
        <View style={styles.subtotalSection}>
          <Text
            variant="titleMedium"
            style={styles.subtotal}
            accessible={true}
            accessibilityLabel={`Subtotal: ${formatPrice(subtotal)}`}
          >
            {formatPrice(subtotal)}
          </Text>

          <IconButton
            icon="trash-can-outline"
            mode="text"
            size={24}
            onPress={handleRemove}
            iconColor="#F44336"
            /**
             * WHY red color for remove?
             * - Universal indicator for destructive action
             * - Draws attention (this action removes item)
             * - Standard UX pattern
             */
            style={styles.removeButton}
            accessible={true}
            accessibilityLabel={`Remove ${item.name} from cart`}
            accessibilityHint="Double tap to remove this item from your cart"
            accessibilityRole="button"
          />
        </View>
      </Card.Content>
    </Card>
  );
};

/**
 * STYLING DECISIONS:
 *
 * WHY flexDirection: row layout?
 * - Compact display for list items
 * - All info visible at once
 * - Standard shopping cart pattern
 *
 * WHY specific spacing values?
 * - margin: 8 follows 8pt grid system
 * - padding: 12 balances content density
 * - marginHorizontal: 16 aligns with screen edges
 */
const styles = StyleSheet.create({
  // ===== CARD CONTAINER =====
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    /**
     * WHY marginHorizontal instead of margin?
     * - Card stretches full width (minus margins)
     * - Different from ProductCard which has fixed width
     * - List items should span available space
     */
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    /**
     * WHY flexDirection: row?
     * - Horizontal layout: info | quantity | subtotal
     * - Maximizes use of horizontal space
     * - Standard list item pattern
     */
  },

  // ===== PRODUCT INFO =====
  infoSection: {
    flex: 1,
    marginRight: 12,
    /**
     * WHY flex: 1?
     * - Takes available space after quantity and subtotal
     * - Allows product name to wrap if needed
     * - Flexible layout
     */
  },

  productName: {
    fontWeight: '600',
    marginBottom: 4,
    /**
     * WHY fontWeight: 600?
     * - Emphasizes product name
     * - Clear visual hierarchy
     * - Matches ProductCard pattern
     */
  },

  pricePerUnit: {
    color: '#757575',
    /**
     * WHY gray color?
     * - Secondary information
     * - Less prominent than name
     * - Standard for supplementary text
     */
  },

  // ===== QUANTITY CONTROLS =====
  quantitySection: {
    marginRight: 12,
    /**
     * WHY separate section?
     * - Groups quantity controls visually
     * - Clear separation between info and controls
     */
  },

  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    /**
     * WHY row layout?
     * - [-] [qty] [+] pattern is standard
     * - Intuitive stepper control
     * - Thumb-friendly on mobile
     */
  },

  quantityButton: {
    margin: 0,
    /**
     * WHY margin: 0?
     * - IconButton has default margin
     * - Remove it for tighter grouping
     * - Keeps controls together as a unit
     */
  },

  quantityText: {
    minWidth: 32,
    textAlign: 'center',
    fontWeight: '600',
    /**
     * WHY minWidth: 32?
     * - Ensures consistent width for 1-99 quantities
     * - Prevents layout shift when quantity changes
     * - Centers text properly
     */
  },

  // ===== SUBTOTAL AND REMOVE =====
  subtotalSection: {
    alignItems: 'flex-end',
    /**
     * WHY alignItems: flex-end?
     * - Right-aligns subtotal and remove button
     * - Standard for monetary values
     * - Creates clean right edge
     */
  },

  subtotal: {
    fontWeight: 'bold',
    color: '#007AFF',
    /**
     * WHY blue color?
     * - Matches price styling from ProductCard
     * - Brand consistency
     * - Draws attention to monetary value
     */
  },

  removeButton: {
    margin: 0,
    marginTop: 4,
    /**
     * WHY small marginTop?
     * - Separates from subtotal
     * - Prevents accidental taps
     * - Visual breathing room
     */
  },
});

export default CartItemCard;
