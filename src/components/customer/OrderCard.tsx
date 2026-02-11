/**
 * Order Card Component
 * File: src/components/customer/OrderCard.tsx
 *
 * Displays order summary in the orders list
 */

import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import { formatPrice } from '../../services/productService';
import OrderStatusBadge from './OrderStatusBadge';
import type { OrderCardProps } from '../../types';

/**
 * Parse items string to get item count
 * Items format: "productId:qty,productId:qty"
 */
const getItemCount = (itemsString: string): number => {
  if (!itemsString) return 0;
  return itemsString.split(',').reduce((total, pair) => {
    const parts = pair.split(':');
    const qty = parts[1];
    return total + (parseInt(qty ?? '0', 10) || 0);
  }, 0);
};

/**
 * Format date for display
 */
const formatOrderDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Get short order ID for display (last 8 characters)
 */
const getShortOrderId = (orderId: string): string => {
  return orderId.slice(-8).toUpperCase();
};

const OrderCard: React.FC<OrderCardProps> = ({ order, onPress }) => {
  const theme = useAppTheme();

  const dynamicStyles = {
    dateText: {
      color: theme.custom.textSecondary,
    },
  };

  const itemCount = getItemCount(order.items);

  return (
    <Card style={styles.card} elevation={2}>
      <TouchableOpacity
        onPress={() => onPress(order)}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel={`Order ${getShortOrderId(order.$id)}, ${itemCount} items, ${formatPrice(order.totalAmount)}, ${order.status}`}
        accessibilityHint="Double tap to view order details"
      >
        <Card.Content style={styles.content}>
          <Text variant="titleMedium" style={styles.orderId}>
            Order #{getShortOrderId(order.$id)}
          </Text>

          <Text
            variant="bodyMedium"
            style={[styles.dateText, dynamicStyles.dateText]}
          >
            {formatOrderDate(order.orderDate)} • {itemCount} item
            {itemCount !== 1 ? 's' : ''} • {formatPrice(order.totalAmount)}
          </Text>

          <OrderStatusBadge status={order.status} />
        </Card.Content>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  content: {
    paddingVertical: 12,
    gap: 8,
  },
  orderId: {
    fontWeight: '600',
  },
  dateText: {
    fontSize: 14,
  },
});

export default OrderCard;
