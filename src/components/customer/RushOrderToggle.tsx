/**
 * Rush Order Toggle Component
 * File: src/components/customer/RushOrderToggle.tsx
 *
 * PURPOSE: Lets a pickup customer skip the hourly time slots and get their
 * order ready as soon as possible (RUSH_PREP_MINUTES from when it's placed)
 *
 * FOLLOWS PATTERN FROM: FulfillmentTypeSelector.tsx
 * - Same controlled toggle-card UI and theming approach
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme, fontFamilies, radius, spacing } from '../../theme';
import { RUSH_PREP_MINUTES } from '../../services/orderService';
import type { RushOrderToggleProps } from '../../types';

const RushOrderToggle: React.FC<RushOrderToggleProps> = ({ isRush, onChange }) => {
  const theme = useAppTheme();

  const dynamicStyles = {
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.custom.border,
    },
    cardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    title: {
      color: theme.colors.onSurface,
    },
    titleActive: {
      color: theme.colors.primary,
    },
    subtitle: {
      color: theme.custom.textSecondary,
    },
  };

  return (
    <TouchableOpacity
      style={[styles.card, dynamicStyles.card, isRush && dynamicStyles.cardActive]}
      onPress={() => onChange(!isRush)}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="switch"
      accessibilityLabel="Rush order"
      accessibilityHint={`Double tap to ${isRush ? 'turn off' : 'turn on'} rush order, ready ${RUSH_PREP_MINUTES} minutes after placing`}
      accessibilityState={{ checked: isRush }}
    >
      <Text style={styles.icon}>⚡</Text>
      <View style={styles.textContainer}>
        <Text style={[styles.title, dynamicStyles.title, isRush && dynamicStyles.titleActive]}>
          Rush Order
        </Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          Skip the wait - ready {RUSH_PREP_MINUTES} minutes after you place it
        </Text>
      </View>
      <View
        style={[
          styles.checkbox,
          { borderColor: isRush ? theme.colors.primary : theme.custom.border },
          isRush && { backgroundColor: theme.colors.primary },
        ]}
      >
        {isRush && <Text style={[styles.checkmark, { color: theme.colors.onPrimary }]}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },

  icon: {
    fontSize: 24,
  },

  textContainer: {
    flex: 1,
  },

  title: {
    fontSize: 16,
    fontFamily: fontFamilies.headingSemiBold,
    marginBottom: spacing.xxs,
  },

  subtitle: {
    fontSize: 13,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkmark: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyBold,
  },
});

export default RushOrderToggle;
