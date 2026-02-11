/**
 * Light Theme Configuration
 * File: src/theme/lightTheme.ts
 *
 * PURPOSE: Configure React Native Paper's theme for light mode
 *
 * WHY EXTEND MD3LightTheme?
 * - MD3 = Material Design 3 (latest version)
 * - Provides sensible defaults for all Paper components
 * - We only override what we need to customize
 * - Keeps compatibility with future Paper updates
 *
 * WHAT GETS THEMED?
 * - All React Native Paper components (Button, TextInput, Card, etc.)
 * - Our custom components (via useTheme() hook)
 * - Navigation header (can read theme)
 */

import { MD3LightTheme } from 'react-native-paper';
import { lightColors, palette } from './colors';

/**
 * WHY THIS STRUCTURE?
 * - Spread MD3LightTheme first (base values)
 * - Override specific values we want to change
 * - Add custom properties as needed
 * - TypeScript knows the shape from MD3LightTheme
 */
export const lightTheme = {
  ...MD3LightTheme,

  /**
   * CUSTOM FLAG
   * WHY dark: false?
   * - Helps components know which mode they're in
   * - Used by useTheme() to determine color adjustments
   * - React Native Paper uses this internally
   */
  dark: false,

  /**
   * COLORS CONFIGURATION
   *
   * Paper's color system follows Material Design 3:
   * - primary: Main brand color (buttons, links)
   * - onPrimary: Text/icons on primary color
   * - primaryContainer: Lighter primary (chips, tags)
   * - secondary: Accent color
   * - background: Screen background
   * - surface: Card/modal background
   * - error: Error states
   * - etc.
   *
   * WHY SPREAD EXISTING COLORS?
   * - Keeps any Paper colors we don't override
   * - Ensures all required colors exist
   * - Only customize what we need
   */
  colors: {
    ...MD3LightTheme.colors,

    // ===== PRIMARY COLORS =====
    primary: lightColors.primary,
    onPrimary: lightColors.onPrimary,
    primaryContainer: lightColors.primaryLight,
    onPrimaryContainer: lightColors.primaryDark,

    // ===== SECONDARY COLORS =====
    secondary: lightColors.secondary,
    onSecondary: lightColors.onSecondary,
    secondaryContainer: lightColors.secondaryLight,
    onSecondaryContainer: lightColors.secondary,

    // ===== BACKGROUND & SURFACE =====
    background: lightColors.background,
    onBackground: lightColors.textPrimary,
    surface: lightColors.surface,
    onSurface: lightColors.textPrimary,
    surfaceVariant: lightColors.surfaceVariant,
    onSurfaceVariant: lightColors.textSecondary,

    // ===== ERROR COLORS =====
    error: lightColors.error,
    onError: lightColors.onError,
    errorContainer: lightColors.errorLight,
    onErrorContainer: lightColors.error,

    // ===== OUTLINE & BORDERS =====
    outline: lightColors.border,
    outlineVariant: lightColors.borderLight,

    // ===== INVERSE (for snackbars, etc.) =====
    inverseSurface: palette.gray800,
    inverseOnSurface: palette.white,
    inversePrimary: palette.blue200,

    // ===== MISC =====
    shadow: palette.black,
    scrim: palette.black,
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },

  /**
   * CUSTOM COLORS
   *
   * WHY ADD CUSTOM PROPERTY?
   * - Paper's theme doesn't include all our semantic colors
   * - We need colors like 'success', 'warning', 'divider'
   * - Adding 'custom' keeps our extras organized
   * - Access via: theme.custom.success
   */
  custom: {
    // ===== SUCCESS COLORS =====
    success: lightColors.success,
    successLight: lightColors.successLight,

    // ===== WARNING COLORS =====
    warning: lightColors.warning,
    warningLight: lightColors.warningLight,

    // ===== TEXT VARIANTS =====
    textSecondary: lightColors.textSecondary,
    textDisabled: lightColors.textDisabled,

    // ===== BORDERS & DIVIDERS =====
    divider: lightColors.divider,
    border: lightColors.border,
    borderLight: lightColors.borderLight,

    // ===== INPUTS =====
    inputBackground: lightColors.inputBackground,
    inputBorder: lightColors.inputBorder,
    inputBorderFocused: lightColors.inputBorderFocused,

    // ===== CARDS =====
    cardBackground: lightColors.cardBackground,

    // ===== INTERACTIVE =====
    ripple: lightColors.ripple,
    disabled: lightColors.disabled,
    disabledText: lightColors.disabledText,

    // ===== STATUS BAR =====
    statusBar: lightColors.statusBar,
  },
};

/**
 * NOTE: AppTheme type is defined in theme/index.ts
 * This allows both light and dark themes to match the same interface
 */
