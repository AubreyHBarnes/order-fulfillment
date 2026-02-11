/**
 * Empty Cart Component
 * File: src/components/customer/EmptyCart.tsx
 *
 * WHY: Dedicated component for empty cart state
 *
 * COMPONENT DESIGN PRINCIPLES:
 * 1. Single Responsibility - Only displays empty state messaging
 * 2. Presentational - Receives callback via props, no internal state
 * 3. Reusable - Could be used anywhere an empty cart message is needed
 * 4. Accessible - Proper labels and hints for screen readers
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { EmptyCartProps } from '../../types';

/**
 * WHY functional component?
 * - Simple, stateless UI component
 * - Modern React pattern
 * - Easier to test (pure function of props)
 * - Better performance (no class overhead)
 */
const EmptyCart: React.FC<EmptyCartProps> = ({ onContinueShopping }) => {
  const theme = useAppTheme();

  const dynamicStyles = {
    message: {
      color: theme.custom.textSecondary,
    },
  };

  return (
    <View
      style={styles.container}
      /**
       * WHY accessible props on container?
       * - Screen readers can identify this as a distinct region
       * - Helps users understand they're in an empty state area
       * - WCAG compliance for meaningful structure
       */
      accessible={true}
      accessibilityLabel="Empty shopping cart"
      accessibilityRole="text"
    >
      {/*
        WHY emoji/icon for empty state?
        - Visual cue that communicates instantly
        - Softens the "emptiness" - feels less like an error
        - Standard pattern for empty states in mobile apps
      */}
      <Text style={styles.icon}>🛒</Text>

      <Text
        variant="headlineSmall"
        style={styles.title}
        /**
         * WHY variant="headlineSmall"?
         * - React Native Paper typography system
         * - Consistent sizing across app
         * - Semantic meaning (this is a headline)
         */
      >
        Your cart is empty
      </Text>

      <Text
        variant="bodyMedium"
        style={[styles.message, dynamicStyles.message]}
        /**
         * WHY bodyMedium for description?
         * - Secondary importance to headline
         * - Comfortable reading size
         * - Proper visual hierarchy
         */
      >
        Looks like you haven't added any items yet. Start shopping to fill your
        cart!
      </Text>

      <Button
        mode="contained"
        onPress={onContinueShopping}
        style={styles.button}
        icon="shopping"
        /**
         * WHY mode="contained"?
         * - Primary action button style
         * - High visual prominence
         * - Material Design standard for main CTAs
         *
         * WHY icon="shopping"?
         * - Visual reinforcement of action
         * - Consistent with shopping theme
         * - Helps users quickly identify button purpose
         */
        accessible={true}
        accessibilityLabel="Continue shopping"
        accessibilityHint="Double tap to browse products"
        accessibilityRole="button"
      >
        Continue Shopping
      </Button>
    </View>
  );
};

/**
 * STYLING DECISIONS:
 *
 * WHY centered layout?
 * - Empty state should be prominent
 * - Draws attention to the message
 * - Standard pattern for empty/error states
 *
 * WHY these specific values?
 * - padding: 32 gives breathing room
 * - fontSize: 64 makes icon prominent but not overwhelming
 * - marginBottom values create visual rhythm
 */
const styles = StyleSheet.create({
  // ===== LAYOUT =====
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    /**
     * WHY flex: 1?
     * - Takes all available vertical space
     * - Centers content in middle of screen
     * - Works with FlatList's ListEmptyComponent
     */
  },

  // ===== CONTENT =====
  icon: {
    fontSize: 64,
    marginBottom: 16,
    /**
     * WHY large font size for emoji?
     * - Makes icon visually prominent
     * - Creates focal point
     * - Communicates state at a glance
     */
  },

  title: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    /**
     * WHY textAlign: center?
     * - Matches centered layout
     * - Looks balanced
     * - Standard for empty states
     */
  },

  message: {
    textAlign: 'center',
    marginBottom: 24,
    /**
     * WHY secondary text color?
     * - Less prominent than title
     * - Proper visual hierarchy
     * - Matches Material Design secondary text
     */
  },

  // ===== ACTION =====
  button: {
    marginTop: 8,
    /**
     * WHY marginTop?
     * - Extra spacing from message
     * - Makes button feel intentional
     * - Prevents accidental taps
     */
  },
});

export default EmptyCart;
