/**
 * Order Confirmation Screen
 * File: src/screens/customer/OrderConfirmationScreen.tsx
 *
 * PURPOSE: Display order success confirmation after checkout
 *
 * UI LAYOUT:
 * - Success message "Order Placed!"
 * - Checkmark icon
 * - Order ID
 * - Delivery/Pickup summary
 * - Item count and total
 * - "Continue Shopping" button
 *
 * WHY SEPARATE SCREEN?
 * - Clear success state (not just an alert)
 * - Displays order details for user reference
 * - Standard e-commerce pattern
 * - Can add order tracking link later
 *
 * NAVIGATION:
 * - Arrived via navigation.replace() from Checkout
 * - "Continue Shopping" navigates to CustomerHome
 * - No back navigation to Checkout (cart is cleared)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getOrderById, getPickupLocations } from '../../services/orderService';
import { formatPrice } from '../../services/productService';
import { useAppTheme } from '../../theme';
import type { MainStackParamList, Order } from '../../types';

/**
 * WHY THESE IMPORTS?
 *
 * React:
 * - useState: Loading and order state
 * - useEffect: Fetch order on mount
 *
 * React Native:
 * - View, Text: Layout and typography
 * - TouchableOpacity: Continue Shopping button
 * - ActivityIndicator: Loading state
 *
 * Navigation:
 * - NativeStackScreenProps: Type-safe navigation with orderId param
 *
 * Services:
 * - getOrderById: Fetch order details
 * - getPickupLocations: Map pickup location ID to name
 * - formatPrice: Consistent price display
 *
 * Types:
 * - Navigation params, Order, CartItem
 */

type OrderConfirmationScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'OrderConfirmation'
>;

