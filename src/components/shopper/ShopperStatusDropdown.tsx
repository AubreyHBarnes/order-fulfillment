/**
 * Shopper Status Dropdown Component
 * File: src/components/shopper/ShopperStatusDropdown.tsx
 *
 * PURPOSE:
 * Allows shoppers to toggle their availability status between
 * 'available' and 'unavailable'. This is a critical control that
 * determines whether the shopper receives new task assignments.
 *
 * ============================================================
 * DESIGN DECISIONS
 * ============================================================
 *
 * WHY A DROPDOWN vs TOGGLE SWITCH?
 *
 * Option A: Toggle Switch
 * - Pros: Familiar, quick to use
 * - Cons: Not as clear about current state, accidental toggles
 *
 * Option B: Dropdown (what we chose)
 * - Pros: Explicit labels, harder to accidentally change, extensible
 * - Cons: Requires extra tap to see options
 *
 * We chose dropdown because:
 * 1. STATUS IS IMPORTANT - Accidentally going unavailable means no orders
 * 2. EXTENSIBILITY - Could add 'on_break', 'busy' later without UI redesign
 * 3. CLARITY - "Available" text is clearer than a green switch
 *
 * ============================================================
 * CONTROLLED COMPONENT PATTERN
 * ============================================================
 *
 * This component doesn't manage its own state. Instead:
 * - Parent passes current `status`
 * - Parent passes `onStatusChange` callback
 * - Component just renders and reports changes
 *
 * WHY THIS PATTERN?
 * 1. SINGLE SOURCE OF TRUTH - Parent owns the state
 * 2. PREDICTABLE - Component always reflects props
 * 3. TESTABLE - Easy to test with mock props
 * 4. REUSABLE - Can be used with different state management
 *
 * EXAMPLE USAGE:
 * ```tsx
 * const [status, setStatus] = useState<ShopperAvailability>('unavailable');
 *
 * <ShopperStatusDropdown
 *   status={status}
 *   onStatusChange={async (newStatus) => {
 *     await updateStatusInDatabase(newStatus);
 *     setStatus(newStatus);
 *   }}
 * />
 * ```
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { ShopperStatusDropdownProps, ShopperAvailability } from '../../types';

// ============================================================
// STATUS CONFIGURATION
// ============================================================

/**
 * Configuration for each status option
 *
 * WHY DEFINE THIS SEPARATELY?
 * - Single source of truth for labels and colors
 * - Easy to add new statuses later
 * - Keeps render logic clean
 * - Could be moved to a constants file if used elsewhere
 */
interface StatusOption {
  value: ShopperAvailability;
  label: string;
  icon: string;
  description: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'available',
    label: 'Available',
    icon: 'check-circle',
    description: 'Ready to receive task assignments',
  },
  {
    value: 'unavailable',
    label: 'Unavailable',
    icon: 'close-circle',
    description: 'Not accepting new tasks',
  },
];

// ============================================================
// COMPONENT
// ============================================================

