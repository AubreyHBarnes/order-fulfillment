/**
 * Order Status Badge Component
 * File: src/components/customer/OrderStatusBadge.tsx
 *
 * Visual indicator for order status with color coding
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { OrderStatusBadgeProps, OrderStatus } from '../../types';

interface StatusConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const theme = useAppTheme();

  const getStatusConfig = (orderStatus: OrderStatus): StatusConfig => {
    switch (orderStatus) {
      case 'pending':
        return {
          label: 'Pending',
          backgroundColor: theme.custom.textDisabled + '30',
          textColor: theme.custom.textSecondary,
        };
      case 'assigned':
        return {
          label: 'Assigned',
          backgroundColor: theme.colors.primary + '20',
          textColor: theme.colors.primary,
        };
      case 'shopping':
        return {
          label: 'Shopping',
          backgroundColor: theme.colors.primary + '20',
          textColor: theme.colors.primary,
        };
      case 'ready_for_pickup':
        return {
          label: 'Ready',
          backgroundColor: theme.custom.success + '20',
          textColor: theme.custom.success,
        };
      case 'completed':
        return {
          label: 'Completed',
          backgroundColor: theme.custom.success + '20',
          textColor: theme.custom.success,
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          backgroundColor: theme.colors.error + '20',
          textColor: theme.colors.error,
        };
      default:
        return {
          label: orderStatus,
          backgroundColor: theme.custom.textDisabled + '30',
          textColor: theme.custom.textSecondary,
        };
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
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OrderStatusBadge;
