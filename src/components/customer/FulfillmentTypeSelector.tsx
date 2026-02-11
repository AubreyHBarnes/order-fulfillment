/**
 * Fulfillment Type Selector Component
 * File: src/components/customer/FulfillmentTypeSelector.tsx
 *
 * PURPOSE: Toggle between delivery and pickup fulfillment options
 *
 * FOLLOWS PATTERN FROM: RegisterScreen.tsx role selection
 * - Same toggle button UI pattern
 * - Same active/inactive styling approach
 * - Same accessibility implementation
 *
 * THEMING:
 * - Uses useAppTheme() for all colors
 * - Automatically adapts to light/dark mode
 * - No hardcoded hex values in styles
 *
 * WHY SEPARATE COMPONENT?
 * - Reusable (could use in order edit, preferences)
 * - Testable in isolation
 * - Keeps CheckoutScreen focused on orchestration
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
import type { FulfillmentTypeSelectorProps } from '../../types';

/**
 * WHY THESE IMPORTS?
 * - View: Container for layout
 * - Text: Display button labels and icons
 * - TouchableOpacity: Tappable buttons with feedback
 * - StyleSheet: Optimized styles
 * - Types: Prop types from shared types file
 */

const FulfillmentTypeSelector: React.FC<FulfillmentTypeSelectorProps> = ({
  value,
  onChange,
}) => {
  /**
   * ACCESS THEME
   *
   * WHY useAppTheme()?
   * - Returns our typed theme with custom colors
   * - Automatically updates when theme changes
   * - Provides theme.colors and theme.custom
   */
  const theme = useAppTheme();

  /**
   * WHY value AND onChange?
   * - Controlled component pattern
   * - Parent owns the state
   * - Easy to integrate with form validation
   * - Component is pure/predictable
   */

  /**
   * DYNAMIC STYLES
   *
   * WHY INLINE STYLES FOR COLORS?
   * - Theme values come from hook (not static)
   * - Can't use theme in StyleSheet.create (outside component)
   * - Combine static layout styles with dynamic color styles
   *
   * PATTERN:
   * - Static styles (layout, spacing) in StyleSheet
   * - Dynamic styles (colors) inline using theme
   */
  const dynamicStyles = {
    sectionLabel: {
      color: theme.colors.onBackground,
    },
    optionButton: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.custom.border,
    },
    optionButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    optionText: {
      color: theme.custom.textSecondary,
    },
    optionTextActive: {
      color: theme.colors.primary,
    },
  };

  return (
    <View style={styles.container}>
      {/* ========== SECTION LABEL ========== */}
      <Text style={[styles.sectionLabel, dynamicStyles.sectionLabel]}>
        Fulfillment Type
      </Text>

      {/* ========== TOGGLE BUTTONS ========== */}
      <View style={styles.buttonContainer}>
        {/* ===== DELIVERY OPTION ===== */}
        <TouchableOpacity
          style={[
            styles.optionButton,
            dynamicStyles.optionButton,
            /**
             * WHY CONDITIONAL STYLE?
             * - Visual feedback for selected state
             * - Primary border + container background when active
             * - Automatically adapts to light/dark mode
             */
            value === 'delivery' && dynamicStyles.optionButtonActive,
          ]}
          onPress={() => onChange('delivery')}
          /**
           * WHY ACCESSIBILITY PROPS?
           * - Screen reader support (VoiceOver, TalkBack)
           * - WCAG compliance
           * - Professional app standard
           */
          accessible={true}
          accessibilityLabel="Delivery option"
          accessibilityHint="Select to have your order delivered to your address"
          accessibilityRole="button"
          accessibilityState={{ selected: value === 'delivery' }}
        >
          {/* WHY EMOJI ICON?
           * - Visual clarity without icon library
           * - Works cross-platform
           * - Matches plan mockup (truck emoji)
           */}
          <Text style={styles.optionIcon}>🚚</Text>
          <Text
            style={[
              styles.optionText,
              dynamicStyles.optionText,
              value === 'delivery' && dynamicStyles.optionTextActive,
            ]}
          >
            Delivery
          </Text>
        </TouchableOpacity>

        {/* ===== PICKUP OPTION ===== */}
        <TouchableOpacity
          style={[
            styles.optionButton,
            dynamicStyles.optionButton,
            value === 'pickup' && dynamicStyles.optionButtonActive,
          ]}
          onPress={() => onChange('pickup')}
          accessible={true}
          accessibilityLabel="Pickup option"
          accessibilityHint="Select to pick up your order at a store location"
          accessibilityRole="button"
          accessibilityState={{ selected: value === 'pickup' }}
        >
          <Text style={styles.optionIcon}>🏪</Text>
          <Text
            style={[
              styles.optionText,
              dynamicStyles.optionText,
              value === 'pickup' && dynamicStyles.optionTextActive,
            ]}
          >
            Pickup
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

/**
 * WHY StyleSheet.create FOR LAYOUT ONLY?
 * - Performance optimization (created once)
 * - Layout styles don't change with theme
 * - Colors are applied via dynamicStyles (theme-aware)
 *
 * PATTERN:
 * - StyleSheet: layout, spacing, sizing
 * - dynamicStyles: colors (from theme)
 */
const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    /**
     * WHY marginBottom?
     * - Space before next section
     * - Consistent spacing with other form sections
     */
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    /**
     * WHY NO COLOR HERE?
     * - Color comes from dynamicStyles.sectionLabel
     * - Adapts to light/dark mode automatically
     */
  },

  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    /**
     * WHY flexDirection: 'row'?
     * - Side-by-side buttons
     * - Matches plan mockup layout
     */
  },

  optionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    /**
     * WHY NO backgroundColor OR borderColor?
     * - Colors come from dynamicStyles
     * - Theme-aware (light/dark mode)
     */
  },

  optionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },

  optionText: {
    fontSize: 16,
    fontWeight: '500',
    /**
     * WHY NO color?
     * - Color from dynamicStyles.optionText
     * - Changes based on theme
     */
  },
});

export default FulfillmentTypeSelector;
