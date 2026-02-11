/**
 * Order Summary Card Component
 * File: src/components/customer/OrderSummaryCard.tsx
 *
 * PURPOSE: Displays cart items and subtotal for checkout review
 *
 * THEMING:
 * - Uses useAppTheme() for all colors
 * - Automatically adapts to light/dark mode
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
import type { OrderSummaryCardProps, CartItem } from '../../types';
import { formatPrice } from '../../services/productService';

const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({
  cartItems,
  subtotal,
}) => {
  const theme = useAppTheme();

  const dynamicStyles = {
    sectionLabel: {
      color: theme.colors.onBackground,
    },
    card: {
      backgroundColor: theme.colors.surface,
    },
    itemText: {
      color: theme.colors.onSurface,
    },
    itemPrice: {
      color: theme.colors.onSurface,
    },
    divider: {
      backgroundColor: theme.custom.divider,
    },
    subtotalLabel: {
      color: theme.colors.onSurface,
    },
    subtotalAmount: {
      color: theme.colors.onSurface,
    },
  };

  const renderItemRow = (item: CartItem): React.ReactElement => {
    const lineTotal = item.price * item.quantity;

    return (
      <View key={item.$id} style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemText, dynamicStyles.itemText]}>
            {item.quantity}x {item.name}
          </Text>
        </View>
        <Text style={[styles.itemPrice, dynamicStyles.itemPrice]}>
          {formatPrice(lineTotal)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, dynamicStyles.sectionLabel]}>
        Order Summary
      </Text>

      <View style={[styles.card, dynamicStyles.card]}>
        {cartItems.map(renderItemRow)}

        <View style={[styles.divider, dynamicStyles.divider]} />

        <View style={styles.subtotalRow}>
          <Text style={[styles.subtotalLabel, dynamicStyles.subtotalLabel]}>
            Subtotal
          </Text>
          <Text style={[styles.subtotalAmount, dynamicStyles.subtotalAmount]}>
            {formatPrice(subtotal)}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================
// STYLES - Layout only, colors from theme
// ============================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  card: {
    borderRadius: 12,
    padding: 16,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },

  itemInfo: {
    flex: 1,
    marginRight: 16,
  },

  itemText: {
    fontSize: 15,
  },

  itemPrice: {
    fontSize: 15,
    fontWeight: '500',
  },

  divider: {
    height: 1,
    marginVertical: 12,
  },

  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  subtotalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },

  subtotalAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
});

export default OrderSummaryCard;
