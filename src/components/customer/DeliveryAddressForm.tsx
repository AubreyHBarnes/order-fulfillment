/**
 * Delivery Address Form Component
 * File: src/components/customer/DeliveryAddressForm.tsx
 *
 * PURPOSE: Collects delivery address information for checkout
 *
 * THEMING:
 * - Uses useAppTheme() for all colors
 * - Automatically adapts to light/dark mode
 * - No hardcoded hex values in styles
 *
 * WHY SEPARATE COMPONENT?
 * - Reusable (order edit, saved addresses)
 * - Testable in isolation
 * - Keeps CheckoutScreen manageable
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
import type { DeliveryAddressFormProps } from '../../types';

const DeliveryAddressForm: React.FC<DeliveryAddressFormProps> = ({
  streetAddress,
  onStreetAddressChange,
  aptSuite,
  onAptSuiteChange,
  city,
  onCityChange,
  state,
  onStateChange,
  zipCode,
  onZipCodeChange,
  deliveryNotes,
  onDeliveryNotesChange,
}) => {
  const theme = useAppTheme();

  /**
   * DYNAMIC STYLES - Theme-aware colors
   */
  const dynamicStyles = {
    sectionLabel: {
      color: theme.colors.onBackground,
    },
    label: {
      color: theme.colors.onBackground,
    },
    required: {
      color: theme.colors.error,
    },
    input: {
      backgroundColor: theme.custom.inputBackground,
      borderColor: theme.custom.inputBorder,
      color: theme.colors.onSurface,
    },
    placeholder: theme.custom.textDisabled,
  };

  return (
    <View style={styles.container}>
      {/* ========== SECTION HEADER ========== */}
      <Text style={[styles.sectionLabel, dynamicStyles.sectionLabel]}>
        Delivery Address
      </Text>

      {/* ========== STREET ADDRESS (REQUIRED) ========== */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, dynamicStyles.label]}>
          Street Address <Text style={dynamicStyles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, dynamicStyles.input]}
          placeholder="123 Main Street"
          placeholderTextColor={dynamicStyles.placeholder}
          value={streetAddress}
          onChangeText={onStreetAddressChange}
          autoCapitalize="words"
          autoComplete="street-address"
          accessible={true}
          accessibilityLabel="Street address"
          accessibilityHint="Enter your street address for delivery"
        />
      </View>

      {/* ========== APT/SUITE (OPTIONAL) ========== */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, dynamicStyles.label]}>Apt/Suite</Text>
        <TextInput
          style={[styles.input, dynamicStyles.input]}
          placeholder="Apt 4B, Suite 100, etc."
          placeholderTextColor={dynamicStyles.placeholder}
          value={aptSuite}
          onChangeText={onAptSuiteChange}
          autoCapitalize="characters"
          accessible={true}
          accessibilityLabel="Apartment or suite number"
          accessibilityHint="Optional. Enter apartment or suite number if applicable"
        />
      </View>

      {/* ========== CITY, STATE, ZIP (ROW LAYOUT) ========== */}
      <View style={styles.rowContainer}>
        {/* ===== CITY (REQUIRED) ===== */}
        <View style={[styles.inputContainer, styles.cityInput]}>
          <Text style={[styles.label, dynamicStyles.label]}>
            City <Text style={dynamicStyles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            placeholder="Anytown"
            placeholderTextColor={dynamicStyles.placeholder}
            value={city}
            onChangeText={onCityChange}
            autoCapitalize="words"
            autoComplete="postal-address-locality"
            accessible={true}
            accessibilityLabel="City"
            accessibilityHint="Enter the city for delivery"
          />
        </View>

        {/* ===== STATE (REQUIRED) ===== */}
        <View style={[styles.inputContainer, styles.stateInput]}>
          <Text style={[styles.label, dynamicStyles.label]}>
            State <Text style={dynamicStyles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            placeholder="ST"
            placeholderTextColor={dynamicStyles.placeholder}
            value={state}
            onChangeText={onStateChange}
            autoCapitalize="characters"
            maxLength={2}
            autoComplete="postal-address-region"
            accessible={true}
            accessibilityLabel="State"
            accessibilityHint="Enter two-letter state abbreviation"
          />
        </View>

        {/* ===== ZIP CODE (REQUIRED) ===== */}
        <View style={[styles.inputContainer, styles.zipInput]}>
          <Text style={[styles.label, dynamicStyles.label]}>
            Zip <Text style={dynamicStyles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            placeholder="12345"
            placeholderTextColor={dynamicStyles.placeholder}
            value={zipCode}
            onChangeText={onZipCodeChange}
            keyboardType="number-pad"
            maxLength={10}
            autoComplete="postal-code"
            accessible={true}
            accessibilityLabel="ZIP code"
            accessibilityHint="Enter your 5-digit ZIP code"
          />
        </View>
      </View>

      {/* ========== DELIVERY NOTES (OPTIONAL) ========== */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, dynamicStyles.label]}>Delivery Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput, dynamicStyles.input]}
          placeholder="Gate code, leave at door, etc."
          placeholderTextColor={dynamicStyles.placeholder}
          value={deliveryNotes}
          onChangeText={onDeliveryNotesChange}
          multiline={true}
          numberOfLines={3}
          textAlignVertical="top"
          accessible={true}
          accessibilityLabel="Delivery notes"
          accessibilityHint="Optional. Enter special instructions for delivery"
        />
      </View>
    </View>
  );
};

// ============================================================
// STYLES - Layout only, colors from theme
// ============================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  inputContainer: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  input: {
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
  },

  notesInput: {
    minHeight: 80,
  },

  rowContainer: {
    flexDirection: 'row',
    gap: 8,
  },

  cityInput: {
    flex: 2,
  },

  stateInput: {
    flex: 1,
  },

  zipInput: {
    flex: 1.5,
  },
});

export default DeliveryAddressForm;
