/**
 * Cart Summary Component
 * File: src/components/customer/CartSummary.tsx
 *
 * WHY: Fixed footer showing cart totals and checkout button
 *
 * COMPONENT DESIGN PRINCIPLES:
 * 1. Single Responsibility - Only displays summary and checkout CTA
 * 2. Presentational - Receives values via props, no calculations
 * 3. Pure - Same props always render same output
 * 4. Accessible - Proper labels for screen readers
 *
 * POSITIONING:
 * - Fixed at bottom of screen (positioned by parent)
 * - Always visible regardless of scroll position
 * - WHY? User should always see total and checkout option
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Button, Divider } from 'react-native-paper';
import { formatPrice } from '../../services/productService';
import type { CartSummaryProps } from '../../types';

/**
 * WHY receive values as props instead of using useCart()?
 * 1. Component stays pure/presentational
 * 2. Easier to test (no context dependency)
 * 3. Single source of truth (parent calculates)
 * 4. Could reuse for order confirmation (different data source)
 */
const CartSummary: React.FC<CartSummaryProps> = ({
  itemCount,
  subtotal,
  onCheckout,
}) => {
  return (
    <Surface
      style={styles.container}
      /**
       * WHY Surface component?
       * - Material Design elevated surface
       * - Built-in shadow/elevation handling
       * - Responds to theme
       * - Better than plain View for elevated content
       */
      elevation={4}
      /**
       * WHY elevation={4}?
       * - Higher than cards (2) to indicate it's above content
       * - Creates clear visual separation from list
       * - Material Design standard for bottom sheets/footers
       */
    >
      {/* ========== SUMMARY DETAILS ========== */}
      <View
        style={styles.summaryRow}
        accessible={true}
        accessibilityLabel={`Cart summary: ${itemCount} items, subtotal ${formatPrice(subtotal)}`}
      >
        <View style={styles.summaryItem}>
          <Text variant="bodyMedium" style={styles.label}>
            Items
          </Text>
          <Text variant="titleMedium" style={styles.value}>
            {itemCount}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text variant="bodyMedium" style={styles.label}>
            Subtotal
          </Text>
          <Text variant="titleLarge" style={styles.subtotalValue}>
            {formatPrice(subtotal)}
          </Text>
        </View>
      </View>

      {/* ========== DIVIDER ========== */}
      {/**
       * WHY Divider?
       * - Visual separation between summary and button
       * - Material Design pattern
       * - Helps users understand sections
       */}
      <Divider style={styles.divider} />

      {/* ========== CHECKOUT BUTTON ========== */}
      <Button
        mode="contained"
        onPress={onCheckout}
        style={styles.checkoutButton}
        contentStyle={styles.checkoutButtonContent}
        labelStyle={styles.checkoutButtonLabel}
        icon="cart-check"
        /**
         * WHY mode="contained"?
         * - Primary action styling
         * - High visual prominence
         * - Standard for main CTA in shopping apps
         *
         * WHY icon="cart-check"?
         * - Visual reinforcement of action
         * - Combines cart (context) with check (action)
         * - Material Design icon
         */
        accessible={true}
        accessibilityLabel={`Proceed to checkout with ${itemCount} items totaling ${formatPrice(subtotal)}`}
        accessibilityHint="Double tap to proceed to checkout"
        accessibilityRole="button"
      >
        Proceed to Checkout
      </Button>
    </Surface>
  );
};

/**
 * STYLING DECISIONS:
 *
 * WHY Surface with high elevation?
 * - Indicates it's a distinct UI layer
 * - Always visible over scrolling content
 * - Material Design pattern for bottom actions
 *
 * WHY specific padding/spacing?
 * - padding: 16 matches header/content padding
 * - Creates consistent visual rhythm
 * - Comfortable touch targets
 */
const styles = StyleSheet.create({
  // ===== CONTAINER =====
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    /**
     * WHY explicit backgroundColor?
     * - Ensures consistent look
     * - Surface may use theme color
     * - White is standard for checkout footers
     */
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    /**
     * WHY rounded top corners?
     * - Softens the edge
     * - Modern mobile design pattern
     * - Indicates it's a separate surface
     */
  },

  // ===== SUMMARY ROW =====
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    /**
     * WHY space-between?
     * - Items count on left, subtotal on right
     * - Maximizes use of horizontal space
     * - Standard receipt/summary pattern
     */
  },

  summaryItem: {
    /**
     * WHY no specific width?
     * - Content determines width
     * - Flexible for different text lengths
     * - space-between handles positioning
     */
  },

  label: {
    color: '#757575',
    marginBottom: 4,
    /**
     * WHY gray color?
     * - Secondary text styling
     * - Label is less important than value
     * - Standard pattern for labeled values
     */
  },

  value: {
    fontWeight: '600',
    /**
     * WHY fontWeight: 600?
     * - Emphasizes the actual value
     * - Clear visual hierarchy with label
     */
  },

  subtotalValue: {
    fontWeight: 'bold',
    color: '#007AFF',
    /**
     * WHY larger and blue?
     * - Most important number on screen
     * - Matches price styling throughout app
     * - Draws attention to total cost
     */
  },

  // ===== DIVIDER =====
  divider: {
    marginBottom: 16,
    /**
     * WHY divider here?
     * - Clear separation between info and action
     * - Helps users process information sections
     * - Material Design pattern
     */
  },

  // ===== CHECKOUT BUTTON =====
  checkoutButton: {
    /**
     * WHY no explicit width?
     * - Button stretches to fill container (default)
     * - Full-width buttons are easier to tap
     * - Standard for mobile CTAs
     */
  },

  checkoutButtonContent: {
    height: 48,
    /**
     * WHY height: 48?
     * - Material Design minimum touch target
     * - Comfortable for all users
     * - Standard button height for important actions
     */
  },

  checkoutButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    /**
     * WHY explicit font styling?
     * - Ensures button text is prominent
     * - Matches importance of the action
     * - Readable at a glance
     */
  },
});

export default CartSummary;
