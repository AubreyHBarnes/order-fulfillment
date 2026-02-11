/**
 * Pickup Location Selector Component
 * File: src/components/customer/PickupLocationSelector.tsx
 *
 * PURPOSE: Radio-style list for selecting store pickup location
 *
 * THEMING:
 * - Uses useAppTheme() for all colors
 * - Automatically adapts to light/dark mode
 *
 * WHY SEPARATE COMPONENT?
 * - Reusable (could use in preferences, order edit)
 * - Testable in isolation
 * - Keeps CheckoutScreen focused
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
import type { PickupLocationSelectorProps, PickupLocation } from '../../types';

const PickupLocationSelector: React.FC<PickupLocationSelectorProps> = ({
  locations,
  selectedLocationId,
  onLocationSelect,
}) => {
  const theme = useAppTheme();

  /**
   * DYNAMIC STYLES - Theme-aware colors
   */
  const dynamicStyles = {
    sectionLabel: {
      color: theme.colors.onBackground,
    },
    locationOption: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.custom.border,
    },
    locationOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    radioOuter: {
      borderColor: theme.custom.textDisabled,
    },
    radioOuterSelected: {
      borderColor: theme.colors.primary,
    },
    radioInner: {
      backgroundColor: theme.colors.primary,
    },
    locationName: {
      color: theme.colors.onSurface,
    },
    locationNameSelected: {
      color: theme.colors.primary,
    },
    locationAddress: {
      color: theme.custom.textSecondary,
    },
  };

  const renderLocationOption = (location: PickupLocation): React.ReactElement => {
    const isSelected = location.id === selectedLocationId;

    return (
      <TouchableOpacity
        key={location.id}
        style={[
          styles.locationOption,
          dynamicStyles.locationOption,
          isSelected && dynamicStyles.locationOptionSelected,
        ]}
        onPress={() => onLocationSelect(location.id)}
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
              dynamicStyles.radioOuter,
              isSelected && dynamicStyles.radioOuterSelected,
            ]}
          >
            {isSelected && (
              <View style={[styles.radioInner, dynamicStyles.radioInner]} />
            )}
          </View>
        </View>

        {/* ===== LOCATION DETAILS ===== */}
        <View style={styles.locationInfo}>
          <Text
            style={[
              styles.locationName,
              dynamicStyles.locationName,
              isSelected && dynamicStyles.locationNameSelected,
            ]}
          >
            {location.name}
          </Text>
          <Text style={[styles.locationAddress, dynamicStyles.locationAddress]}>
            {location.address}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, dynamicStyles.sectionLabel]}>
        Pickup Location
      </Text>
      {locations.map(renderLocationOption)}
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

  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },

  radioContainer: {
    marginRight: 16,
  },

  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  locationInfo: {
    flex: 1,
  },

  locationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },

  locationAddress: {
    fontSize: 14,
  },
});

export default PickupLocationSelector;
