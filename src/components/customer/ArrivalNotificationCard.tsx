/**
 * Arrival Notification Card Component
 * File: src/components/customer/ArrivalNotificationCard.tsx
 *
 * PURPOSE:
 * This component handles the "I've Arrived" functionality for curbside pickup.
 * It appears on the OrderDetailScreen when:
 * 1. The order is a pickup order (not delivery)
 * 2. The order status is 'ready_for_pickup'
 *
 * ============================================================
 * COMPONENT DESIGN DECISIONS
 * ============================================================
 *
 * WHY A SEPARATE COMPONENT?
 * We could have put this logic directly in OrderDetailScreen, but
 * separating it provides several benefits:
 *
 * 1. SINGLE RESPONSIBILITY
 *    OrderDetailScreen shows order info. This component handles arrivals.
 *    Each component does one thing well.
 *
 * 2. REUSABILITY
 *    If we add an "Active Orders" widget on the home screen, we could
 *    reuse this component there too.
 *
 * 3. TESTABILITY
 *    Easier to write tests for arrival logic in isolation.
 *
 * 4. READABILITY
 *    OrderDetailScreen stays focused; arrival logic is encapsulated here.
 *
 * ============================================================
 * STATE MACHINE
 * ============================================================
 *
 * This component acts like a simple state machine with these states:
 *
 * [loading] → Check if arrival exists
 *     ↓
 * [not_arrived] → Show "I've Arrived" button
 *     ↓ (user taps button)
 * [submitting] → Show loading indicator
 *     ↓
 * [arrived] → Show "Staff has been notified" message
 *
 * WHY STATE MACHINE THINKING?
 * - Prevents impossible states (can't be loading AND submitted)
 * - Clear UI for each state
 * - Easy to add new states later (e.g., 'acknowledged' when staff responds)
 *
 * ============================================================
 * PROPS DESIGN
 * ============================================================
 *
 * WHY PASS orderId AND customerId?
 * - Component needs them to create/check arrivals
 * - Could have passed the whole Order object, but these are all we need
 * - "Interface Segregation" - only require what you actually use
 *
 * WHY onArrivalRecorded CALLBACK?
 * - Parent (OrderDetailScreen) might want to know when arrival is recorded
 * - Could refresh data, show a toast, update other UI
 * - Follows "lifting state up" pattern if needed
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Card, Text, Button, TextInput, ActivityIndicator } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import {
  recordArrival,
  getActiveArrivalForOrder,
} from '../../services/arrivalService';
import type { CustomerArrival } from '../../types';

// ============================================================
// TYPES
// ============================================================

/**
 * Component props interface
 *
 * WHY DOCUMENT EACH PROP?
 * - Self-documenting code
 * - IDE tooltips show descriptions
 * - New developers understand usage quickly
 */
interface ArrivalNotificationCardProps {
  /** The order ID this arrival is for */
  orderId: string;
  /** The customer's user ID */
  customerId: string;
  /** Callback when arrival is successfully recorded */
  onArrivalRecorded?: (arrival: CustomerArrival) => void;
}

/**
 * Internal state for the component
 *
 * WHY A UNION TYPE FOR STATUS?
 * - TypeScript ensures we handle all cases
 * - Can't accidentally set an invalid status
 * - Self-documenting possible states
 */
type ArrivalState = 'loading' | 'not_arrived' | 'submitting' | 'arrived' | 'error';

// ============================================================
// COMPONENT
// ============================================================

