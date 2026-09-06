/**
 * Drop Offs Screen
 * File: src/screens/shopper/DropOffsScreen.tsx
 *
 * PURPOSE:
 * Lists this shopper's delivery orders that are 'out_for_delivery' -
 * shopping is done, but the order hasn't been physically dropped off
 * yet. Lets the shopper mark each one delivered.
 *
 * WHY SCOPED TO THIS SHOPPER (unlike Customer Check-ins, which is
 * store-wide)?
 * A delivery order keeps its shopperID after the shopping checklist is
 * done - only ShopperStatus.currentOrderId gets cleared, freeing the
 * shopper for their next assignment. So "orders I still need to drop
 * off" is a real, shopper-specific list, unlike a waiting customer at
 * the store who any free shopper can help.
 *
 * WHY CAN THERE BE MORE THAN ONE?
 * Finishing a delivery's checklist frees the shopper immediately
 * (OrderCompletionScreen's clearCurrentOrder/autoAssignNextOrderTo) -
 * out_for_delivery doesn't block a new assignment, so a shopper can
 * finish shopping a second delivery before dropping off the first.
 *
 * DATA FLOW (mirrors AvailableTasksScreen's list + join pattern):
 * 1. On mount/focus, fetch this shopper's out_for_delivery orders
 * 2. Batch fetch the customer profiles behind them
 * 3. "Mark Delivered" -> completeOrder(orderId, 'completed')
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text, Icon, Card, Button } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getOutForDeliveryOrdersByShopperId, completeOrder } from '../../services/orderService';
import { getUserProfilesByIds, getCustomerDisplayName } from '../../services/userService';
import { subscribeToOrders } from '../../services/realtimeService';
import type { Order, UserProfile } from '../../types';

// ============================================================
// TYPES
// ============================================================

interface DropOffWithCustomer {
  order: Order;
  customerProfile: UserProfile | null;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getShortOrderId = (orderId: string): string => orderId.slice(-8).toUpperCase();

const getItemCount = (itemsString: string): number => {
  if (!itemsString) return 0;

  return itemsString.split(',').reduce((total, pair) => {
    const parts = pair.split(':');
    const qty = parts[1];
    return total + (parseInt(qty ?? '0', 10) || 0);
  }, 0);
};

const formatDueTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// ============================================================
// COMPONENT
// ============================================================

const DropOffsScreen: React.FC = () => {
  const theme = useAppTheme();
  const { userProfile } = useAuth();

  const [dropOffs, setDropOffs] = useState<DropOffWithCustomer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  const fetchDropOffs = useCallback(async (isRefresh: boolean = false): Promise<void> => {
    if (!userProfile?.shopperID) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const ordersResult = await getOutForDeliveryOrdersByShopperId(userProfile.shopperID);

      if (!ordersResult.success) {
        setError(ordersResult.error || 'Failed to fetch drop offs');
        setDropOffs([]);
        return;
      }

      const orders = ordersResult.data;

      if (orders.length === 0) {
        setDropOffs([]);
        return;
      }

      const customerIds = orders.map((order) => order.customerID);
      const profilesResult = await getUserProfilesByIds(customerIds);
      const profilesMap = profilesResult.success ? profilesResult.data : {};

      const combined: DropOffWithCustomer[] = orders.map((order) => ({
        order,
        customerProfile: profilesMap[order.customerID] || null,
      }));

      setDropOffs(combined);
    } catch (err) {
      console.error('Error fetching drop offs:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.shopperID]);

  /**
   * Fetch on focus, plus a focus-scoped realtime subscription (see
   * docs/DECISIONS.md's realtime-migration entry) so this shopper's own
   * out-for-delivery list stays live while the screen is open.
   */
  useFocusEffect(
    useCallback(() => {
      fetchDropOffs();

      if (!userProfile?.shopperID) {
        return undefined;
      }

      const shopperID = userProfile.shopperID;
      const unsubscribe = subscribeToOrders((event) => {
        if (event.payload.shopperID === shopperID && event.payload.status === 'out_for_delivery') {
          fetchDropOffs();
        }
      });

      return unsubscribe;
    }, [fetchDropOffs, userProfile?.shopperID])
  );

  const handleRefresh = (): void => {
    fetchDropOffs(true);
  };

  const handleMarkDeliveredPress = (item: DropOffWithCustomer): void => {
    const { order, customerProfile } = item;
    const customerName = getCustomerDisplayName(customerProfile);

    Alert.alert(
      'Mark Delivered',
      `Confirm order #${getShortOrderId(order.$id)} has been delivered to ${customerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Delivered',
          onPress: async () => {
            setDeliveringId(order.$id);
            try {
              const result = await completeOrder(order.$id, 'completed');
              if (!result.success) {
                Alert.alert('Error', result.error ?? 'Failed to mark order delivered');
                return;
              }

              setDropOffs((prev) => prev.filter((d) => d.order.$id !== order.$id));
            } finally {
              setDeliveringId(null);
            }
          },
        },
      ]
    );
  };

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    card: {
      backgroundColor: theme.colors.surface,
    },
    customerName: {
      color: theme.colors.onSurface,
    },
    infoText: {
      color: theme.custom.textSecondary,
    },
    emptyText: {
      color: theme.custom.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
  };

  const renderDropOffCard = ({ item }: { item: DropOffWithCustomer }): React.ReactElement => {
    const { order, customerProfile } = item;
    const customerName = getCustomerDisplayName(customerProfile);
    const itemCount = getItemCount(order.items);
    const isDelivering = deliveringId === order.$id;

    return (
      <Card style={[styles.card, dynamicStyles.card]} elevation={1}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium" style={[styles.customerName, dynamicStyles.customerName]}>
            {customerName}
          </Text>

          <Text variant="bodyMedium" style={[styles.infoText, dynamicStyles.infoText]}>
            Order #{getShortOrderId(order.$id)} • {itemCount} item{itemCount !== 1 ? 's' : ''}
          </Text>

          <View style={styles.detailRow}>
            <Icon source="map-marker" size={16} color={dynamicStyles.infoText.color} />
            <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.infoText]}>
              {order.deliveryAddress}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Icon source="clock-outline" size={16} color={dynamicStyles.infoText.color} />
            <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.infoText]}>
              Due {formatDueTime(order.scheduledReadyTime)}
            </Text>
          </View>

          <Button
            mode="contained"
            onPress={() => handleMarkDeliveredPress(item)}
            loading={isDelivering}
            disabled={isDelivering}
            style={styles.deliveredButton}
            icon="truck-check"
          >
            Mark Delivered
          </Button>
        </Card.Content>
      </Card>
    );
  };

  const renderEmptyState = (): React.ReactElement => (
    <View style={styles.emptyContainer}>
      <Icon source="truck-delivery" size={64} color={theme.custom.textDisabled} />
      <Text variant="titleMedium" style={[styles.emptyTitle, dynamicStyles.emptyText]}>
        No drop offs pending
      </Text>
      <Text variant="bodyMedium" style={[styles.emptySubtitle, dynamicStyles.emptyText]}>
        Orders ready for delivery will appear here
      </Text>
    </View>
  );

  const renderErrorState = (): React.ReactElement => (
    <View style={styles.emptyContainer}>
      <Icon source="alert-circle" size={64} color={theme.colors.error} />
      <Text variant="titleMedium" style={[styles.emptyTitle, dynamicStyles.errorText]}>
        Unable to load drop offs
      </Text>
      <Text variant="bodyMedium" style={[styles.emptySubtitle, dynamicStyles.emptyText]}>
        {error}
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary, marginTop: 16 }}>
          Loading drop offs...
        </Text>
      </View>
    );
  }

  if (error && dropOffs.length === 0) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        {renderErrorState()}
      </View>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <FlatList
        data={dropOffs}
        keyExtractor={(item) => item.order.$id}
        renderItem={renderDropOffCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },

  card: {
    marginBottom: 12,
    borderRadius: 12,
  },

  cardContent: {
    gap: 8,
  },

  customerName: {
    fontWeight: '600',
  },

  infoText: {
    marginTop: 0,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  detailText: {
    flex: 1,
  },

  deliveredButton: {
    marginTop: 8,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  emptyTitle: {
    marginTop: 16,
    fontWeight: '500',
  },

  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
});

export default DropOffsScreen;
