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
import RushOrderToggle from '../../components/customer/RushOrderToggle';
import OrderSummaryCard from '../../components/customer/OrderSummaryCard';
import {
  createOrder,
  formatDeliveryAddress,
  getPickupLocations,
  getAvailableTimeSlots,
  getRushReadyTime,
} from '../../services/orderService';
import { handleRushOrderPlacement } from '../../services/shopperStatusService';
import { formatPrice } from '../../services/productService';
import type { MainStackParamList, FulfillmentType, CreateOrderData } from '../../types';

// ============================================================
// STORE HOURS CONSTANTS
// ============================================================

const STORE_OPEN_HOUR = 8;  // 8 AM
const STORE_CLOSE_HOUR = 21; // 9 PM (21:00)
const MINIMUM_LEAD_TIME_HOURS = 2; // Orders must be at least 2 hours out

// ============================================================
// SCHEDULING HELPERS
// ============================================================

/**
 * Calculate the earliest available pickup time for a standard order
 *
 * RULES:
 * 1. Must be at least 2 hours from current time
 * 2. Standard orders can only be on the hour (9:00, 10:00, etc.)
 * 3. If after store close (9 PM), schedule for next day opening (8 AM)
 *
 * NOTE: Rush orders (future feature) will allow non-hour times
 *
 * @returns Object with scheduledTime and isNextDay flag
 */
const calculateStandardPickupTime = (): {
  scheduledTime: Date;
  isNextDay: boolean;
} => {
  const now = new Date();

  // Add minimum lead time (2 hours)
  const earliestTime = new Date(now.getTime() + MINIMUM_LEAD_TIME_HOURS * 60 * 60 * 1000);

  // Round UP to the next hour for standard orders
  // If already exactly on the hour, keep it; otherwise round up
  const minutes = earliestTime.getMinutes();
  const seconds = earliestTime.getSeconds();
  const milliseconds = earliestTime.getMilliseconds();

  let scheduledTime: Date;
  if (minutes === 0 && seconds === 0 && milliseconds === 0) {
    // Already exactly on the hour
    scheduledTime = new Date(earliestTime);
  } else {
    // Round up to next hour
    scheduledTime = new Date(earliestTime);
    scheduledTime.setMinutes(0, 0, 0);
    scheduledTime.setHours(scheduledTime.getHours() + 1);
  }

  // Check if scheduled time is after store close (9 PM)
  const scheduledHour = scheduledTime.getHours();
  if (scheduledHour >= STORE_CLOSE_HOUR) {
    // Schedule for next day at opening time (8 AM)
    const nextDay = new Date(scheduledTime);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(STORE_OPEN_HOUR, 0, 0, 0);
    return {
      scheduledTime: nextDay,
      isNextDay: true,
    };
  }

  // Check if scheduled time is before store open (shouldn't happen often, but handle it)
  if (scheduledHour < STORE_OPEN_HOUR) {
    scheduledTime.setHours(STORE_OPEN_HOUR, 0, 0, 0);
  }

  return {
    scheduledTime,
    isNextDay: false,
  };
};

/**
 * Format scheduled time for display
 *
 * @param date - The scheduled date/time
 * @param isNextDay - Whether this is next-day pickup
 * @returns Human-readable string like "Today at 2:00 PM" or "Tomorrow at 8:00 AM"
 */
const formatScheduledTime = (date: Date, isNextDay: boolean): string => {
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isNextDay) {
    const dayStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return `${dayStr} at ${timeStr}`;
  }

  return `Today at ${timeStr}`;
};

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
   * RUSH ORDER STATE
   *
   * WHY PICKUP-ONLY?
   * - Rush bypasses the hourly time slot picker with a fixed
   *   RUSH_PREP_MINUTES-from-now ready time
   * - Delivery has no slot picker yet, so there's nothing for rush to skip
   */
  const [isRush, setIsRush] = useState<boolean>(false);

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
      /**
       * WHY SKIP THIS CHECK WHEN isRush?
       * - Rush orders don't use the hourly slot picker - their ready time
       *   is always RUSH_PREP_MINUTES from now, computed at submission
       */
      if (!isRush && !selectedTimeSlot) {
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
       *
       * SCHEDULING RULES:
       * - Standard orders: minimum 2 hours out, on the hour only
       * - Rush orders (future): can be scheduled at any time with premium
       * - After 9 PM close: scheduled for next day at 8 AM opening
       */
      const { scheduledTime, isNextDay } = calculateStandardPickupTime();
      const scheduledReadyTime = scheduledTime.toISOString();

      // Warn customer if order is scheduled for next day
      if (isNextDay) {
        const formattedTime = formatScheduledTime(scheduledTime, isNextDay);
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Next-Day Pickup',
            `Our store closes at 9 PM. Your order will be scheduled for pickup on ${formattedTime}.\n\nWould you like to proceed?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continue', onPress: () => resolve(true) },
            ]
          );
        });

        if (!proceed) {
          setLoading(false);
          return;
        }
      }

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
        priority: fulfillmentType === 'pickup' && isRush ? 1 : 0,
        /**
         * WHY REUSE priority AS THE RUSH FLAG?
         * - priority already exists on the Order schema and was unused -
         *   no Appwrite schema change needed
         * - 1 = rush, 0 = normal
         * - Rush orders also naturally sort first in shopper auto-assignment
         *   since scheduledReadyTime is soonest, so no assignment logic needed
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
         * - Standard orders: 2+ hours out, on the hour only
         * - Rush orders (future): can allow non-hour times
         * - After-hours orders: scheduled for next day at 8 AM
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
         * RUSH ORDER: try to get it to a shopper immediately
         *
         * WHY FIRE-AND-FORGET (not awaited into the success flow)?
         * - This is a best-effort push, not something the customer's
         *   order confirmation should ever fail or wait on - if it
         *   errors, the order still exists and correctly falls back to
         *   sitting in the normal pending queue like any other order.
         * - Scoped to priority === 1 only; normal orders keep their
         *   existing assign-on-availability-toggle behavior unchanged.
         */
        if (result.data.priority === 1) {
          handleRushOrderPlacement(result.data).catch((error) => {
            console.error('Error handling rush order placement:', error);
          });
        }

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
            <RushOrderToggle isRush={isRush} onChange={setIsRush} />
            {!isRush && (
              <TimeSlotSelector
                slots={timeSlots}
                selectedSlotId={selectedTimeSlot}
                onSlotSelect={setSelectedTimeSlot}
              />
            )}
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