const ArrivalNotificationCard: React.FC<ArrivalNotificationCardProps> = ({
  orderId,
  customerId,
  onArrivalRecorded,
}) => {
  // ============================================================
  // HOOKS
  // ============================================================

  const theme = useAppTheme();

  // ============================================================
  // STATE
  // ============================================================

  /**
   * WHY MULTIPLE STATE VARIABLES vs ONE OBJECT?
   *
   * Option A (what we're doing):
   *   const [status, setStatus] = useState<ArrivalState>('loading');
   *   const [arrival, setArrival] = useState<CustomerArrival | null>(null);
   *
   * Option B (single object):
   *   const [state, setState] = useState({ status: 'loading', arrival: null });
   *
   * We chose Option A because:
   * - More explicit about what each piece of state is
   * - React optimizes individual useState updates
   * - Easier to update one piece without spreading the whole object
   * - Better TypeScript inference
   */

  const [status, setStatus] = useState<ArrivalState>('loading');
  const [arrival, setArrival] = useState<CustomerArrival | null>(null);
  const [vehicleDescription, setVehicleDescription] = useState<string>('');
  const [parkingSpot, setParkingSpot] = useState<string>('');

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * Check for existing arrival on mount
   *
   * WHY useCallback + useEffect?
   *
   * useCallback:
   * - Memoizes the function so it doesn't change every render
   * - Required because we use it in useEffect dependency array
   * - Without it: infinite loop (function recreated → effect runs → repeat)
   *
   * useEffect:
   * - Runs side effect (API call) after render
   * - Dependency array [checkExistingArrival] means it runs when that changes
   * - Since checkExistingArrival is memoized, it only runs once on mount
   *
   * WHY CHECK ON MOUNT?
   * - User might have already arrived (app restart, navigation back)
   * - We need to show correct state immediately
   * - Better UX than always showing button first
   */
  const checkExistingArrival = useCallback(async () => {
    try {
      const result = await getActiveArrivalForOrder(orderId);

      if (result.success) {
        if (result.data) {
          // Customer already arrived
          setArrival(result.data);
          setStatus('arrived');
        } else {
          // No existing arrival
          setStatus('not_arrived');
        }
      } else {
        // Error checking - show button anyway, user can try
        console.error('Error checking arrival:', result.error);
        setStatus('not_arrived');
      }
    } catch (error) {
      console.error('Unexpected error checking arrival:', error);
      setStatus('not_arrived');
    }
  }, [orderId]);

  useEffect(() => {
    checkExistingArrival();
  }, [checkExistingArrival]);

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * Handle the "I've Arrived" button press
   *
   * WHY ASYNC/AWAIT?
   * - recordArrival is an async operation (API call)
   * - We need to wait for result before updating UI
   * - try/catch handles any unexpected errors
   *
   * FLOW:
   * 1. Set status to 'submitting' (shows loading)
   * 2. Call service to record arrival
   * 3. On success: Update state, call callback
   * 4. On error: Show alert, reset to 'not_arrived'
   */
  const handleArrived = async (): Promise<void> => {
    setStatus('submitting');

    /**
     * WHY new Date().toISOString()?
     * - ISO 8601 format: "2024-01-30T14:30:00.000Z"
     * - Universally parseable
     * - Includes timezone (Z = UTC)
     * - Appwrite expects string dates in this format
     */
    const result = await recordArrival({
      orderID: orderId,
      customerID: customerId,
      arrivalTime: new Date().toISOString(),
      status: 'waiting',
      vehicleDescription: vehicleDescription.trim() || undefined,
      parkingSpot: parkingSpot.trim() || undefined,
    });

    if (result.success && result.data) {
      setArrival(result.data);
      setStatus('arrived');

      /**
       * WHY OPTIONAL CALLBACK?
       * - Parent might not need to know about arrival
       * - ?. (optional chaining) safely calls only if defined
       * - Keeps component flexible for different use cases
       */
      onArrivalRecorded?.(result.data);
    } else {
      /**
       * WHY Alert.alert()?
       * - Native mobile alert dialog
       * - User-friendly error communication
       * - Requires user acknowledgment (tap OK)
       * - Better than silent failure or console.log
       */
      Alert.alert(
        'Unable to Notify Store',
        result.error || 'Please try again or go inside to pick up your order.',
        [{ text: 'OK' }]
      );
      setStatus('not_arrived');
    }
  };

  // ============================================================
  // DYNAMIC STYLES
  // ============================================================

  /**
   * WHY DYNAMIC STYLES OBJECT?
   *
   * Some styles depend on the theme (colors that change in dark mode).
   * We can't use StyleSheet.create() for these because:
   * - StyleSheet.create() is called once when module loads
   * - Theme values might not be available yet
   * - Theme can change (user switches dark mode)
   *
   * Pattern:
   * - Static styles → StyleSheet.create() (performance optimized)
   * - Theme-dependent styles → dynamic object (recalculated on theme change)
   * - Combine both: style={[styles.static, dynamicStyles.themed]}
   */
  const dynamicStyles = {
    card: {
      backgroundColor: theme.colors.primaryContainer,
    },
    arrivedCard: {
      backgroundColor: theme.custom.successLight,
    },
    title: {
      color: theme.colors.onPrimaryContainer,
    },
    arrivedTitle: {
      color: theme.custom.success,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    arrivedSubtitle: {
      color: theme.custom.success,
    },
    inputBackground: {
      backgroundColor: theme.colors.surface,
    },
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  /**
   * Format time for display
   *
   * WHY SEPARATE FUNCTION?
   * - Keeps render logic clean
   * - Reusable if needed elsewhere
   * - Easy to modify format in one place
   *
   * WHY toLocaleTimeString()?
   * - Respects user's locale settings
   * - Automatic AM/PM vs 24-hour based on device
   * - Handles timezone correctly
   */
  const formatArrivalTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // ============================================================
  // RENDER: LOADING STATE
  // ============================================================

  if (status === 'loading') {
    /**
     * WHY SHOW LOADING?
     * - We're checking if customer already arrived
     * - Prevents flash of wrong UI
     * - User knows something is happening
     *
     * WHY SMALL SPINNER?
     * - This is a card within a larger screen
     * - Full-screen spinner would be disruptive
     * - Small spinner indicates local loading
     */
    return (
      <Card style={[styles.card, dynamicStyles.card]}>
        <Card.Content style={styles.loadingContent}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Checking arrival status...</Text>
        </Card.Content>
      </Card>
    );
  }

  // ============================================================
  // RENDER: ALREADY ARRIVED STATE
  // ============================================================

  if (status === 'arrived' && arrival) {
    /**
     * WHY DIFFERENT CARD STYLE?
     * - Visual distinction from "not arrived" state
     * - Green color indicates success/positive state
     * - Confirms action was successful
     *
     * WHY SHOW ARRIVAL TIME?
     * - Confirms when notification was sent
     * - Helps customer track wait time
     * - Useful if staff asks "when did you arrive?"
     */
    return (
      <Card style={[styles.card, dynamicStyles.arrivedCard]}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.title, dynamicStyles.arrivedTitle]}>
            ✓ Staff Has Been Notified
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, dynamicStyles.arrivedSubtitle]}>
            You checked in at {formatArrivalTime(arrival.arrivalTime)}
          </Text>
          <Text variant="bodySmall" style={[styles.helpText, dynamicStyles.arrivedSubtitle]}>
            Please wait in your vehicle. A team member will bring your order out shortly.
          </Text>
        </Card.Content>
      </Card>
    );
  }

  // ============================================================
  // RENDER: NOT ARRIVED STATE (MAIN UI)
  // ============================================================

  /**
   * MAIN UI STRUCTURE:
   *
   * ┌─────────────────────────────────────┐
   * │  Ready for Pickup!                  │
   * │  Let us know when you arrive...     │
   * │                                     │
   * │  [Vehicle Description (optional)]   │
   * │  [Parking Spot (optional)]          │
   * │                                     │
   * │  [    I've Arrived    ]             │
   * └─────────────────────────────────────┘
   *
   * WHY OPTIONAL INPUTS?
   * - Not everyone will want to fill these out
   * - Speeds up the happy path (just tap button)
   * - But helpful info for staff if provided
   *
   * WHY VEHICLE DESCRIPTION?
   * - Staff can identify customer's car in parking lot
   * - Faster handoff, better experience
   * - Common in curbside pickup apps
   */
  return (
    <Card style={[styles.card, dynamicStyles.card]}>
      <Card.Content>
        <Text variant="titleMedium" style={[styles.title, dynamicStyles.title]}>
          Ready for Pickup!
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, dynamicStyles.subtitle]}>
          Let us know when you arrive and we'll bring your order out.
        </Text>

        {/* Optional: Vehicle Description Input */}
        <TextInput
          label="Vehicle Description (optional)"
          placeholder="e.g., Blue Honda Civic"
          value={vehicleDescription}
          onChangeText={setVehicleDescription}
          mode="outlined"
          style={[styles.input, dynamicStyles.inputBackground]}
          /**
           * WHY dense PROP?
           * - Reduces vertical padding
           * - Better fit in card layout
           * - Doesn't look oversized for optional field
           */
          dense
          /**
           * WHY maxLength?
           * - Prevents excessively long input
           * - Database might have field limits
           * - Keeps UI clean
           */
          maxLength={100}
        />

        {/* Optional: Parking Spot Input */}
        <TextInput
          label="Parking Spot (optional)"
          placeholder="e.g., Spot 5, Near entrance"
          value={parkingSpot}
          onChangeText={setParkingSpot}
          mode="outlined"
          style={[styles.input, dynamicStyles.inputBackground]}
          dense
          maxLength={50}
        />

        {/* I've Arrived Button */}
        <Button
          mode="contained"
          onPress={handleArrived}
          loading={status === 'submitting'}
          disabled={status === 'submitting'}
          icon="map-marker-check"
          style={styles.button}
          contentStyle={styles.buttonContent}
          /**
           * WHY loading AND disabled?
           * - loading: Shows spinner inside button
           * - disabled: Prevents double-tap while submitting
           * - Both together = clear "in progress" state
           */
        >
          I've Arrived
        </Button>
      </Card.Content>
    </Card>
  );
};

