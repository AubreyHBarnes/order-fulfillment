/**
 * Customer Check-ins Screen
 * File: src/screens/shopper/CustomerCheckInsScreen.tsx
 *
 * PURPOSE:
 * Lists every customer currently waiting for pickup, store-wide - not
 * scoped to orders this shopper personally shopped. Lets a shopper hand
 * an order off and close out both the arrival and the order.
 *
 * WHY STORE-WIDE?
 * CustomerArrival has no shopper field - an arrival is tied to an order
 * and a customer, not to whoever shopped it. Any on-duty shopper can see
 * and act on any waiting customer, matching how a real curbside desk
 * works (whoever's free helps the next person), and matching the flow
 * arrivalService.ts's own docstring already describes generically as
 * "STAFF".
 *
 * WHY THIS SCREEN OWNS THE FINAL "COMPLETED" WRITE?
 * No code anywhere previously transitioned a pickup order from
 * 'ready_for_pickup' to 'completed', even though arrivalService.ts's
 * docstring describes that as step 9 of the flow. This screen's
 * "Hand Off Order" action is that missing step - it closes both the
 * arrival and the order in one action.
 *
 * DATA FLOW (mirrors AvailableTasksScreen's list + join pattern):
 * 1. On mount/focus, fetch all 'waiting' arrivals (getActiveArrivals)
 * 2. For each arrival, fetch its order and the customer's profile
 * 3. Display waiting customers, oldest arrival first
 * 4. "Hand Off Order" -> mark arrival completed + order completed
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
import { getActiveArrivals, updateArrivalStatus } from '../../services/arrivalService';
import { getOrderById, completeOrder } from '../../services/orderService';
import { getUserProfilesByIds, getCustomerDisplayName } from '../../services/userService';
import type { CustomerArrival, Order, UserProfile } from '../../types';

// ============================================================
// TYPES
// ============================================================

/**
 * Combined arrival + order + customer profile for display
 *
 * WHY COMBINE ALL THREE?
 * - CustomerArrival has the wait-relevant fields (vehicle, parking, notes, arrival time)
 * - Order has the short id and fulfillment context
 * - UserProfile has the customer's display name
 * This is the "view model" the list actually renders, same pattern as
 * AvailableTasksScreen's TaskWithCustomer.
 */
interface CheckInWithDetails {
  arrival: CustomerArrival;
  order: Order | null;
  customerProfile: UserProfile | null;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getShortOrderId = (orderId: string): string => orderId.slice(-8).toUpperCase();

/**
 * Format how long ago the customer arrived
 */
const formatWaitTime = (arrivalTime: string): string => {
  const arrived = new Date(arrivalTime);
  const now = new Date();
  const diffMins = Math.max(0, Math.floor((now.getTime() - arrived.getTime()) / (1000 * 60)));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `Waiting ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  return `Waiting ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
};

// ============================================================
// COMPONENT
// ============================================================

const CustomerCheckInsScreen: React.FC = () => {
  const theme = useAppTheme();

  const [checkIns, setCheckIns] = useState<CheckInWithDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [handingOffId, setHandingOffId] = useState<string | null>(null);

  const fetchCheckIns = useCallback(async (isRefresh: boolean = false): Promise<void> => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const arrivalsResult = await getActiveArrivals();

      if (!arrivalsResult.success) {
        setError(arrivalsResult.error || 'Failed to fetch check-ins');
        setCheckIns([]);
        return;
      }

      const arrivals = arrivalsResult.data;

      if (arrivals.length === 0) {
        setCheckIns([]);
        return;
      }

      // Batch fetch the orders and customer profiles behind each arrival
      const orderResults = await Promise.all(
        arrivals.map((arrival) => getOrderById(arrival.orderID))
      );
      const ordersByArrival = new Map<string, Order | null>(
        arrivals.map((arrival, index) => [arrival.$id, orderResults[index]?.data ?? null])
      );

      const customerIds = arrivals.map((arrival) => arrival.customerID);
      const profilesResult = await getUserProfilesByIds(customerIds);
      const profilesMap = profilesResult.success ? profilesResult.data : {};

      const combined: CheckInWithDetails[] = arrivals.map((arrival) => ({
        arrival,
        order: ordersByArrival.get(arrival.$id) ?? null,
        customerProfile: profilesMap[arrival.customerID] || null,
      }));

      setCheckIns(combined);
    } catch (err) {
      console.error('Error fetching check-ins:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCheckIns();
    }, [fetchCheckIns])
  );

  const handleRefresh = (): void => {
    fetchCheckIns(true);
  };

