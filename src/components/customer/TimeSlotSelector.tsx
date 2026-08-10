/**
 * Time Slot Selector Component
 * File: src/components/customer/TimeSlotSelector.tsx
 *
 * PURPOSE: Horizontally scrollable chip picker for pickup time slots
 *
 * WHY HORIZONTAL CHIPS INSTEAD OF PickupLocationSelector'S VERTICAL RADIO LIST?
 * - A day of 30-minute slots is too many rows for a vertical list
 * - Chips are the standard pattern for a single row of many short options
 *
 * THEMING:
 * - Uses useAppTheme() for all colors, same pattern as the other selectors
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
import type { TimeSlotSelectorProps, PickupTimeSlot } from '../../types';

const TimeSlotSelector: React.FC<TimeSlotSelectorProps> = ({
  slots,
  selectedSlotId,
  onSlotSelect,
}) => {
  const theme = useAppTheme();

  const dynamicStyles = {
    sectionLabel: {
      color: theme.colors.onBackground,
    },
    chip: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.custom.border,
    },
    chipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    chipText: {
      color: theme.colors.onSurface,
    },
    chipTextSelected: {
      color: theme.colors.primary,
    },
  };

  const renderSlot = (slot: PickupTimeSlot): React.ReactElement => {
    const isSelected = slot.id === selectedSlotId;

    return (
      <TouchableOpacity
        key={slot.id}
        style={[styles.chip, dynamicStyles.chip, isSelected && dynamicStyles.chipSelected]}
        onPress={() => onSlotSelect(slot.id)}
        accessible={true}
        accessibilityLabel={`Pickup time ${slot.label}`}
        accessibilityHint="Double tap to select this pickup time"
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
      >
        <Text
          style={[
            styles.chipText,
            dynamicStyles.chipText,
            isSelected && dynamicStyles.chipTextSelected,
          ]}
        >
          {slot.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, dynamicStyles.sectionLabel]}>Pickup Time</Text>
      {slots.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.custom.textSecondary }]}>
          No pickup times available right now
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {slots.map(renderSlot)}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  chip: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 2,
  },

  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },

  emptyText: {
    fontSize: 14,
  },
});

export default TimeSlotSelector;
