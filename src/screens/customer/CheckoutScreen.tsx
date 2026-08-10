/**
 * Checkout Screen
 * File: src/screens/customer/CheckoutScreen.tsx
 *
 * PURPOSE: Main checkout flow for placing orders
 *
 * RESPONSIBILITIES:
 * - Manage checkout form state (fulfillment type, address, pickup location)
 * - Validate required fields before submission
 * - Create order in Appwrite database
 * - Clear cart and navigate to confirmation on success
 *
 * UI STRUCTURE:
 * - KeyboardAvoidingView wraps entire screen
 * - ScrollView for form content
 * - FulfillmentTypeSelector (delivery/pickup toggle)
 * - DeliveryAddressForm OR PickupLocationSelector (conditional)
 * - OrderSummaryCard (cart review)
 * - Fixed "Place Order" button at bottom
 *
 * FOLLOWS PATTERN FROM: RegisterScreen (form handling, validation, submission)
 * FOLLOWS PATTERN FROM: CartScreen (container/presentational, context usage)
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme';
import FulfillmentTypeSelector from '../../components/customer/FulfillmentTypeSelector';
import DeliveryAddressForm from '../../components/customer/DeliveryAddressForm';
import PickupLocationSelector from '../../components/customer/PickupLocationSelector';
import TimeSlotSelector from '../../components/customer/TimeSlotSelector';
import OrderSummaryCard from '../../components/customer/OrderSummaryCard';
import {
  createOrder,
  formatDeliveryAddress,
  getPickupLocations,
  getAvailableTimeSlots,
} from '../../services/orderService';
import { formatPrice } from '../../services/productService';
import type { MainStackParamList, FulfillmentType, CreateOrderData } from '../../types';

/**
 * WHY THESE IMPORTS?
 *
 * React Native components:
 * - View, ScrollView: Layout containers
 * - KeyboardAvoidingView: Handle keyboard overlap
 * - TouchableOpacity: Place Order button
 * - Text: Button text, error messages
 * - Alert: Validation errors
 * - ActivityIndicator: Loading state
 *
 * Navigation:
 * - NativeStackScreenProps: Type-safe navigation
 *
 * Context:
 * - useCart: Access cart items and functions
 * - useAuth: Access user for order creation
 *
 * Components:
 * - All checkout form components we created
 *
 * Services:
 * - Order creation and formatting utilities
 * - Price formatting for button
 *
 * Types:
 * - Navigation params, fulfillment type, order data
 */