// ============================================================
// STYLES
// ============================================================

/**
 * WHY StyleSheet.create()?
 *
 * 1. PERFORMANCE
 *    - Styles are processed once when module loads
 *    - Not recalculated on every render
 *    - React Native can optimize static styles
 *
 * 2. VALIDATION
 *    - TypeScript checks for valid style properties
 *    - Catches typos at compile time
 *
 * 3. ORGANIZATION
 *    - All styles in one place
 *    - Easy to find and modify
 *    - Consistent naming convention
 *
 * NAMING CONVENTION:
 * - containerName (card, input, button)
 * - modifierName (loadingContent, helpText)
 * - Descriptive but concise
 */
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    /**
     * WHY THESE MARGINS?
     * - Match other cards in OrderDetailScreen
     * - Consistent spacing throughout app
     * - 16px is common mobile spacing unit (multiple of 8)
     */
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    /**
     * WHY FLEXBOX ROW?
     * - Spinner and text side by side
     * - Centered horizontally
     * - Compact loading indicator
     */
  },
  loadingText: {
    marginLeft: 12,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
  },
  helpText: {
    marginTop: 12,
    fontStyle: 'italic',
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 8,
    /**
     * WHY EXTRA PADDING?
     * - Makes button taller (easier to tap)
     * - More prominent call-to-action
     * - Meets accessibility touch target guidelines (48px min)
     */
  },
});

export default ArrivalNotificationCard;
