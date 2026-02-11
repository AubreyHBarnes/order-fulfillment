/**
 * Order Detail Screen
 * File: src/screens/customer/OrderDetailScreen.tsx
 *
 * Shows full order details with timeline, delivery info, and cancel option.
 * For pickup orders that are ready, also shows the "I've Arrived" notification card.
 *
 * ============================================================
 * SCREEN RESPONSIBILITIES
 * ============================================================
 *
 * This screen handles multiple concerns for a single order:
 * 1. Display order status and timeline
 * 2. Show delivery/pickup location info
 * 3. Display order summary (items, total)
 * 4. Allow order cancellation (if pending/assigned)
 * 5. Handle "I've Arrived" for pickup orders (NEW)
 *
 * WHY ALL IN ONE SCREEN?
 * - User mental model: "This is my order, show me everything about it"
 * - Reduces navigation complexity
 * - All order actions in one place
 *
 * ALTERNATIVE: Separate screens for each concern
 * - OrderStatusScreen, OrderItemsScreen, ArrivalScreen
 * - More modular, but worse UX (too much navigation)
 * - We chose "one screen, multiple cards" approach
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Divider } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme';
import { getOrderById, cancelOrder } from '../../services/orderService';
import { formatPrice } from '../../services/productService';
import OrderTimeline from '../../components/customer/OrderTimeline';
import OrderStatusBadge from '../../components/customer/OrderStatusBadge';
import ArrivalNotificationCard from '../../components/customer/ArrivalNotificationCard';
import type { MainStackParamList, Order } from '../../types';

type OrderDetailScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'OrderDetail'
>;

/**
 * Parse items string to get item count
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
 * Get short order ID for display
 */
const getShortOrderId = (orderId: string): string => {
  return orderId.slice(-8).toUpperCase();
};

/**
 * Check if order is a pickup order
 */
const isPickupOrder = (deliveryAddress: string): boolean => {
  return deliveryAddress.startsWith('PICKUP:');
};

/**
 * Format delivery address for display
 */
const formatDeliveryAddress = (address: string): string => {
  if (isPickupOrder(address)) {
    return address.replace('PICKUP: ', '');
  }
  return address;
};

