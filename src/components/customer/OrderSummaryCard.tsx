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
import { useAppTheme, fontFamilies, radius, spacing, tabularNums } from '../../theme';
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
      ...tabularNums,
      color: theme.colors.onSurface,
    },
    divider: {
      backgroundColor: theme.custom.divider,
    },
    subtotalLabel: {
      ...tabularNums,
      color: theme.colors.onSurface,
    },
    subtotalAmount: {
      ...tabularNums,
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
    marginBottom: spacing.xl,
  },

  sectionLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.bodySemiBold,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  card: {
    borderRadius: radius.md,
    padding: spacing.lg,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  itemInfo: {
    flex: 1,
    marginRight: spacing.lg,
  },

  itemText: {
    fontSize: 15,
  },

  itemPrice: {
    ...tabularNums,
    fontSize: 15,
    fontFamily: fontFamilies.bodyMedium,
  },

  divider: {
    height: 1,
    marginVertical: spacing.md,
  },

  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  subtotalLabel: {
    ...tabularNums,
    fontSize: 16,
    fontFamily: fontFamilies.bodySemiBold,
  },

  subtotalAmount: {
    ...tabularNums,
    fontSize: 18,
    fontFamily: fontFamilies.bodyBold,
  },
});

export default OrderSummaryCard;