type CheckoutScreenProps = NativeStackScreenProps<MainStackParamList, 'Checkout'>;

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation }) => {
  // ============================================================
  // CONTEXT AND THEME
  // ============================================================

  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const theme = useAppTheme();

  /**
   * WHY THESE CONTEXT VALUES?
   * - cartItems: Display in OrderSummary, serialize for order
   * - getCartTotal: Calculate subtotal for display and order
   * - clearCart: Empty cart after successful order
   * - user: Get customerId for order creation
   */

  // ============================================================
  // FORM STATE
  // ============================================================

  /**
   * FULFILLMENT TYPE STATE
   *
   * WHY 'delivery' DEFAULT?
   * - Most common choice (based on industry data)
   * - Better UX than no selection
   * - User can easily switch to pickup
   */
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('delivery');

  /**
   * DELIVERY ADDRESS STATE
   *
   * WHY SEPARATE FIELDS?
   * - Granular validation possible
   * - Match DeliveryAddressForm props
   * - Standard address form pattern
   */
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [aptSuite, setAptSuite] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  /**
   * PICKUP STATE
   *
   * WHY EMPTY STRING DEFAULT?
   * - No location selected initially
   * - Forces user to make explicit choice
   * - Empty string is falsy for validation
   */
  const [selectedPickupLocation, setSelectedPickupLocation] = useState<string>('');

  /**
   * PICKUP TIME SLOT STATE
   * Stores the selected slot's id, which is the same ISO timestamp
   * used as its startTime (see PickupTimeSlot).
   */
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  /**
   * UI STATE
   *
   * WHY loading STATE?
   * - Disable button during submission
   * - Show ActivityIndicator
   * - Prevent double-submission
   */
  const [loading, setLoading] = useState<boolean>(false);

  // ============================================================
  // DATA
  // ============================================================

  /**
   * WHY GET LOCATIONS HERE?
   * - Could be fetched or static
   * - Currently static from orderService
   * - Easy to make async later
   */
  const pickupLocations = getPickupLocations();
  const timeSlots = getAvailableTimeSlots();

  // ============================================================
  // VALIDATION
  // ============================================================

  /**
   * Validate form before submission
   *
   * WHY SEPARATE FUNCTION?
   * - Clear validation logic
   * - Easy to extend with more rules
   * - Follows RegisterScreen pattern
   *
   * @returns true if valid, false if invalid (shows alert)
   */
  const validateForm = (): boolean => {
    /**
     * WHY CHECK CART FIRST?
     * - Edge case: user navigates here with empty cart
     * - Shouldn't be possible, but defensive
     */
    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return false;
    }

    /**
     * WHY CHECK USER?
     * - Need customerId for order
     * - Should always exist (screen requires auth)
     * - Defensive programming
     */
    if (!user) {
      Alert.alert('Error', 'You must be logged in to place an order');
      return false;
    }

    /**
     * DELIVERY VALIDATION
     * - All address fields except aptSuite and notes required
     * - Standard address validation
     */
    if (fulfillmentType === 'delivery') {
      if (!streetAddress.trim()) {
        Alert.alert('Error', 'Please enter your street address');
        return false;
      }
      if (!city.trim()) {
        Alert.alert('Error', 'Please enter your city');
        return false;
      }
      if (!state.trim()) {
        Alert.alert('Error', 'Please enter your state');
        return false;
      }
      if (!zipCode.trim()) {
        Alert.alert('Error', 'Please enter your ZIP code');
        return false;
      }
      /**
       * WHY BASIC ZIP VALIDATION?
       * - At least 5 digits for US ZIP
       * - Simple check, not comprehensive
       * - Full validation would use regex or library
       */
      if (zipCode.trim().length < 5) {
        Alert.alert('Error', 'Please enter a valid ZIP code');
        return false;
      }
    }

    /**
     * PICKUP VALIDATION
     * - Must select a location
     */
    if (fulfillmentType === 'pickup') {
      if (!selectedPickupLocation) {
        Alert.alert('Error', 'Please select a pickup location');
        return false;
      }
      if (!selectedTimeSlot) {
        Alert.alert('Error', 'Please select a pickup time');
        return false;
      }
    }

    return true;
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * Handle order submission
   *
   * FLOW:
   * 1. Validate form (show alert if invalid)
   * 2. Set loading state
   * 3. Build order data
   * 4. Call createOrder service
   * 5. On success: clear cart, navigate to confirmation
   * 6. On error: show alert
   */
  const handlePlaceOrder = async (): Promise<void> => {
    /**
     * WHY EARLY RETURN ON INVALID?
     * - Don't proceed if validation fails
     * - Alert already shown by validateForm
     */
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      /**
       * BUILD ORDER DATA
       *
       * WHY COMPACT ITEMS FORMAT?
       * - Appwrite items field limited to 200 characters
       * - Format: "productId:quantity,productId:quantity,..."
       * - Example: "abc123:2,def456:1,ghi789:3"
       * - Product details fetched separately when needed
       */
      const compactItems = cartItems
        .map((item) => `${item.$id}:${item.quantity}`)
        .join(',');

      /**
       * Calculate scheduled ready time
       * Pickup orders use the customer-selected time slot; delivery orders
       * still default to 30 minutes from now (no time-slot UI for delivery yet).
       */
      const scheduledReadyTime =
        fulfillmentType === 'pickup'
          ? selectedTimeSlot
          : new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const orderData: CreateOrderData = {
        customerID: user!.$id,
        /**
         * WHY user!.$id?
         * - TypeScript knows user could be null
         * - We validated user exists above
         * - Non-null assertion is safe here
         *
         * WHY customerID (uppercase ID)?
         * - Matches Appwrite collection schema
         * - Consistent with UserProfile.userID pattern
         */
        shopperID: '',
        /**
         * WHY EMPTY STRING?
         * - No shopper assigned yet for new orders
         * - Will be populated when shopper accepts order
         * - Appwrite requires this field (not optional)
         */
        status: 'pending',
        /**
         * WHY 'pending'?
         * - New orders start as pending
         * - Will be updated to 'assigned' when shopper accepts
         */
        items: compactItems,
        totalAmount: getCartTotal(),
        deliveryAddress:
          fulfillmentType === 'delivery'
            ? formatDeliveryAddress(streetAddress, aptSuite, city, state, zipCode)
            : `PICKUP: ${pickupLocations.find(loc => loc.id === selectedPickupLocation)?.name ?? selectedPickupLocation}`,
        /**
         * WHY STORE PICKUP LOCATION IN deliveryAddress?
         * - Appwrite schema doesn't have separate pickupLocation field
         * - Prefix with "PICKUP:" to distinguish from delivery addresses
         * - Stores the location name for display purposes
         */
        deliveryNotes: fulfillmentType === 'delivery' ? deliveryNotes : undefined,
        autoAssigned: false,
        /**
         * WHY autoAssigned: false?
         * - Order not yet assigned to shopper
         * - Will be true when system auto-assigns
         */
        priority: 0,
        /**
         * WHY priority: 0?
         * - Default priority
         * - Could be higher for premium customers
         */
        orderDate: new Date().toISOString(),
        /**
         * WHY ISO STRING?
         * - Standard date format
         * - Sortable
         * - Works across timezones
         */
        scheduledReadyTime,
        /**
         * WHY scheduledReadyTime?
         * - Tells shoppers when the order should be ready
         * - Used for auto-assignment priority (closest due time first)
         * - Currently set to 30 min from now (immediate orders)
         */
        pickedItems: '',
        /**
         * WHY EMPTY STRING?
         * - No items picked yet for new orders
         * - Will be updated as shopper picks items
         * - Format: "productId:pickedQty,..."
         */
      };

      /**
       * CREATE ORDER IN DATABASE
       */
      const result = await createOrder(orderData);

      if (result.success && result.data) {
        /**
         * SUCCESS FLOW
         *
         * WHY clearCart BEFORE navigate?
         * - Cart should be empty after order
         * - Can't go back to checkout with empty cart
         * - Clean state for next shopping session
         */
        await clearCart();

        /**
         * WHY navigation.replace?
         * - Replaces Checkout in stack with OrderConfirmation
         * - Back button goes to Cart/Home, NOT back to Checkout
         * - Prevents resubmitting order
         * - Standard e-commerce pattern
         */
        navigation.replace('OrderConfirmation', {
          orderId: result.data.$id,
        });
      } else {
        /**
         * ERROR HANDLING
         *
         * WHY Alert.alert?
         * - Consistent with validation errors
         * - Clear message to user
         * - Can retry after dismissing
         */
        Alert.alert(
          'Order Failed',
          result.error ?? 'Failed to place order. Please try again.'
        );
      }
    } catch (error) {
      /**
       * WHY CATCH BLOCK?
       * - Catch unexpected errors
       * - Don't crash app
       * - Log for debugging
       */
      console.error('Unexpected error placing order:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      /**
       * WHY FINALLY?
       * - Always reset loading state
       * - Even if error or navigation happens
       * - Prevents stuck loading state
       */
      setLoading(false);
    }
  };

  // ============================================================
  // DYNAMIC STYLES
  // ============================================================

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.background,
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.custom.border,
    },
    placeOrderButton: {
      backgroundColor: theme.colors.primary,
    },
    placeOrderButtonText: {
      color: theme.colors.onPrimary,
    },
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, dynamicStyles.container]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <FulfillmentTypeSelector
          value={fulfillmentType}
          onChange={setFulfillmentType}
        />

        {fulfillmentType === 'delivery' ? (
          <DeliveryAddressForm
            streetAddress={streetAddress}
            onStreetAddressChange={setStreetAddress}
            aptSuite={aptSuite}
            onAptSuiteChange={setAptSuite}
            city={city}
            onCityChange={setCity}
            state={state}
            onStateChange={setState}
            zipCode={zipCode}
            onZipCodeChange={setZipCode}
            deliveryNotes={deliveryNotes}
            onDeliveryNotesChange={setDeliveryNotes}
          />
        ) : (
          <>
            <PickupLocationSelector
              locations={pickupLocations}
              selectedLocationId={selectedPickupLocation}
              onLocationSelect={setSelectedPickupLocation}
            />
            <TimeSlotSelector
              slots={timeSlots}
              selectedSlotId={selectedTimeSlot}
              onSlotSelect={setSelectedTimeSlot}
            />
          </>
        )}

        <OrderSummaryCard cartItems={cartItems} subtotal={getCartTotal()} />
      </ScrollView>

      <View style={[styles.footer, dynamicStyles.footer]}>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            dynamicStyles.placeOrderButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={loading}
          accessible={true}
          accessibilityLabel={`Place order for ${formatPrice(getCartTotal())}`}
          accessibilityHint="Double tap to submit your order"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <Text style={[styles.placeOrderButtonText, dynamicStyles.placeOrderButtonText]}>
              Place Order - {formatPrice(getCartTotal())}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ============================================================
// STYLES - Layout only, colors from theme
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },

  placeOrderButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  placeOrderButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CheckoutScreen;