const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { orderId } = route.params;
  const theme = useAppTheme();

  /**
   * WHY useAuth HERE?
   * We need the customer's user ID to record their arrival.
   * The ArrivalNotificationCard needs to know WHO is arriving.
   *
   * WHY NOT PASS FROM PARENT?
   * - This screen is navigated to directly (not nested)
   * - useAuth is the standard way to get user info anywhere in the app
   * - Keeps navigation params simple (just orderId)
   */
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    sectionTitle: {
      color: theme.custom.textSecondary,
    },
    detailText: {
      color: theme.custom.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
    cancelButton: {
      borderColor: theme.colors.error,
    },
    cancelButtonText: {
      color: theme.colors.error,
    },
  };

  const loadOrder = useCallback(async () => {
    try {
      setError(null);
      const result = await getOrderById(orderId);

      if (result.success && result.data) {
        setOrder(result.data);
      } else {
        setError(result.error ?? 'Failed to load order');
      }
    } catch (err) {
      console.error('Error loading order:', err);
      setError('Failed to load order. Please try again.');
    }
  }, [orderId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadOrder();
      setLoading(false);
    };
    load();
  }, [loadOrder]);

  const canCancelOrder = (orderStatus: string): boolean => {
    return orderStatus === 'pending' || orderStatus === 'assigned';
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: confirmCancelOrder,
        },
      ]
    );
  };

  const confirmCancelOrder = async () => {
    if (!order) return;

    setCancelling(true);
    try {
      const result = await cancelOrder(order.$id);

      if (result.success && result.data) {
        setOrder(result.data);
        Alert.alert('Order Cancelled', 'Your order has been cancelled.');
      } else {
        Alert.alert('Error', result.error ?? 'Failed to cancel order');
      }
    } catch (err) {
      console.error('Error cancelling order:', err);
      Alert.alert('Error', 'Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, dynamicStyles.detailText]}>
          Loading order...
        </Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <Text variant="headlineSmall" style={dynamicStyles.errorText}>
          Order Not Found
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.errorText, dynamicStyles.detailText]}
        >
          {error ?? 'Unable to load order details.'}
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          Go Back
        </Button>
      </View>
    );
  }

  const isPickup = isPickupOrder(order.deliveryAddress);
  const itemCount = getItemCount(order.items);

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]}>
      {/* Order Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.orderId}>
          Order #{getShortOrderId(order.$id)}
        </Text>
        <OrderStatusBadge status={order.status} />
      </View>

      {/* Order Timeline */}
      <Card style={styles.card}>
        <Card.Content>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
          >
            ORDER STATUS
          </Text>
          <OrderTimeline order={order} />
        </Card.Content>
      </Card>

      {/*
        ============================================================
        ARRIVAL NOTIFICATION CARD
        ============================================================

        This card only appears when ALL these conditions are true:
        1. isPickup - The order is a pickup order (not delivery)
        2. order.status === 'ready_for_pickup' - The order is ready
        3. user?.$id - We have the user's ID (should always be true if logged in)

        WHY THESE CONDITIONS?

        1. WHY ONLY PICKUP ORDERS?
           - Delivery orders are brought TO the customer
           - Only pickup orders require customer to arrive at store
           - Showing "I've Arrived" for delivery would be confusing

        2. WHY ONLY 'ready_for_pickup' STATUS?
           - If status is 'pending' or 'shopping', order isn't ready yet
           - Customer shouldn't notify arrival before order is ready
           - Staff can't bring out an order that's not packed
           - If status is 'completed', they already got their order

        3. WHY CHECK user?.$id?
           - TypeScript safety - user could theoretically be null
           - We need user ID to record who arrived
           - If no user (shouldn't happen), don't show the card

        PLACEMENT:
        - After timeline (customer sees status first)
        - Before delivery info (action before details)
        - Prominent position for easy access when arriving
      */}
      {isPickup && order.status === 'ready_for_pickup' && user?.$id && (
        <ArrivalNotificationCard
          orderId={order.$id}
          customerId={user.$id}
          /**
           * WHY NO onArrivalRecorded CALLBACK?
           * - For now, we don't need to do anything when arrival is recorded
           * - The card handles its own state (shows "Staff notified")
           * - Could add callback later to show a toast or refresh order
           *
           * EXAMPLE IF WE WANTED CALLBACK:
           * onArrivalRecorded={(arrival) => {
           *   Toast.show('Staff has been notified!');
           *   // or: loadOrder(); // Refresh order data
           * }}
           */
        />
      )}

      {/* Delivery/Pickup Info */}
      <Card style={styles.card}>
        <Card.Content>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
          >
            {isPickup ? 'PICKUP LOCATION' : 'DELIVERY ADDRESS'}
          </Text>
          <Text variant="bodyLarge" style={styles.addressText}>
            {formatDeliveryAddress(order.deliveryAddress)}
          </Text>
          {order.deliveryNotes && (
            <Text
              variant="bodyMedium"
              style={[styles.notesText, dynamicStyles.detailText]}
            >
              Notes: {order.deliveryNotes}
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Order Summary */}
      <Card style={styles.card}>
        <Card.Content>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
          >
            ORDER SUMMARY
          </Text>

          <View style={styles.summaryRow}>
            <Text variant="bodyMedium" style={dynamicStyles.detailText}>
              Items
            </Text>
            <Text variant="bodyMedium">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text variant="titleMedium" style={styles.totalLabel}>
              Total
            </Text>
            <Text variant="titleMedium" style={styles.totalAmount}>
              {formatPrice(order.totalAmount)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Cancel Button */}
      {canCancelOrder(order.status) && (
        <View style={styles.cancelContainer}>
          <Button
            mode="outlined"
            onPress={handleCancelOrder}
            loading={cancelling}
            disabled={cancelling}
            style={[styles.cancelButton, dynamicStyles.cancelButton]}
            textColor={theme.colors.error}
          >
            Cancel Order
          </Button>
        </View>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  orderId: {
    fontWeight: '600',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  addressText: {
    lineHeight: 22,
  },
  notesText: {
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  divider: {
    marginVertical: 8,
  },
  totalLabel: {
    fontWeight: '600',
  },
  totalAmount: {
    fontWeight: '700',
  },
  cancelContainer: {
    padding: 16,
  },
  cancelButton: {
    borderWidth: 1,
  },
  loadingText: {
    marginTop: 16,
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 16,
  },
  bottomPadding: {
    height: 32,
  },
});

export default OrderDetailScreen;
