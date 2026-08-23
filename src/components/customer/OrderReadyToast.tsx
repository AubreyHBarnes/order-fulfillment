/**
 * Order Ready Toast Component
 * File: src/components/customer/OrderReadyToast.tsx
 *
 * PURPOSE:
 * A non-intrusive notice that fires the moment one of the customer's
 * orders becomes ready_for_pickup, no matter which screen they're on.
 * Driven by CustomerOrderContext's polling - see that file for why this
 * is polling-based rather than push, and docs/DECISIONS.md's "Customer
 * ready-for-pickup notification" entry for the full scope.
 *
 * Mirrors the shopper-side UrgentOrderToast (same Snackbar pattern),
 * but for the opposite audience/message, and with a "View" action
 * since there's an obvious next step here (open the order) that the
 * shopper toast doesn't have.
 */

import React from 'react';
import { Snackbar, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { OrderReadyToastProps } from '../../types';

const TOAST_DURATION_MS = 6000;

const OrderReadyToast: React.FC<OrderReadyToastProps> = ({
  visible,
  shortOrderId,
  onDismiss,
  onView,
}) => {
  const theme = useAppTheme();

  return (
    <Snackbar
      visible={visible}
      onDismiss={onDismiss}
      duration={TOAST_DURATION_MS}
      action={{ label: 'View', onPress: onView }}
      style={{ backgroundColor: theme.colors.inverseSurface }}
    >
      <Text style={{ color: theme.colors.inverseOnSurface }}>
        {shortOrderId
          ? `Order #${shortOrderId} is ready for pickup!`
          : 'Your order is ready for pickup!'}
      </Text>
    </Snackbar>
  );
};

export default OrderReadyToast;
