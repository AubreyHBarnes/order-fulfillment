/**
 * Delivery Address Form Component
 * File: src/components/customer/DeliveryAddressForm.tsx
 *
 * PURPOSE: Collects delivery address information for checkout
 *
 * FOLLOWS PATTERN FROM: RegisterScreen.tsx input fields
 * - Same TextInput styling
 * - Same label pattern
 * - Same row layout for related fields
 *
 * WHY SEPARATE COMPONENT?
 * - Reusable (order edit, saved addresses)
 * - Testable in isolation
 * - Keeps CheckoutScreen manageable
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { DeliveryAddressFormProps } from '../../types';

/**
 * WHY THESE IMPORTS?
 * - View: Container layouts
 * - Text: Labels for inputs
 * - TextInput: User input fields (React Native, not Paper)
 * - StyleSheet: Optimized styles
 * - Types: Prop types from shared file
 *
 * WHY React Native TextInput NOT React Native Paper?
 * - Matches existing RegisterScreen pattern
 * - Simpler styling control
 * - Consistent app appearance
 */

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
  /**
   * WHY SO MANY PROPS?
   * - Controlled component pattern (parent owns all state)
   * - Each field has value + onChange
   * - Allows parent to validate individual fields
   * - Clear data flow
   *
   * ALTERNATIVE: Pass single address object
   * - Pro: Fewer props
   * - Con: Less granular control, harder to type
   * - Decision: Individual props for clarity
   */

  return (
    <View style={styles.container}>
      {/* ========== SECTION HEADER ========== */}
      <Text style={styles.sectionLabel}>Delivery Address</Text>

      {/* ========== STREET ADDRESS (REQUIRED) ========== */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          Street Address <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="123 Main Street"
          value={streetAddress}
          onChangeText={onStreetAddressChange}
          /**
           * WHY autoCapitalize="words"?
           * - Street names are capitalized
           * - Better UX for address entry
           * - "main street" -> "Main Street"
           */
          autoCapitalize="words"
          autoComplete="street-address"
          /**
           * WHY autoComplete?
           * - Enables autofill from device
           * - Faster address entry
           * - Standard for address fields
           */
          accessible={true}
          accessibilityLabel="Street address"
          accessibilityHint="Enter your street address for delivery"
        />
      </View>

      {/* ========== APT/SUITE (OPTIONAL) ========== */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Apt/Suite</Text>
        <TextInput
          style={styles.input}
          placeholder="Apt 4B, Suite 100, etc."
          value={aptSuite}
          onChangeText={onAptSuiteChange}
          autoCapitalize="characters"
          /**
           * WHY autoCapitalize="characters"?
           * - Apt numbers often all caps (4B, 100A)
           * - Suite often capitalized
           * - User can still type lowercase if preferred
           */
          accessible={true}
          accessibilityLabel="Apartment or suite number"
          accessibilityHint="Optional. Enter apartment or suite number if applicable"
        />
      </View>

      {/* ========== CITY, STATE, ZIP (ROW LAYOUT) ========== */}
      {/**
       * WHY ROW LAYOUT?
       * - Follows standard address form pattern
       * - Visually groups related fields
       * - Saves vertical space
       * - Matches RegisterScreen name row pattern
       */}
      <View style={styles.rowContainer}>
        {/* ===== CITY (REQUIRED) ===== */}
        <View style={[styles.inputContainer, styles.cityInput]}>
          <Text style={styles.label}>
            City <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Anytown"
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
          <Text style={styles.label}>
            State <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="ST"
            value={state}
            onChangeText={onStateChange}
            autoCapitalize="characters"
            maxLength={2}
            /**
             * WHY maxLength: 2?
             * - State abbreviations are 2 letters (CA, NY, TX)
             * - Prevents invalid input
             * - Clear user expectation
             */
            autoComplete="postal-address-region"
            accessible={true}
            accessibilityLabel="State"
            accessibilityHint="Enter two-letter state abbreviation"
          />
        </View>

        {/* ===== ZIP CODE (REQUIRED) ===== */}
        <View style={[styles.inputContainer, styles.zipInput]}>
          <Text style={styles.label}>
            Zip <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="12345"
            value={zipCode}
            onChangeText={onZipCodeChange}
            keyboardType="number-pad"
            /**
             * WHY keyboardType="number-pad"?
             * - ZIP codes are numbers
             * - Numeric keyboard is easier
             * - Prevents letters (though validation still needed)
             */
            maxLength={10}
            /**
             * WHY maxLength: 10?
             * - Allows ZIP+4 format: 12345-6789
             * - Standard US postal code length
             */
            autoComplete="postal-code"
            accessible={true}
            accessibilityLabel="ZIP code"
            accessibilityHint="Enter your 5-digit ZIP code"
          />
        </View>
      </View>

      {/* ========== DELIVERY NOTES (OPTIONAL) ========== */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Delivery Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Gate code, leave at door, etc."
          value={deliveryNotes}
          onChangeText={onDeliveryNotesChange}
          multiline={true}
          numberOfLines={3}
          /**
           * WHY multiline?
           * - Notes can be detailed
           * - Better UX for longer instructions
           * - numberOfLines gives visual size hint
           */
          textAlignVertical="top"
          /**
           * WHY textAlignVertical="top"?
           * - Multiline text starts at top
           * - Default is centered (looks odd)
           * - Android-specific but doesn't hurt iOS
           */
          accessible={true}
          accessibilityLabel="Delivery notes"
          accessibilityHint="Optional. Enter special instructions for delivery"
        />
      </View>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

/**
 * FOLLOWS RegisterScreen input styling pattern
 * - Same input background, border, padding
 * - Same label styling
 * - Same row layout approach
 */
const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    /**
     * WHY SAME AS FulfillmentTypeSelector?
     * - Consistent section header styling
     * - Visual grouping of form sections
     */
  },

  inputContainer: {
    marginBottom: 16,
    /**
     * WHY marginBottom: 16?
     * - Matches RegisterScreen pattern
     * - Consistent spacing between fields
     */
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    /**
     * WHY THESE VALUES?
     * - Matches RegisterScreen labels
     * - Good contrast (dark on light)
     * - Readable at small size
     */
  },

  required: {
    color: '#E53935',
    /**
     * WHY red asterisk?
     * - Standard pattern for required fields
     * - Clear visual indicator
     * - Accessibility: also communicated via label text
     */
  },

  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DDD',
    /**
     * WHY THESE VALUES?
     * - Matches RegisterScreen input styling exactly
     * - Good tap target (padding: 15)
     * - Readable font size
     * - Subtle border
     */
  },

  notesInput: {
    minHeight: 80,
    /**
     * WHY minHeight?
     * - Multiline needs more space
     * - Visual indication it's for longer text
     * - numberOfLines: 3 × ~24px line height ≈ 72px
     */
  },

  rowContainer: {
    flexDirection: 'row',
    gap: 8,
    /**
     * WHY gap: 8?
     * - Space between City/State/Zip fields
     * - Smaller than full input spacing
     * - Visually groups related fields
     */
  },

  cityInput: {
    flex: 2,
    /**
     * WHY flex: 2?
     * - City names are longer
     * - Gets 2x the space of State
     * - Proportional layout
     */
  },

  stateInput: {
    flex: 1,
    /**
     * WHY flex: 1?
     * - State is just 2 letters
     * - Smallest of the three
     */
  },

  zipInput: {
    flex: 1.5,
    /**
     * WHY flex: 1.5?
     * - ZIP is 5-10 chars
     * - Between city and state in width
     * - Good visual balance
     */
  },
});

export default DeliveryAddressForm;