const OrderConfirmationScreen: React.FC<OrderConfirmationScreenProps> = ({
  navigation,
  route,
}) => {
  /**
   * WHY route.params.orderId?
   * - Passed from CheckoutScreen after order creation
   * - Used to fetch full order details
   * - Displayed truncated in UI
   */
  const { orderId } = route.params;

  // ============================================================
  // THEME
  // ============================================================

  const theme = useAppTheme();

  // ============================================================
  // STATE
  // ============================================================

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * WHY THESE STATES?
   * - order: Full order data from database
   * - loading: Show spinner while fetching
   * - error: Handle fetch failures gracefully
   */

  // ============================================================
  // DATA FETCHING
  // ============================================================

  useEffect(() => {
    /**
     * WHY useEffect?
     * - Fetch order when component mounts
     * - orderId is available from navigation params
     *
     * WHY ASYNC FUNCTION INSIDE?
     * - useEffect callback can't be async directly
     * - Define and call async function inside
     */
    const fetchOrder = async (): Promise<void> => {
      try {
        const result = await getOrderById(orderId);

        if (result.success && result.data) {
          setOrder(result.data);
        } else {
          setError(result.error ?? 'Failed to load order details');
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Get item count from order
   *
   * WHY PARSE COMPACT FORMAT?
   * - Order.items is compact string: "id:qty,id:qty,..."
   * - Need to sum quantities for display
   */
  const getItemCount = (): number => {
    if (!order || !order.items) return 0;

    try {
      /**
       * Parse compact format: "abc123:2,def456:1"
       * Split by comma, then split each by colon to get quantity
       */
      const itemPairs = order.items.split(',');
      return itemPairs.reduce((sum, pair) => {
        const parts = pair.split(':');
        const quantityStr = parts[1] ?? '0';
        const quantity = parseInt(quantityStr, 10);
        return sum + (isNaN(quantity) ? 0 : quantity);
      }, 0);
    } catch {
      return 0;
    }
  };

  /**
   * Get display text for delivery/pickup location
   */
  const getLocationText = (): string => {
    if (!order) return '';

    /**
     * WHY CHECK FOR "PICKUP:" PREFIX?
     * - Pickup orders store location in deliveryAddress with "PICKUP: " prefix
     * - Delivery orders have regular address
     * - This distinguishes between the two fulfillment types
     */
    if (order.deliveryAddress.startsWith('PICKUP:')) {
      const locationName = order.deliveryAddress.replace('PICKUP: ', '');
      const locations = getPickupLocations();
      const location = locations.find((loc) => loc.name === locationName);

      if (location) {
        return `Pickup at:\n${location.name}\n${location.address}`;
      }

      return `Pickup at:\n${locationName}`;
    }

    return `Delivery to:\n${order.deliveryAddress}`;
  };

  /**
   * Handle continue shopping
   *
   * WHY reset TO CustomerHome?
   * - Clears entire navigation stack
   * - Fresh start for shopping
   * - Can't go "back" to confirmation
   * - Standard e-commerce flow
   */
  const handleContinueShopping = (): void => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CustomerHome' }],
    });
  };

  // ============================================================
  // DYNAMIC STYLES
  // ============================================================

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    centerContainer: {
      backgroundColor: theme.colors.background,
    },
    title: {
      color: theme.colors.onBackground,
    },
    checkmarkContainer: {
      backgroundColor: theme.custom.success,
    },
    checkmark: {
      color: theme.colors.onPrimary,
    },
    successIcon: {
      color: theme.custom.success,
    },
    orderId: {
      color: theme.custom.textSecondary,
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
    },
    locationText: {
      color: theme.colors.onSurface,
    },
    summaryRow: {
      borderTopColor: theme.custom.divider,
    },
    summaryText: {
      color: theme.colors.onSurface,
    },
    loadingText: {
      color: theme.custom.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.custom.border,
    },
    continueButton: {
      backgroundColor: theme.colors.primary,
    },
    continueButtonText: {
      color: theme.colors.onPrimary,
    },
  };

  // ============================================================
  // RENDER - LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <View style={[styles.centerContainer, dynamicStyles.centerContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading order details...</Text>
      </View>
    );
  }

  // ============================================================
  // RENDER - ERROR STATE
  // ============================================================

  /**
   * WHY SHOW ERROR STATE?
   * - Order fetch might fail
   * - User still knows order was placed
   * - Can still continue shopping
   */
  if (error || !order) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={styles.content}>
          {/* Still show success since order was placed */}
          <Text style={[styles.successIcon, dynamicStyles.successIcon]}>✓</Text>
          <Text style={[styles.title, dynamicStyles.title]}>Order Placed!</Text>
          <Text style={[styles.orderId, dynamicStyles.orderId]}>Order #{orderId.slice(0, 8)}...</Text>
          <Text style={[styles.errorText, dynamicStyles.errorText]}>
            {error ?? 'Could not load order details'}
          </Text>
        </View>

        <View style={[styles.footer, dynamicStyles.footer]}>
          <TouchableOpacity
            style={[styles.continueButton, dynamicStyles.continueButton]}
            onPress={handleContinueShopping}
            accessible={true}
            accessibilityLabel="Continue shopping"
            accessibilityHint="Return to the home screen to continue shopping"
            accessibilityRole="button"
          >
            <Text style={[styles.continueButtonText, dynamicStyles.continueButtonText]}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================================
  // RENDER - SUCCESS STATE
  // ============================================================

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <View style={styles.content}>
        {/* ===== SUCCESS HEADER ===== */}
        <Text style={[styles.title, dynamicStyles.title]}>Order Placed!</Text>

        {/* ===== CHECKMARK ICON ===== */}
        <View style={[styles.checkmarkContainer, dynamicStyles.checkmarkContainer]}>
          <Text style={[styles.checkmark, dynamicStyles.checkmark]}>✓</Text>
        </View>

        {/* ===== ORDER ID ===== */}
        <Text style={[styles.orderId, dynamicStyles.orderId]}>
          Order #{orderId.slice(0, 8).toUpperCase()}
        </Text>
        {/**
         * WHY SLICE AND UPPERCASE?
         * - Full Appwrite ID is long
         * - First 8 chars is unique enough for display
         * - Uppercase looks more like order number
         */}

        {/* ===== DELIVERY/PICKUP INFO ===== */}
        <View style={[styles.infoCard, dynamicStyles.infoCard]}>
          <Text style={[styles.locationText, dynamicStyles.locationText]}>{getLocationText()}</Text>

          {/* ===== ITEM COUNT AND TOTAL ===== */}
          <View style={[styles.summaryRow, dynamicStyles.summaryRow]}>
            <Text style={[styles.summaryText, dynamicStyles.summaryText]}>
              {getItemCount()} {getItemCount() === 1 ? 'item' : 'items'}
            </Text>
            <Text style={[styles.summaryText, dynamicStyles.summaryText]}>
              {formatPrice(order.totalAmount)}
            </Text>
          </View>
        </View>

        {/**
         * FUTURE ADDITIONS:
         * - Estimated delivery/pickup time
         * - Order tracking link
         * - Share order button
         * - Add to calendar (pickup)
         */}
      </View>

      {/* ===== CONTINUE SHOPPING BUTTON ===== */}
      <View style={[styles.footer, dynamicStyles.footer]}>
        <TouchableOpacity
          style={[styles.continueButton, dynamicStyles.continueButton]}
          onPress={handleContinueShopping}
          accessible={true}
          accessibilityLabel="Continue shopping"
          accessibilityHint="Return to the home screen to continue shopping"
          accessibilityRole="button"
        >
          <Text style={[styles.continueButtonText, dynamicStyles.continueButtonText]}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
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

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    /**
     * WHY CENTER CONTENT?
     * - Success screen is celebratory
     * - Centered layout feels complete
     * - User attention on success message
     */
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    /**
     * WHY LARGE TITLE?
     * - Primary success message
     * - Celebratory tone
     */
  },

  checkmarkContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    /**
     * WHY GREEN CIRCLE?
     * - Success color (green)
     * - Visual confirmation
     * - Standard success pattern
     */
  },

  checkmark: {
    fontSize: 40,
    fontWeight: 'bold',
  },

  successIcon: {
    fontSize: 48,
    marginBottom: 16,
  },

  orderId: {
    fontSize: 18,
    marginBottom: 32,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    /**
     * WHY MONOSPACE?
     * - Looks like order/tracking number
     * - Professional appearance
     * - Easy to read character by character
     */
  },

  infoCard: {
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    /**
     * WHY maxWidth?
     * - Prevent overly wide card on tablets
     * - Centered, contained look
     */
  },

  locationText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    /**
     * WHY lineHeight: 24?
     * - Multi-line address readability
     * - Breathing room between lines
     */
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 16,
  },

  summaryText: {
    fontSize: 16,
    fontWeight: '500',
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },

  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },

  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },

  continueButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },

  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default OrderConfirmationScreen;
