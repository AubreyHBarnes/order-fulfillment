/**
 * Order Completion Screen
 * File: src/screens/shopper/OrderCompletionScreen.tsx
 *
 * PURPOSE:
 * Final step of the shopping workflow. Recaps how the order went
 * (CompletionSummary) and lets the shopper confirm completion, branching
 * by fulfillment type - pickup orders go to 'ready_for_pickup', delivery
 * orders go straight to 'completed'. No separate DeliveryConfirmation
 * screen: the only difference between the two is the target status and
 * button label, not enough to justify a second screen.
 *
 * After confirming: frees the shopper (clearCurrentOrder) and, if
 * there's a pending order waiting, hands it to them immediately
 * (autoAssignNextOrderTo) instead of leaving them idle until their next
 * status toggle.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Text, Button } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getOrderById, completeOrder } from '../../services/orderService';
import { clearCurrentOrder, autoAssignNextOrderTo } from '../../services/shopperStatusService';
import { parseItemsString, parsePickedItemsString, parseItemIssues } from '../../utils/orderItems';
import CompletionSummary from '../../components/shopper/CompletionSummary';
import type { ShopperStackParamList, Order } from '../../types';

type OrderCompletionScreenProps = NativeStackScreenProps<ShopperStackParamList, 'OrderCompletion'>;

const OrderCompletionScreen: React.FC<OrderCompletionScreenProps> = ({ route, navigation }) => {
  const theme = useAppTheme();
  const { userProfile } = useAuth();
  const { orderId } = route.params;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    subtitle: {
      color: theme.custom.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.custom.border,
    },
  };

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoading(true);
      const result = await getOrderById(orderId);
      if (result.success && result.data) {
        setOrder(result.data);
      } else {
        setError(result.error ?? 'Order not found');
      }
      setLoading(false);
    };
    load();
  }, [orderId]);

  const handleConfirm = async (): Promise<void> => {
    if (!order || !userProfile?.shopperID) return;

    const isPickup = order.deliveryAddress.startsWith('PICKUP:');
    const nextStatus = isPickup ? 'ready_for_pickup' : 'completed';

    setSubmitting(true);
    try {
      const result = await completeOrder(order.$id, nextStatus);
      if (!result.success) {
        Alert.alert('Error', result.error ?? 'Failed to complete order');
        return;
      }

      await clearCurrentOrder(userProfile.shopperID);
      const nextOrder = await autoAssignNextOrderTo(userProfile.shopperID);

      if (nextOrder) {
        Alert.alert(
          'Order Complete',
          `Nice work! A new order (#${nextOrder.$id.slice(-8).toUpperCase()}) has been assigned to you.`,
          [{ text: 'OK', onPress: () => navigation.navigate('ShopperHome') }]
        );
      } else {
        navigation.navigate('ShopperHome');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <Text variant="headlineSmall" style={dynamicStyles.errorText}>
          Unable to load order
        </Text>
        <Text variant="bodyMedium" style={dynamicStyles.subtitle}>
          {error ?? 'Order not found'}
        </Text>
      </View>
    );
  }

  const orderedItems = parseItemsString(order.items);
  const pickedItems = parsePickedItemsString(order.pickedItems);
  const issues = parseItemIssues(order.itemIssues ?? '');

  const outOfStockCount = issues.filter((i) => i.kind === 'oos').length;
  const substitutedCount = issues.filter((i) => i.kind === 'sub' && i.status === 'approved').length;
  const foundCount = orderedItems.filter((item) => {
    const hasIssue = issues.some((i) => i.productId === item.productId);
    return !hasIssue && (pickedItems[item.productId] ?? 0) >= item.quantity;
  }).length;

  const isPickup = order.deliveryAddress.startsWith('PICKUP:');
  const confirmLabel = isPickup ? 'Mark Ready for Pickup' : 'Complete Delivery';

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="headlineSmall" style={styles.title}>
          Order #{order.$id.slice(-8).toUpperCase()}
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, dynamicStyles.subtitle]}>
          Review the summary below before {isPickup ? 'marking this order ready' : 'completing this delivery'}.
        </Text>

        <CompletionSummary
          foundCount={foundCount}
          outOfStockCount={outOfStockCount}
          substitutedCount={substitutedCount}
          totalCount={orderedItems.length}
        />
      </ScrollView>

      <View style={[styles.footer, dynamicStyles.footer]}>
        <Button mode="contained" onPress={handleConfirm} loading={submitting} disabled={submitting}>
          {confirmLabel}
        </Button>
      </View>
    </View>
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
  scrollContent: {
    padding: 16,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 20,
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});

export default OrderCompletionScreen;
