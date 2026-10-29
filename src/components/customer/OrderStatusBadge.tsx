/**
 * Order Status Badge Component
 * File: src/components/customer/OrderStatusBadge.tsx
 *
 * Visual indicator for order status with color coding
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme, fontFamilies, radius, spacing } from '../../theme';
import type { OrderStatusBadgeProps, OrderStatus } from '../../types';

interface StatusConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const theme = useAppTheme();

  const { colors, custom } = theme;
  const picked = { backgroundColor: custom.status.picked.container, textColor: custom.status.picked.onContainer };
  const getStatusConfig = (orderStatus: OrderStatus): StatusConfig => {
    switch (orderStatus) {
      case 'pending':
        return { label: 'Pending', backgroundColor: colors.surfaceVariant, textColor: colors.onSurfaceVariant };
      case 'assigned':
        return { label: 'Assigned', backgroundColor: colors.primaryContainer, textColor: colors.onPrimaryContainer };
      case 'shopping':
        return { label: 'Shopping', backgroundColor: colors.primaryContainer, textColor: colors.onPrimaryContainer };
      case 'ready_for_pickup':
        return { label: 'Ready', ...picked };
      case 'out_for_delivery':
        return { label: 'Out for Delivery', ...picked };
      case 'completed':
        return { label: 'Completed', ...picked };
      case 'cancelled':
        // gray, not red: red is reserved for things that need the customer's action
        return {
          label: 'Cancelled',
          backgroundColor: custom.status.unavailable.container,
          textColor: custom.status.unavailable.onContainer,
        };
      default:
        return { label: orderStatus, backgroundColor: colors.surfaceVariant, textColor: colors.onSurfaceVariant };
    }
  };

  const config = getStatusConfig(status);

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.text, { color: config.textColor }]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontFamily: fontFamilies.bodySemiBold,
  },
});

export default OrderStatusBadge;
