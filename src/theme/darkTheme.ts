/**
 * Dark Theme Configuration
 * File: src/theme/darkTheme.ts
 *
 * PURPOSE: Configure React Native Paper's theme for dark mode
 *
 * WHY SEPARATE FILE FROM LIGHT?
 * - Clearer organization
 * - Each theme is self-contained
 * - Easy to compare light vs dark values
 * - Can import just the theme you need
 *
 * DARK MODE DESIGN PRINCIPLES:
 * - Use #121212 base (not pure black) - easier on eyes
 * - Elevate surfaces with lighter grays (visual hierarchy)
 * - Desaturate colors slightly (less eye strain)
 * - Ensure WCAG contrast ratios (4.5:1 for text)
 */

import { MD3DarkTheme } from 'react-native-paper';
import { darkColors, palette } from './colors';

export const darkTheme = {
  ...MD3DarkTheme,

  /**
   * WHY dark: true?
   * - Components can check theme.dark for mode-specific logic
   * - Used by navigation, status bar, etc.
   * - Opposite of lightTheme.dark
   */
  dark: true,

  colors: {
    ...MD3DarkTheme.colors,

    // ===== PRIMARY COLORS =====
    /**
     * WHY LIGHTER PRIMARY IN DARK MODE?
     * - Blue500 (#007AFF) has poor contrast on dark backgrounds
     * - Blue200 is lighter, more visible
     * - Still recognizable as "the blue brand color"
     */
    primary: darkColors.primary,
    onPrimary: darkColors.onPrimary,
    primaryContainer: palette.blue700,  // Darker container for contrast
    onPrimaryContainer: palette.blue100,

    // ===== SECONDARY COLORS =====
    secondary: darkColors.secondary,
    onSecondary: darkColors.onSecondary,
    secondaryContainer: palette.green700,
    onSecondaryContainer: palette.green100,

    // ===== BACKGROUND & SURFACE =====
    /**
     * WHY #121212 NOT #000000?
     * - Pure black is harsh on OLED screens
     * - #121212 is Material Design recommendation
     * - Allows for elevation shadows to be visible
     */
    background: darkColors.background,
    onBackground: darkColors.textPrimary,
    surface: darkColors.surface,
    onSurface: darkColors.textPrimary,
    surfaceVariant: darkColors.surfaceVariant,
    onSurfaceVariant: darkColors.textSecondary,

    // ===== ERROR COLORS =====
    /**
     * WHY LIGHTER ERROR IN DARK MODE?
     * - Red500 on dark is hard to read
     * - Red100 provides better contrast
     * - Still clearly "error red"
     */
    error: darkColors.error,
    onError: darkColors.onError,
    errorContainer: darkColors.errorLight,
    onErrorContainer: palette.red100,

    // ===== OUTLINE & BORDERS =====
    outline: darkColors.border,
    outlineVariant: darkColors.borderLight,

    // ===== INVERSE (for snackbars, tooltips) =====
    /**
     * WHY INVERSE?
     * - Snackbars/toasts need to stand out
     * - In dark mode, they use light colors (inverse)
     * - Creates visual separation from content
     */
    inverseSurface: palette.gray100,
    inverseOnSurface: palette.gray900,
    inversePrimary: palette.blue700,

    // ===== MISC =====
    shadow: palette.black,
    scrim: palette.black,
    backdrop: 'rgba(0, 0, 0, 0.7)',  // Darker backdrop in dark mode
  },

  /**
   * CUSTOM COLORS FOR DARK MODE
   *
   * Same structure as lightTheme.custom
   * Different values for dark mode visibility
   */
  custom: {
    // ===== SUCCESS COLORS =====
    success: darkColors.success,
    successLight: darkColors.successLight,

    // ===== WARNING COLORS =====
    warning: darkColors.warning,
    warningLight: darkColors.warningLight,

    // ===== TEXT VARIANTS =====
    textSecondary: darkColors.textSecondary,
    textDisabled: darkColors.textDisabled,

    // ===== BORDERS & DIVIDERS =====
    divider: darkColors.divider,
    border: darkColors.border,
    borderLight: darkColors.borderLight,

    // ===== INPUTS =====
    inputBackground: darkColors.inputBackground,
    inputBorder: darkColors.inputBorder,
    inputBorderFocused: darkColors.inputBorderFocused,

    // ===== CARDS =====
    cardBackground: darkColors.cardBackground,

    // ===== INTERACTIVE =====
    ripple: darkColors.ripple,
    disabled: darkColors.disabled,
    disabledText: darkColors.disabledText,

    // ===== STATUS BAR =====
    /**
     * WHY 'light-content'?
     * - iOS status bar shows white icons/text
     * - Visible on dark backgrounds
     * - Opposite of light mode ('dark-content')
     */
    statusBar: darkColors.statusBar,
  },
};

export type AppDarkTheme = typeof darkTheme;
