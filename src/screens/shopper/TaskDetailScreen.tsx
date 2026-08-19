/**
 * Task Detail Screen
 * File: src/screens/shopper/TaskDetailScreen.tsx
 *
 * PURPOSE:
 * Shows full details of a specific order/task for the shopper.
 * Displays order ID, customer info, delivery details, and item list.
 *
 * ============================================================
 * SCREEN STRUCTURE
 * ============================================================
 *
 * ┌─────────────────────────────────────────────┐
 * │  [<- Back]    Task Details                  │
 * ├─────────────────────────────────────────────┤
 * │  ORDER INFO                                 │
 * │  ┌─────────────────────────────────────┐   │
 * │  │  Order #ABC12345                    │   │
 * │  │  John Smith                         │   │
 * │  │  Jan 15, 2024 at 2:30 PM           │   │
 * │  │  🚚 Delivery                        │   │
 * │  └─────────────────────────────────────┘   │
 * ├─────────────────────────────────────────────┤
 * │  DELIVERY ADDRESS                           │
 * │  ┌─────────────────────────────────────┐   │
 * │  │  123 Main St, Apt 4                │   │
 * │  │  Anytown, ST 12345                  │   │
 * │  │  Notes: Leave at door               │   │
 * │  └─────────────────────────────────────┘   │
 * ├─────────────────────────────────────────────┤
 * │  ORDER ITEMS (5)                            │
 * │  ┌─────────────────────────────────────┐   │
 * │  │  2x  Milk                    $7.98 │   │
 * │  │  1x  Bread                   $2.50 │   │
 * │  │  3x  Eggs                    $4.47 │   │
 * │  │  ─────────────────────────────────  │   │
 * │  │  Total                      $14.95 │   │
 * │  └─────────────────────────────────────┘   │
 * └─────────────────────────────────────────────┘
 *
 * ============================================================
 * DATA FLOW
 * ============================================================
 *
 * 1. Receive orderId via navigation params
 * 2. Fetch order details (getOrderById)
 * 3. Fetch customer profile (getUserProfileById)
 * 4. Parse items string and fetch product details
 * 5. Display all information
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text, Icon, Card, Divider, Button } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getOrderById, assignOrderToShopper, startShopping } from '../../services/orderService';
import {
  assignOrderToShopper as assignOrderInShopperStatus,
  getShopperStatus,
  swapCurrentOrder,
} from '../../services/shopperStatusService';
import { getUserProfileById, getCustomerDisplayName } from '../../services/userService';
import { getProductById } from '../../services/productService';
import type { ShopperStackParamList, Order, UserProfile, Product } from '../../types';

// ============================================================
// TYPES
// ============================================================

type TaskDetailScreenProps = NativeStackScreenProps<
  ShopperStackParamList,
  'TaskDetail'
>;

/**
 * Parsed item with product details for display
 */
