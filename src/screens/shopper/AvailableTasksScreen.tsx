/**
 * Available Tasks Screen
 * File: src/screens/shopper/AvailableTasksScreen.tsx
 *
 * PURPOSE:
 * Lists orders that need shoppers. Shoppers can view task details from here.
 * Shows customer name, order date, item count, and fulfillment type.
 *
 * ============================================================
 * SCREEN STRUCTURE
 * ============================================================
 *
 * ┌─────────────────────────────────────────────┐
 * │  [<- Back]    Pick Tasks                    │
 * ├─────────────────────────────────────────────┤
 * │  ┌─────────────────────────────────────┐   │
 * │  │  John Smith                         │   │
 * │  │  Jan 15, 2:30 PM • 5 items         │   │
 * │  │  🚚 Delivery                        │   │
 * │  └─────────────────────────────────────┘   │
 * │  ┌─────────────────────────────────────┐   │
 * │  │  Jane Doe                           │   │
 * │  │  Jan 15, 2:15 PM • 3 items         │   │
 * │  │  🏪 Pickup                          │   │
 * │  └─────────────────────────────────────┘   │
 * │                                            │
 * │  (Pull to refresh)                         │
 * └─────────────────────────────────────────────┘
 *
 * ============================================================
 * DATA FLOW
 * ============================================================
 *
 * 1. On mount/focus, fetch pending orders (getAvailableTasks)
 * 2. Extract customer IDs from orders
 * 3. Batch fetch customer profiles (getUserProfilesByIds)
 * 4. Display orders with customer names
 * 5. Tap order -> navigate to TaskDetail with orderId
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text, Icon, Card } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../../theme';
import { getAvailableTasks } from '../../services/orderService';
import { getUserProfilesByIds, getCustomerDisplayName } from '../../services/userService';
import type { ShopperStackParamList, Order, UserProfile } from '../../types';

// ============================================================
// TYPES
// ============================================================

type AvailableTasksScreenProps = NativeStackScreenProps<
  ShopperStackParamList,
  'AvailableTasks'
>;

/**
 * Combined order data with customer profile for display
 *
 * WHY COMBINE?
 * - Order has customerID but not customer name
 * - Need to join order data with profile data for display
 * - This type represents the "view model" for the list
 */
interface TaskWithCustomer {
  order: Order;
  customerProfile: UserProfile | null;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse the compact items string to get count
 *
 * WHY PARSE?
 * - Items stored as "productId:qty,productId:qty,..."
 * - Need to count total items for display
 *
 * @param itemsString - Compact items format
 * @returns Total item count
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
 * Format order date for display
 *
 * WHY FORMAT?
 * - ISO date strings are not user-friendly
 * - Show relative time for recent orders
 * - Show date + time for older orders
 */
const formatOrderDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  // Less than 1 hour ago
  if (diffMins < 60) {
    return `${diffMins} min ago`;
  }

  // Less than 24 hours ago
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }

  // Show date and time
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Determine fulfillment type from delivery address
 *
 * WHY CHECK ADDRESS?
 * - Pickup orders have address prefixed with "PICKUP: "
 * - Delivery orders have a regular address
 */
const getFulfillmentType = (deliveryAddress: string): 'delivery' | 'pickup' => {
  return deliveryAddress.startsWith('PICKUP:') ? 'pickup' : 'delivery';
};

// ============================================================
// COMPONENT
// ============================================================

