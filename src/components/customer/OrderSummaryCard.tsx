/**
 * Order Summary Card Component
 * File: src/components/customer/OrderSummaryCard.tsx
 *
 * PURPOSE: Displays cart items and subtotal for checkout review
 *
 * UI LAYOUT:
 * - Section header "Order Summary"
 * - List of items with quantity and price
 * - Divider line
 * - Subtotal row
 *
 * WHY SEPARATE FROM CartSummary?
 * - CartSummary is a fixed footer with checkout button
 * - OrderSummaryCard is a scrollable section showing item details
 * - Different use cases, different UI needs
 *
 * FOLLOWS PATTERN FROM: CartItemCard (item display), CartSummary (totals)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { OrderSummaryCardProps, CartItem } from '../../types';
import { formatPrice } from '../../services/productService';

/**
 * WHY THESE IMPORTS?
 * - View: Container layouts
 * - Text: Display item names, quantities, prices
 * - StyleSheet: Optimized styles
 * - Types: Prop types and CartItem
 * - formatPrice: Consistent price formatting ($X.XX)
 */

const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({
  cartItems,
  subtotal,
}) => {
  /**
   * WHY THESE PROPS?
   * - cartItems: Array of items to display
   * - subtotal: Pre-calculated total (parent does calculation)
   *
   * WHY PASS SUBTOTAL INSTEAD OF CALCULATING?
   * - Single source of truth (CartContext)
   * - Avoids recalculation
   * - Parent may apply discounts, fees later
   */

  /**
   * Render a single item row
   *
   * WHY SEPARATE FUNCTION?
   * - Cleaner JSX in main render
   * - Could extract to own component if needed
   * - Clear responsibility
   */
  const renderItemRow = (item: CartItem): React.ReactElement => {
    /**
     * WHY CALCULATE LINE TOTAL HERE?
     * - Display needs: "3x Milk    $11.97"
     * - quantity × price per item
     * - Simple calculation, OK to do inline
     */
    const lineTotal = item.price * item.quantity;

    return (
      <View key={item.$id} style={styles.itemRow}>
        <View style={styles.itemInfo}>
          {/* Quantity + Name: "3x Milk" */}
          <Text style={styles.itemText}>
            {item.quantity}x {item.name}
          </Text>
        </View>
        {/* Line total: "$11.97" */}
        <Text style={styles.itemPrice}>{formatPrice(lineTotal)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ========== SECTION HEADER ========== */}
      <Text style={styles.sectionLabel}>Order Summary</Text>

      {/* ========== ITEMS CARD ========== */}
      <View style={styles.card}>
        {/* ===== ITEM ROWS ===== */}
        {/**
         * WHY MAP NOT FLATLIST?
         * - Typically small list (< 20 items)
         * - Inside ScrollView already
         * - Nested FlatList causes issues
         * - Simple map is fine here
         */}
        {cartItems.map(renderItemRow)}

        {/* ===== DIVIDER ===== */}
        <View style={styles.divider} />

        {/* ===== SUBTOTAL ROW ===== */}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal</Text>
          <Text style={styles.subtotalAmount}>{formatPrice(subtotal)}</Text>
        </View>

        {/**
         * FUTURE ADDITIONS:
         * - Delivery fee row (if delivery selected)
         * - Tax row
         * - Discount/coupon row
         * - Final total row
         *
         * WHY NOT NOW?
         * - MVP focuses on core flow
         * - Easy to add later
         * - Keep it simple for now
         */}
      </View>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    /**
     * WHY SAME AS OTHER CHECKOUT COMPONENTS?
     * - Consistent section headers
     * - Visual rhythm
     */
  },

  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    /**
     * WHY CARD STYLE?
     * - Groups order items visually
     * - Matches other checkout cards
     * - Clean separation from other sections
     */
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    /**
     * WHY THESE VALUES?
     * - Row layout: name on left, price on right
     * - Vertical padding for spacing
     * - alignItems center for text alignment
     */
  },

  itemInfo: {
    flex: 1,
    marginRight: 16,
    /**
     * WHY flex: 1?
     * - Takes available space before price
     * - Allows long names to wrap
     *
     * WHY marginRight?
     * - Prevents text touching price
     */
  },

  itemText: {
    fontSize: 15,
    color: '#333',
    /**
     * WHY THESE VALUES?
     * - Readable size
     * - Good contrast
     */
  },

  itemPrice: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    /**
     * WHY fontWeight: '500'?
     * - Slight emphasis on price
     * - Not as bold as subtotal
     * - Visual hierarchy
     */
  },

  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
    /**
     * WHY DIVIDER?
     * - Separates items from subtotal
     * - Standard receipt/summary pattern
     * - Visual break
     */
  },

  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    /**
     * WHY SAME AS ITEM ROW?
     * - Consistent layout
     * - Label left, amount right
     */
  },

  subtotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    /**
     * WHY LARGER AND BOLDER?
     * - Emphasis on total
     * - Hierarchy: subtotal > items
     */
  },

  subtotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    /**
     * WHY LARGEST AND BOLDEST?
     * - Most important number
     * - User's key concern
     * - Clear visual prominence
     */
  },
});

export default OrderSummaryCard;
