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
 * WHY SEPARATE COMPONENT?
 * - Reusable (could use in order edit, preferences)
 * - Testable in isolation
 * - Keeps CheckoutScreen focused on orchestration
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
   * WHY value AND onChange?
   * - Controlled component pattern
   * - Parent owns the state
   * - Easy to integrate with form validation
   * - Component is pure/predictable
   */

  return (
    <View style={styles.container}>
      {/* ========== SECTION LABEL ========== */}
      <Text style={styles.sectionLabel}>Fulfillment Type</Text>

      {/* ========== TOGGLE BUTTONS ========== */}
      <View style={styles.buttonContainer}>
        {/* ===== DELIVERY OPTION ===== */}
        <TouchableOpacity
          style={[
            styles.optionButton,
            /**
             * WHY CONDITIONAL STYLE?
             * - Visual feedback for selected state
             * - Blue border + light blue background when active
             * - Matches RegisterScreen role button pattern
             */
            value === 'delivery' && styles.optionButtonActive,
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
              value === 'delivery' && styles.optionTextActive,
            ]}
          >
            Delivery
          </Text>
        </TouchableOpacity>

        {/* ===== PICKUP OPTION ===== */}
        <TouchableOpacity
          style={[
            styles.optionButton,
            value === 'pickup' && styles.optionButtonActive,
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
              value === 'pickup' && styles.optionTextActive,
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
 * WHY StyleSheet.create?
 * - Performance optimization (created once)
 * - Style validation in development
 * - Consistent with app pattern
 *
 * FOLLOWS RegisterScreen roleButton styling
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
    color: '#333',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    /**
     * WHY UPPERCASE WITH LETTER SPACING?
     * - Looks like a form section header
     * - Distinguishes from input labels
     * - Professional appearance
     */
  },

  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    /**
     * WHY flexDirection: 'row'?
     * - Side-by-side buttons
     * - Matches plan mockup layout
     *
     * WHY gap: 12?
     * - Space between buttons
     * - Modern React Native (0.71+)
     * - Cleaner than marginRight on first button
     */
  },

  optionButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    /**
     * WHY flex: 1?
     * - Equal width buttons
     * - Responsive to screen size
     *
     * WHY borderRadius: 12?
     * - Slightly rounded corners
     * - Modern look
     * - Matches app card style
     *
     * WHY borderWidth: 2?
     * - Visible border for clarity
     * - Becomes blue when active
     */
  },

  optionButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
    /**
     * WHY THESE COLORS?
     * - Blue border matches primary app color
     * - Light blue background indicates selection
     * - Same colors as RegisterScreen role buttons
     */
  },

  optionIcon: {
    fontSize: 32,
    marginBottom: 8,
    /**
     * WHY large fontSize?
     * - Emoji needs larger size to be clear
     * - Visual prominence
     * - Easy to tap target
     */
  },

  optionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    /**
     * WHY gray text?
     * - Unselected state is subdued
     * - Contrast with active state
     */
  },

  optionTextActive: {
    color: '#007AFF',
    fontWeight: '600',
    /**
     * WHY blue text when active?
     * - Matches border color
     * - Clear indication of selection
     * - Consistent with app patterns
     */
  },
});

export default FulfillmentTypeSelector;