const AvailableTasksScreen: React.FC<AvailableTasksScreenProps> = ({
  navigation,
}) => {
  const theme = useAppTheme();

  // ============================================================
  // STATE
  // ============================================================

  const [tasks, setTasks] = useState<TaskWithCustomer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  /**
   * Fetch available tasks and customer profiles
   *
   * WHY TWO QUERIES?
   * - Orders and UserProfiles are in separate collections
   * - First fetch orders, then batch fetch related profiles
   * - This is the standard "join" pattern for document databases
   */
  const fetchTasks = useCallback(async (isRefresh: boolean = false): Promise<void> => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Step 1: Fetch available orders
      const ordersResult = await getAvailableTasks();

      if (!ordersResult.success) {
        setError(ordersResult.error || 'Failed to fetch tasks');
        setTasks([]);
        return;
      }

      const orders = ordersResult.data;

      if (orders.length === 0) {
        setTasks([]);
        return;
      }

      // Step 2: Extract unique customer IDs
      const customerIds = orders.map((order) => order.customerID);

      // Step 3: Batch fetch customer profiles
      const profilesResult = await getUserProfilesByIds(customerIds);
      const profilesMap = profilesResult.success ? profilesResult.data : {};

      // Step 4: Combine orders with profiles
      const tasksWithCustomers: TaskWithCustomer[] = orders.map((order) => ({
        order,
        customerProfile: profilesMap[order.customerID] || null,
      }));

      setTasks(tasksWithCustomers);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * Fetch tasks when screen focuses
   *
   * WHY useFocusEffect?
   * - Refresh data when returning from TaskDetail
   * - Catch orders that may have been claimed by others
   * - Keep list current
   */
  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleRefresh = (): void => {
    fetchTasks(true);
  };

  const handleTaskPress = (orderId: string): void => {
    navigation.navigate('TaskDetail', { orderId });
  };

  // ============================================================
  // DYNAMIC STYLES
  // ============================================================

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
    orderInfo: {
      color: theme.custom.textSecondary,
    },
    fulfillmentBadge: {
      backgroundColor: theme.colors.primaryContainer,
    },
    fulfillmentText: {
      color: theme.colors.onPrimaryContainer,
    },
    emptyText: {
      color: theme.custom.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  /**
   * Render a single task card
   */
  const renderTaskCard = ({ item }: { item: TaskWithCustomer }): React.ReactElement => {
    const { order, customerProfile } = item;
    const customerName = getCustomerDisplayName(customerProfile);
    const itemCount = getItemCount(order.items);
    const orderDate = formatOrderDate(order.orderDate);
    const fulfillmentType = getFulfillmentType(order.deliveryAddress);

    return (
      <TouchableOpacity
        onPress={() => handleTaskPress(order.$id)}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Order from ${customerName}, ${itemCount} items, ${fulfillmentType}`}
        accessibilityHint="Double tap to view order details"
      >
        <Card style={[styles.card, dynamicStyles.card]} elevation={1}>
          <Card.Content style={styles.cardContent}>
            {/* Customer Name - Primary info, tappable */}
            <Text
              variant="titleMedium"
              style={[styles.customerName, dynamicStyles.customerName]}
            >
              {customerName}
            </Text>

            {/* Order Info - Date and item count */}
            <Text
              variant="bodyMedium"
              style={[styles.orderInfo, dynamicStyles.orderInfo]}
            >
              {orderDate} • {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>

            {/* Fulfillment Type Badge */}
            <View style={styles.fulfillmentRow}>
              <View style={[styles.fulfillmentBadge, dynamicStyles.fulfillmentBadge]}>
                <Icon
                  source={fulfillmentType === 'delivery' ? 'truck-delivery' : 'store'}
                  size={14}
                  color={dynamicStyles.fulfillmentText.color}
                />
                <Text
                  variant="labelSmall"
                  style={[styles.fulfillmentText, dynamicStyles.fulfillmentText]}
                >
                  {fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = (): React.ReactElement => (
    <View style={styles.emptyContainer}>
      <Icon source="clipboard-check" size={64} color={theme.custom.textDisabled} />
      <Text variant="titleMedium" style={[styles.emptyTitle, dynamicStyles.emptyText]}>
        No tasks available
      </Text>
      <Text variant="bodyMedium" style={[styles.emptySubtitle, dynamicStyles.emptyText]}>
        All orders have been claimed. Check back later!
      </Text>
    </View>
  );

  /**
   * Render error state
   */
  const renderErrorState = (): React.ReactElement => (
    <View style={styles.emptyContainer}>
      <Icon source="alert-circle" size={64} color={theme.colors.error} />
      <Text variant="titleMedium" style={[styles.emptyTitle, dynamicStyles.errorText]}>
        Unable to load tasks
      </Text>
      <Text variant="bodyMedium" style={[styles.emptySubtitle, dynamicStyles.emptyText]}>
        {error}
      </Text>
    </View>
  );

  // ============================================================
  // RENDER
  // ============================================================

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary, marginTop: 16 }}>
          Loading available tasks...
        </Text>
      </View>
    );
  }

  // Error state
  if (error && tasks.length === 0) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        {renderErrorState()}
      </View>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.order.$id}
        renderItem={renderTaskCard}
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

// ============================================================
// STYLES
// ============================================================

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
    gap: 4,
  },

  customerName: {
    fontWeight: '600',
  },

  orderInfo: {
    marginTop: 2,
  },

  fulfillmentRow: {
    flexDirection: 'row',
    marginTop: 8,
  },

  fulfillmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },

  fulfillmentText: {
    fontWeight: '500',
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

export default AvailableTasksScreen;