  const handleHandOffPress = (item: CheckInWithDetails): void => {
    const { arrival, order, customerProfile } = item;
    if (!order) {
      Alert.alert('Error', 'This order could not be found.');
      return;
    }

    const customerName = getCustomerDisplayName(customerProfile);

    Alert.alert(
      'Hand Off Order',
      `Confirm order #${getShortOrderId(order.$id)} has been handed to ${customerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hand Off',
          onPress: async () => {
            setHandingOffId(arrival.$id);
            try {
              const arrivalResult = await updateArrivalStatus(arrival.$id, 'completed');
              const orderResult = await completeOrder(order.$id, 'completed');

              if (!arrivalResult.success || !orderResult.success) {
                Alert.alert(
                  'Error',
                  arrivalResult.error ?? orderResult.error ?? 'Failed to hand off order'
                );
                return;
              }

              setCheckIns((prev) => prev.filter((c) => c.arrival.$id !== arrival.$id));
            } finally {
              setHandingOffId(null);
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
    waitBadge: {
      backgroundColor: theme.colors.primaryContainer,
    },
    waitText: {
      color: theme.colors.onPrimaryContainer,
    },
    emptyText: {
      color: theme.custom.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
  };

  const renderCheckInCard = ({ item }: { item: CheckInWithDetails }): React.ReactElement => {
    const { arrival, order, customerProfile } = item;
    const customerName = getCustomerDisplayName(customerProfile);
    const isHandingOff = handingOffId === arrival.$id;

    return (
      <Card style={[styles.card, dynamicStyles.card]} elevation={1}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.headerRow}>
            <Text variant="titleMedium" style={[styles.customerName, dynamicStyles.customerName]}>
              {customerName}
            </Text>
            <View style={[styles.waitBadge, dynamicStyles.waitBadge]}>
              <Text variant="labelSmall" style={dynamicStyles.waitText}>
                {formatWaitTime(arrival.arrivedAt)}
              </Text>
            </View>
          </View>

          {order && (
            <Text variant="bodyMedium" style={[styles.infoText, dynamicStyles.infoText]}>
              Order #{getShortOrderId(order.$id)}
            </Text>
          )}

          {arrival.vehicleDescription ? (
            <View style={styles.detailRow}>
              <Icon source="car" size={16} color={dynamicStyles.infoText.color} />
              <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.infoText]}>
                {arrival.vehicleDescription}
              </Text>
            </View>
          ) : null}

          {/*
           * WHY notes INSTEAD OF parkingSpot HERE?
           * parkingSpot is now a schema-required 1-5 integer that
           * recordArrival() clamps a best-effort digit into (or
           * defaults to 1) - it's always present but not trustworthy
           * as "the" parking location. `notes` carries the customer's
           * actual free-text input verbatim (see arrivalService.ts),
           * so it's the honest thing to show a shopper here.
           */}
          {arrival.notes ? (
            <View style={styles.detailRow}>
              <Icon source="map-marker" size={16} color={dynamicStyles.infoText.color} />
              <Text variant="bodyMedium" style={[styles.detailText, dynamicStyles.infoText]}>
                {arrival.notes}
              </Text>
            </View>
          ) : null}

          <Button
            mode="contained"
            onPress={() => handleHandOffPress(item)}
            loading={isHandingOff}
            disabled={isHandingOff || !order}
            style={styles.handOffButton}
            icon="handshake"
          >
            Hand Off Order
          </Button>
        </Card.Content>
      </Card>
    );
  };

  const renderEmptyState = (): React.ReactElement => (
    <View style={styles.emptyContainer}>
      <Icon source="account-check" size={64} color={theme.custom.textDisabled} />
      <Text variant="titleMedium" style={[styles.emptyTitle, dynamicStyles.emptyText]}>
        No customers waiting
      </Text>
      <Text variant="bodyMedium" style={[styles.emptySubtitle, dynamicStyles.emptyText]}>
        Customers who arrive for pickup will appear here
      </Text>
    </View>
  );

  const renderErrorState = (): React.ReactElement => (
    <View style={styles.emptyContainer}>
      <Icon source="alert-circle" size={64} color={theme.colors.error} />
      <Text variant="titleMedium" style={[styles.emptyTitle, dynamicStyles.errorText]}>
        Unable to load check-ins
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
          Loading check-ins...
        </Text>
      </View>
    );
  }

  if (error && checkIns.length === 0) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        {renderErrorState()}
      </View>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <FlatList
        data={checkIns}
        keyExtractor={(item) => item.arrival.$id}
        renderItem={renderCheckInCard}
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

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  customerName: {
    fontWeight: '600',
  },

  infoText: {
    marginTop: 0,
  },

  waitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  detailText: {
    flex: 1,
  },

  handOffButton: {
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

export default CustomerCheckInsScreen;
