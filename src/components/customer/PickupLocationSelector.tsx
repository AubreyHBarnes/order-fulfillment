/**
 * Pickup Location Selector Component
 * File: src/components/customer/PickupLocationSelector.tsx
 *
 * PURPOSE: Radio-style list for selecting store pickup location
 *
 * UI PATTERN:
 * - List of locations with radio indicators
 * - Selected location has filled circle
 * - Shows location name and address
 *
 * WHY RADIO STYLE?
 * - Only one location can be selected
 * - Clear visual indication of selection
 * - Familiar pattern for users
 *
 * WHY SEPARATE COMPONENT?
 * - Reusable (could use in preferences, order edit)
 * - Testable in isolation
 * - Keeps CheckoutScreen focused
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { PickupLocationSelectorProps, PickupLocation } from '../../types';

/**
 * WHY THESE IMPORTS?
 * - View: Container and radio circle
 * - Text: Location name and address
 * - TouchableOpacity: Tappable location rows
 * - StyleSheet: Optimized styles
 * - Types: Prop types and PickupLocation from shared file
 */

const PickupLocationSelector: React.FC<PickupLocationSelectorProps> = ({
  locations,
  selectedLocationId,
  onLocationSelect,
}) => {
  /**
   * WHY THESE PROPS?
   * - locations: Array of available pickup locations
   * - selectedLocationId: Currently selected location (controlled)
   * - onLocationSelect: Callback when selection changes
   *
   * WHY selectedLocationId NOT selectedLocation?
   * - IDs are simpler to compare
   * - Avoids reference equality issues
   * - Matches common React patterns
   */

  /**
   * Render a single location option
   *
   * WHY INLINE FUNCTION?
   * - Needs access to selectedLocationId
   * - Only used here, not reusable
   * - Clear relationship to parent component
   */
  const renderLocationOption = (location: PickupLocation): React.ReactElement => {
    const isSelected = location.id === selectedLocationId;

    return (
      <TouchableOpacity
        key={location.id}
        style={[
          styles.locationOption,
          /**
           * WHY CONDITIONAL STYLE?
           * - Highlight selected location
           * - Visual feedback for selection state
           */
          isSelected && styles.locationOptionSelected,
        ]}
        onPress={() => onLocationSelect(location.id)}
        /**
         * WHY ACCESSIBILITY PROPS?
         * - Screen reader support
         * - WCAG compliance
         * - Professional standard
         */
        accessible={true}
        accessibilityLabel={`${location.name} at ${location.address}`}
        accessibilityHint="Double tap to select this pickup location"
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
      >
        {/* ===== RADIO INDICATOR ===== */}
        <View style={styles.radioContainer}>
          <View
            style={[
              styles.radioOuter,
              isSelected && styles.radioOuterSelected,
            ]}
          >
            {/**
             * WHY CONDITIONAL INNER CIRCLE?
             * - Shows filled circle only when selected
             * - Standard radio button pattern
             * - Clear visual feedback
             */}
            {isSelected && <View style={styles.radioInner} />}
          </View>
        </View>

        {/* ===== LOCATION DETAILS ===== */}
        <View style={styles.locationInfo}>
          <Text
            style={[
              styles.locationName,
              isSelected && styles.locationNameSelected,
            ]}
          >
            {location.name}
          </Text>
          <Text style={styles.locationAddress}>{location.address}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ========== SECTION HEADER ========== */}
      <Text style={styles.sectionLabel}>Pickup Location</Text>

      {/* ========== LOCATIONS LIST ========== */}
      {/**
       * WHY MAP NOT FLATLIST?
       * - Small list (typically 3-5 locations)
       * - No need for virtualization
       * - Simpler implementation
       * - FlatList overkill for small lists
       */}
      {locations.map(renderLocationOption)}
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

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
     * WHY SAME STYLING AS OTHER COMPONENTS?
     * - Consistent section headers across checkout
     * - Visual rhythm and grouping
     */
  },

  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    /**
     * WHY THESE VALUES?
     * - Row layout for radio + info
     * - Padding matches other checkout components
     * - Border matches FulfillmentTypeSelector
     */
  },

  locationOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F5F9FF',
    /**
     * WHY THESE COLORS?
     * - Blue border for selection (primary color)
     * - Very light blue background
     * - Subtle but clear indication
     */
  },

  radioContainer: {
    marginRight: 16,
    /**
     * WHY marginRight?
     * - Space between radio and text
     * - Visual separation
     */
  },

  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    justifyContent: 'center',
    alignItems: 'center',
    /**
     * WHY THESE VALUES?
     * - Standard radio button size
     * - Circle shape (borderRadius = width/2)
     * - Gray border when unselected
     * - Center inner circle
     */
  },

  radioOuterSelected: {
    borderColor: '#007AFF',
    /**
     * WHY blue border?
     * - Matches primary color
     * - Clear selection indication
     */
  },

  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    /**
     * WHY THESE VALUES?
     * - Inner circle is half of outer
     * - Filled with primary color
     * - Standard radio selected indicator
     */
  },

  locationInfo: {
    flex: 1,
    /**
     * WHY flex: 1?
     * - Takes remaining space after radio
     * - Text can wrap if needed
     */
  },

  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    /**
     * WHY THESE VALUES?
     * - Primary text (location name)
     * - Slightly larger, bold
     * - Small margin before address
     */
  },

  locationNameSelected: {
    color: '#007AFF',
    /**
     * WHY blue when selected?
     * - Extra emphasis on selection
     * - Matches radio and border color
     */
  },

  locationAddress: {
    fontSize: 14,
    color: '#757575',
    /**
     * WHY THESE VALUES?
     * - Secondary text (less emphasis)
     * - Gray color for hierarchy
     * - Readable but not dominant
     */
  },
});

export default PickupLocationSelector;