const ShopperStatusDropdown: React.FC<ShopperStatusDropdownProps> = ({
  status,
  onStatusChange,
  loading = false,
  disabled = false,
}) => {
  const theme = useAppTheme();

  /**
   * LOCAL STATE: Dropdown visibility
   *
   * WHY LOCAL STATE FOR VISIBILITY?
   * - Parent doesn't need to know if dropdown is open
   * - It's UI-only state, not business state
   * - Simpler parent component
   *
   * RULE OF THUMB:
   * - Business logic state → lift up to parent
   * - UI-only state → keep local
   */
  const [isOpen, setIsOpen] = useState(false);

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Get the current status option object
   *
   * WHY NOT INLINE?
   * - Used multiple times in render
   * - Clearer than finding in array each time
   * - TypeScript can infer the type
   */
  // Find current option - default to first option if not found (should never happen with typed status)
  const currentOption = STATUS_OPTIONS.find((opt) => opt.value === status) ?? STATUS_OPTIONS[0]!;

  /**
   * Get color based on status
   *
   * WHY THEME COLORS?
   * - Consistent with app design system
   * - Automatically adapts to dark mode
   * - Semantic meaning (success = available, error = unavailable... wait, that's not right)
   *
   * ACTUALLY: We use custom colors here because:
   * - 'unavailable' isn't an error, just a state
   * - Using theme.colors.error would imply something wrong
   * - We use muted colors to avoid alarm
   */
  const getStatusColor = (statusValue: ShopperAvailability): string => {
    return statusValue === 'available'
      ? theme.custom.success
      : theme.custom.textSecondary;
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleOpenDropdown = (): void => {
    if (!disabled && !loading) {
      setIsOpen(true);
    }
  };

  const handleSelectStatus = (newStatus: ShopperAvailability): void => {
    setIsOpen(false);
    if (newStatus !== status) {
      onStatusChange(newStatus);
    }
  };

  const handleCloseDropdown = (): void => {
    setIsOpen(false);
  };

  // ============================================================
  // DYNAMIC STYLES
  // ============================================================

  const dynamicStyles = {
    container: {
      backgroundColor: theme.colors.surface,
      borderColor: getStatusColor(status),
    },
    statusText: {
      color: getStatusColor(status),
    },
    chevron: {
      color: theme.custom.textSecondary,
    },
    modalOverlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    dropdownMenu: {
      backgroundColor: theme.colors.surface,
    },
    optionText: {
      color: theme.colors.onSurface,
    },
    optionDescription: {
      color: theme.custom.textSecondary,
    },
    selectedOption: {
      backgroundColor: theme.colors.primaryContainer,
    },
    label: {
      color: theme.custom.textSecondary,
    },
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <View style={styles.wrapper}>
      {/* Label above dropdown */}
      <Text variant="labelMedium" style={[styles.label, dynamicStyles.label]}>
        MY STATUS
      </Text>

      {/* Dropdown Trigger Button */}
      <TouchableOpacity
        onPress={handleOpenDropdown}
        disabled={disabled || loading}
        activeOpacity={0.7}
        style={[
          styles.container,
          dynamicStyles.container,
          disabled && styles.disabled,
        ]}
        /**
         * WHY ACCESSIBILITY PROPS?
         * - Screen readers need to announce this as a dropdown
         * - Users should know current selection
         * - Required for WCAG compliance
         */
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Status: ${currentOption.label}`}
        accessibilityHint="Double tap to change your availability status"
        accessibilityState={{ disabled, expanded: isOpen }}
      >
        {/* Status Icon */}
        <Icon
          source={currentOption.icon}
          size={24}
          color={getStatusColor(status)}
        />

        {/* Status Text */}
        <Text
          variant="titleMedium"
          style={[styles.statusText, dynamicStyles.statusText]}
        >
          {loading ? 'Updating...' : currentOption.label}
        </Text>

        {/* Chevron Icon */}
        <Icon
          source={isOpen ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={dynamicStyles.chevron.color}
        />
      </TouchableOpacity>

      {/* Dropdown Modal */}
      {/**
       * WHY MODAL vs ABSOLUTE POSITIONED VIEW?
       *
       * Option A: Absolute positioned View
       * - Simpler code
       * - But: Can be clipped by parent, z-index issues
       *
       * Option B: Modal (what we chose)
       * - Always renders on top
       * - Proper backdrop for dismissal
       * - Handles hardware back button on Android
       * - Standard pattern for dropdowns in React Native
       */}
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseDropdown}
      >
        {/* Backdrop - tap to close */}
        <Pressable
          style={[styles.modalOverlay, dynamicStyles.modalOverlay]}
          onPress={handleCloseDropdown}
        >
          {/* Dropdown Menu */}
          {/**
           * WHY PRESSABLE WITH stopPropagation PATTERN?
           * - Inner Pressable prevents taps from reaching backdrop
           * - onPress={undefined} means no action on menu tap
           * - But tap on option will trigger handleSelectStatus
           */}
          <View style={[styles.dropdownMenu, dynamicStyles.dropdownMenu]}>
            <Text variant="titleMedium" style={styles.menuTitle}>
              Set Your Status
            </Text>

            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleSelectStatus(option.value)}
                style={[
                  styles.option,
                  option.value === status && dynamicStyles.selectedOption,
                ]}
                activeOpacity={0.7}
              >
                <Icon
                  source={option.icon}
                  size={24}
                  color={getStatusColor(option.value)}
                />
                <View style={styles.optionTextContainer}>
                  <Text
                    variant="bodyLarge"
                    style={[styles.optionLabel, dynamicStyles.optionText]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.optionDescription, dynamicStyles.optionDescription]}
                  >
                    {option.description}
                  </Text>
                </View>
                {option.value === status && (
                  <Icon source="check" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  /**
   * WRAPPER
   * Contains label + dropdown trigger
   */
  wrapper: {
    marginBottom: 16,
  },

  /**
   * LABEL
   * "MY STATUS" text above the dropdown
   * WHY UPPERCASE?
   * - Consistent with section titles elsewhere in app
   * - Clear visual hierarchy (label vs value)
   */
  label: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },

  /**
   * CONTAINER
   * The main dropdown trigger button
   * WHY THESE STYLES?
   * - flexDirection: row - icon, text, chevron side by side
   * - alignItems: center - vertically centered
   * - padding: comfortable touch target
   * - borderRadius: 12 - modern, rounded look
   * - borderWidth: 2 - prominent border for emphasis
   */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },

  disabled: {
    opacity: 0.5,
  },

  statusText: {
    flex: 1,
    fontWeight: '600',
  },

  /**
   * MODAL OVERLAY
   * Dark backdrop behind dropdown
   * WHY FLEX: 1?
   * - Fills entire screen
   * - Tap anywhere outside menu to close
   */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  /**
   * DROPDOWN MENU
   * The actual menu that appears
   * WHY THESE STYLES?
   * - minWidth: ensures consistent width
   * - borderRadius: matches other cards
   * - elevation: appears above content (Android)
   * - shadowProps: appears above content (iOS)
   */
  dropdownMenu: {
    minWidth: 280,
    borderRadius: 16,
    padding: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },

  menuTitle: {
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12,
  },

  /**
   * OPTION
   * Individual option row in dropdown
   */
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },

  optionTextContainer: {
    flex: 1,
  },

  optionLabel: {
    fontWeight: '500',
  },

  optionDescription: {
    marginTop: 2,
  },
});

export default ShopperStatusDropdown;