interface OrderItem {
  productId: string;
  quantity: number;
  product: Product | null;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse the compact items string into array of items
 *
 * FORMAT: "productId:qty,productId:qty,..."
 */
const parseItemsString = (itemsString: string): { productId: string; quantity: number }[] => {
  if (!itemsString) return [];

  return itemsString.split(',').map((pair) => {
    const parts = pair.split(':');
    const productId = parts[0] ?? '';
    const qty = parts[1];
    return {
      productId,
      quantity: parseInt(qty ?? '0', 10) || 0,
    };
  }).filter((item) => item.productId && item.quantity > 0);
};

/**
 * Format order date for display
 */
const formatOrderDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Get short order ID (last 8 characters, uppercase)
 */
const getShortOrderId = (orderId: string): string => {
  return orderId.slice(-8).toUpperCase();
};

/**
 * Determine fulfillment type and clean address
 */
const parseDeliveryAddress = (deliveryAddress: string): {
  fulfillmentType: 'delivery' | 'pickup';
  address: string;
} => {
  if (deliveryAddress.startsWith('PICKUP:')) {
    return {
      fulfillmentType: 'pickup',
      address: deliveryAddress.replace('PICKUP:', '').trim(),
    };
  }
  return {
    fulfillmentType: 'delivery',
    address: deliveryAddress,
  };
};

// ============================================================
// COMPONENT
// ============================================================

const TaskDetailScreen: React.FC<TaskDetailScreenProps> = ({ route, navigation }) => {
  const theme = useAppTheme();
  const { orderId } = route.params;
  const { userProfile } = useAuth();

  // ============================================================
  // STATE
  // ============================================================

  const [order, setOrder] = useState<Order | null>(null);
  const [customerProfile, setCustomerProfile] = useState<UserProfile | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  /**
   * Whether this shopper already has a different order in flight
   * (ShopperStatus.currentOrderId set to something other than this
   * order). Needed to gate the 'claim' action - without this check, a
   * shopper could claim a second order while still working a first one,
   * orphaning it: ShopperStatus.currentOrderId can only point at one
   * order, so the first order's shopperID would stay set with no path
   * back to the queue (the same failure mode the "releasing a shopper's
   * order when they go unavailable" fix exists to prevent elsewhere -
   * see docs/DECISIONS.md).
   */
  const [shopperActiveOrderId, setShopperActiveOrderId] = useState<string | null>(null);

  /**
   * Full record of the shopper's current active order, fetched only so
   * the swap confirmation dialog can show what's being given up (short
   * id + due time) - not needed for the claim-gating check above, which
   * only needs the id.
   */
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    const shopperId = userProfile?.shopperID;
    if (!shopperId) return;

    getShopperStatus(shopperId).then((result) => {
      if (result.success && result.data) {
        const currentOrderId = result.data.currentOrderId || null;
        setShopperActiveOrderId(currentOrderId);

        if (currentOrderId) {
          getOrderById(currentOrderId).then((orderResult) => {
            if (orderResult.success && orderResult.data) {
              setActiveOrder(orderResult.data);
            }
          });
        }
      }
    });
  }, [userProfile?.shopperID]);

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * Fetch all order data on mount
   *
   * WHY SEQUENTIAL FETCHES?
   * 1. Fetch order first (needed for customerID and items)
   * 2. Then fetch customer profile and products in parallel
   * 3. This minimizes total loading time
   */
  useEffect(() => {
    const fetchOrderData = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch the order
        const orderResult = await getOrderById(orderId);

        if (!orderResult.success || !orderResult.data) {
          setError(orderResult.error || 'Order not found');
          setLoading(false);
          return;
        }

        const fetchedOrder = orderResult.data;
        setOrder(fetchedOrder);

        // Step 2: Fetch customer profile
        const profileResult = await getUserProfileById(fetchedOrder.customerID);
        if (profileResult.success && profileResult.data) {
          setCustomerProfile(profileResult.data);
        }

        // Step 3: Parse items and fetch products
        const parsedItems = parseItemsString(fetchedOrder.items);

        // Fetch product details for each item
        const itemsWithProducts: OrderItem[] = await Promise.all(
          parsedItems.map(async (item) => {
            const productResult = await getProductById(item.productId);
            return {
              productId: item.productId,
              quantity: item.quantity,
              product: productResult.success ? productResult.data : null,
            };
          })
        );

        setOrderItems(itemsWithProducts);
      } catch (err) {
        console.error('Error fetching order data:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId]);

  // ============================================================
  // SHOPPER ACTION (claim / start / continue)
  // ============================================================

  /**
   * Determine what action, if any, this shopper can take on the order.
   *
   * WHY DERIVE THIS FROM status + shopperID INSTEAD OF A STORED FLAG?
   * - The three states (claimable, startable, continuable) fall directly
   *   out of the order's existing status/shopperID fields - no new field
   *   needed to track "what can this shopper do right now"
   */
  type ShopperAction = 'claim' | 'swap' | 'start' | 'continue' | null;

  const getShopperAction = (): ShopperAction => {
    if (!order || !userProfile?.shopperID) return null;

    if (order.status === 'pending' && !order.shopperID) {
      // A shopper already mid-task gets 'swap' instead of 'claim' - the
      // gate that used to just hide the action outright now offers the
      // swap flow instead
      return shopperActiveOrderId ? 'swap' : 'claim';
    }
    if (order.shopperID === userProfile.shopperID) {
      if (order.status === 'assigned') return 'start';
      if (order.status === 'shopping') return 'continue';
    }
    return null;
  };

  /**
   * Format a due time for the swap confirmation dialog
   */
  const formatDueTime = (scheduledReadyTime: string): string => {
    return new Date(scheduledReadyTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const confirmAndSwap = (): void => {
    if (!order || !activeOrder) return;

    Alert.alert(
      'Swap Current Order?',
      `You're currently working Order #${getShortOrderId(activeOrder.$id)} ` +
        `(due ${formatDueTime(activeOrder.scheduledReadyTime)}). Swapping will release it back ` +
        `to the queue and start Order #${getShortOrderId(order.$id)} instead. ` +
        'Any progress on the current order is kept for whoever picks it up next.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Swap', style: 'destructive', onPress: () => handleShopperAction('swap') },
      ]
    );
  };

  const handleShopperAction = async (action: ShopperAction): Promise<void> => {
    if (!order || !userProfile?.shopperID || !action) return;

    setActionLoading(true);
    try {
      if (action === 'claim') {
        // Manual claim from the available-tasks list - not an
        // auto-assignment, so autoAssigned is explicitly false
        const assignResult = await assignOrderToShopper(order.$id, userProfile.shopperID, false);
        if (!assignResult.success) {
          Alert.alert('Error', assignResult.error ?? 'Failed to claim order');
          return;
        }
        await assignOrderInShopperStatus(userProfile.shopperID, order.$id);
        const startResult = await startShopping(order.$id);
        if (!startResult.success) {
          Alert.alert('Error', startResult.error ?? 'Failed to start shopping');
          return;
        }
        navigation.navigate('Shopping', { orderId: order.$id });
      } else if (action === 'start') {
        const startResult = await startShopping(order.$id);
        if (!startResult.success) {
          Alert.alert('Error', startResult.error ?? 'Failed to start shopping');
          return;
        }
        navigation.navigate('Shopping', { orderId: order.$id });
      } else if (action === 'continue') {
        navigation.navigate('Shopping', { orderId: order.$id });
      } else if (action === 'swap') {
        if (!shopperActiveOrderId) return;
        const swapResult = await swapCurrentOrder(userProfile.shopperID, shopperActiveOrderId, order.$id);
        if (!swapResult.success) {
          Alert.alert('Error', swapResult.error ?? 'Failed to swap order');
          return;
        }
        navigation.navigate('Shopping', { orderId: order.$id });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const actionLabels: Record<Exclude<ShopperAction, null>, string> = {
    claim: 'Claim & Start Shopping',
    swap: 'Swap for This Order',
    start: 'Start Shopping',
    continue: 'Continue Shopping',
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
    sectionTitle: {
      color: theme.custom.textSecondary,
    },
    orderId: {
      color: theme.colors.primary,
    },
    customerName: {
      color: theme.colors.onSurface,
    },
    orderDate: {
      color: theme.custom.textSecondary,
    },
    fulfillmentBadge: {
      backgroundColor: theme.colors.primaryContainer,
    },
    fulfillmentText: {
      color: theme.colors.onPrimaryContainer,
    },
    address: {
      color: theme.colors.onSurface,
    },
    notes: {
      color: theme.custom.textSecondary,
    },
    itemName: {
      color: theme.colors.onSurface,
    },
    itemPrice: {
      color: theme.custom.textSecondary,
    },
    totalLabel: {
      color: theme.colors.onSurface,
    },
    totalAmount: {
      color: theme.colors.primary,
    },
    errorText: {
      color: theme.colors.error,
    },
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  /**
   * Render a single order item
   */
  const renderOrderItem = (item: OrderItem, index: number): React.ReactElement => {
    const productName = item.product?.name ?? 'Unknown Product';
    const price = item.product?.price ?? 0;
    const lineTotal = price * item.quantity;

    return (
      <View key={item.productId + index} style={styles.itemRow}>
        <Text variant="bodyMedium" style={[styles.itemQuantity, dynamicStyles.itemName]}>
          {item.quantity}x
        </Text>
        <Text variant="bodyMedium" style={[styles.itemName, dynamicStyles.itemName]} numberOfLines={1}>
          {productName}
        </Text>
        <Text variant="bodyMedium" style={[styles.itemPrice, dynamicStyles.itemPrice]}>
          ${lineTotal.toFixed(2)}
        </Text>
      </View>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  // Loading state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, dynamicStyles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary, marginTop: 16 }}>
          Loading order details...
        </Text>
      </View>
    );
  }

  // Error state
  if (error || !order) {
    return (
      <View style={[styles.errorContainer, dynamicStyles.container]}>
        <Icon source="alert-circle" size={64} color={theme.colors.error} />
        <Text variant="titleMedium" style={[styles.errorTitle, dynamicStyles.errorText]}>
          Unable to load order
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary, marginTop: 8 }}>
          {error || 'Order not found'}
        </Text>
      </View>
    );
  }

  // Parse delivery info
  const { fulfillmentType, address } = parseDeliveryAddress(order.deliveryAddress);
  const customerName = getCustomerDisplayName(customerProfile);
  const shortOrderId = getShortOrderId(order.$id);
  const totalItemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const shopperAction = getShopperAction();

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.container]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================
          ORDER INFO SECTION
          ============================================================ */}
      <Text variant="labelMedium" style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
        ORDER INFO
      </Text>
      <Card style={[styles.card, dynamicStyles.card]} elevation={1}>
        <Card.Content style={styles.cardContent}>
          {/* Order ID */}
          <Text variant="titleLarge" style={[styles.orderId, dynamicStyles.orderId]}>
            Order #{shortOrderId}
          </Text>

          {/* Customer Name */}
          <View style={styles.infoRow}>
            <Icon source="account" size={20} color={theme.custom.textSecondary} />
            <Text variant="bodyLarge" style={[styles.customerName, dynamicStyles.customerName]}>
              {customerName}
            </Text>
          </View>

          {/* Order Date */}
          <View style={styles.infoRow}>
            <Icon source="calendar" size={20} color={theme.custom.textSecondary} />
            <Text variant="bodyMedium" style={[styles.orderDate, dynamicStyles.orderDate]}>
              {formatOrderDate(order.orderDate)}
            </Text>
          </View>

          {/* Fulfillment Type */}
          <View style={styles.fulfillmentRow}>
            <View style={[styles.fulfillmentBadge, dynamicStyles.fulfillmentBadge]}>
              <Icon
                source={fulfillmentType === 'delivery' ? 'truck-delivery' : 'store'}
                size={16}
                color={dynamicStyles.fulfillmentText.color}
              />
              <Text variant="labelMedium" style={[styles.fulfillmentText, dynamicStyles.fulfillmentText]}>
                {fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* ============================================================
          DELIVERY/PICKUP ADDRESS SECTION
          ============================================================ */}
      <Text variant="labelMedium" style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
        {fulfillmentType === 'delivery' ? 'DELIVERY ADDRESS' : 'PICKUP LOCATION'}
      </Text>
      <Card style={[styles.card, dynamicStyles.card]} elevation={1}>
        <Card.Content>
          <View style={styles.infoRow}>
            <Icon
              source={fulfillmentType === 'delivery' ? 'map-marker' : 'store'}
              size={20}
              color={theme.custom.textSecondary}
            />
            <Text variant="bodyMedium" style={[styles.address, dynamicStyles.address]}>
              {address}
            </Text>
          </View>

          {/* Delivery Notes */}
          {order.deliveryNotes && (
            <View style={[styles.infoRow, styles.notesRow]}>
              <Icon source="note-text" size={20} color={theme.custom.textSecondary} />
              <Text variant="bodyMedium" style={[styles.notes, dynamicStyles.notes]}>
                {order.deliveryNotes}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* ============================================================
          ORDER ITEMS SECTION
          ============================================================ */}
      <Text variant="labelMedium" style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
        ORDER ITEMS ({totalItemCount})
      </Text>
      <Card style={[styles.card, dynamicStyles.card]} elevation={1}>
        <Card.Content>
          {/* Items List */}
          {orderItems.map((item, index) => renderOrderItem(item, index))}

          {/* Divider before total */}
          <Divider style={styles.divider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text variant="titleMedium" style={[styles.totalLabel, dynamicStyles.totalLabel]}>
              Total
            </Text>
            <Text variant="titleMedium" style={[styles.totalAmount, dynamicStyles.totalAmount]}>
              ${order.totalAmount.toFixed(2)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Shopper Action */}
      {shopperAction && (
        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={() => (shopperAction === 'swap' ? confirmAndSwap() : handleShopperAction(shopperAction))}
            loading={actionLoading}
            disabled={actionLoading}
            style={styles.actionButton}
          >
            {actionLabels[shopperAction]}
          </Button>
        </View>
      )}

      {/* Bottom padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  errorTitle: {
    marginTop: 16,
    fontWeight: '500',
  },

  sectionTitle: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },

  card: {
    borderRadius: 12,
  },

  cardContent: {
    gap: 12,
  },

  orderId: {
    fontWeight: '700',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  customerName: {
    fontWeight: '500',
  },

  orderDate: {
    // Style from dynamicStyles
  },

  fulfillmentRow: {
    flexDirection: 'row',
    marginTop: 4,
  },

  fulfillmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },

  fulfillmentText: {
    fontWeight: '600',
  },

  address: {
    flex: 1,
  },

  notesRow: {
    marginTop: 8,
  },

  notes: {
    flex: 1,
    fontStyle: 'italic',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  itemQuantity: {
    width: 32,
    fontWeight: '500',
  },

  itemName: {
    flex: 1,
    marginLeft: 8,
  },

  itemPrice: {
    marginLeft: 8,
  },

  divider: {
    marginVertical: 12,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontWeight: '600',
  },

  totalAmount: {
    fontWeight: '700',
  },

  bottomPadding: {
    height: 32,
  },

  actionContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },

  actionButton: {
    borderRadius: 8,
  },
});

export default TaskDetailScreen;
