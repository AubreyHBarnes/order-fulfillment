/**
 * Orders Screen
 * File: src/screens/customer/OrdersScreen.tsx
 *
 * Displays customer's order history with pull-to-refresh
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ListRenderItemInfo,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme';
import { getOrdersByCustomerId } from '../../services/orderService';
import OrderCard from '../../components/customer/OrderCard';
import type { MainStackParamList, Order } from '../../types';

type OrdersScreenProps = NativeStackScreenProps<MainStackParamList, 'Orders'>;

const OrdersScreen: React.FC<OrdersScreenProps> = ({ navigation }) => {
  const theme = useAppTheme();
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    emptyText: {
      color: theme.custom.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
  };

  const loadOrders = useCallback(async () => {
    if (!user?.$id) return;

    try {
      setError(null);
      const result = await getOrdersByCustomerId(user.$id);

      if (result.success) {
        setOrders(result.data);
      } else {
        setError(result.error ?? 'Failed to load orders');
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Failed to load orders. Please try again.');
    }
  }, [user?.$id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadOrders();
      setLoading(false);
    };
    load();
  }, [loadOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const handleOrderPress = (order: Order) => {
    navigation.navigate('OrderDetail', { orderId: order.$id });
  };

  const renderOrder = ({
    item,
  }: ListRenderItemInfo<Order>): React.ReactElement => {
    return <OrderCard order={item} onPress={handleOrderPress} />;
  };

  const renderEmptyState = (): React.ReactElement | null => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text variant="headlineSmall" style={styles.emptyTitle}>
          No Orders Yet
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.emptyText, dynamicStyles.emptyText]}
        >
          Your order history will appear here once you place an order.
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, dynamicStyles.emptyText]}>
          Loading orders...
        </Text>
      </View>
    );
  }

  if (error && orders.length === 0) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.container]}>
        <Text variant="headlineSmall" style={dynamicStyles.errorText}>
          Oops! Something went wrong
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.errorText, dynamicStyles.emptyText]}
        >
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={styles.listContent}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center',
  },
});

export default OrdersScreen;
