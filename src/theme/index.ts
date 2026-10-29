/**
 * Theme Exports
 * File: src/theme/index.ts
 *
 * PURPOSE: Central export point for all theme-related code
 *
 * WHY INDEX FILE?
 * - Clean imports: import { useAppTheme, lightTheme } from '../theme'
 * - Single entry point for theme system
 * - Hides internal file structure
 * - Easy to refactor internals without changing imports
 */

import { useTheme } from 'react-native-paper';
import type { AppTheme } from './buildTheme';
import { lightTheme } from './lightTheme';
import { darkTheme } from './darkTheme';

// ============================================================
// RE-EXPORTS
// ============================================================

// Export themes for use in providers
export { lightTheme } from './lightTheme';
export { darkTheme } from './darkTheme';

// Export colors for direct access if needed
export { lightColors, darkColors } from './colors';
export type { ColorTokens, StatusColor, StatusKey } from './colors';
export type { AppTheme, CustomThemeColors } from './buildTheme';
export { fontFamilies, tabularNums, fonts } from './typography';
export { spacing, radius, minTouchTarget } from './layout';
export { duration, easing, spring } from './motion';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

// ============================================================
// TYPED THEME HOOK
// ============================================================

/**
 * useAppTheme - Type-safe theme hook
 *
 * WHY CUSTOM HOOK?
 * - React Native Paper's useTheme() returns generic MD3Theme
 * - Our theme has extra properties (custom.success, etc.)
 * - This hook returns our extended AppTheme type
 * - Full autocomplete for theme.custom.* properties
 *
 * USAGE:
 * const theme = useAppTheme();
 * const primaryColor = theme.colors.primary;
 * const successColor = theme.custom.success;  // <- This wouldn't work with plain useTheme()
 *
 * WHY NOT JUST CAST?
 * - Casting everywhere is repetitive: (useTheme() as AppTheme)
 * - Easy to forget the cast
 * - Single source of truth for the type
 */
export const useAppTheme = () => useTheme() as AppTheme;

// ============================================================
// THEME MODE TYPE
// ============================================================

/**
 * ThemeMode - User's theme preference
 *
 * WHY THREE OPTIONS?
 * - 'light': Always use light theme
 * - 'dark': Always use dark theme
 * - 'system': Follow device setting (most common preference)
 *
 * SYSTEM DETECTION:
 * - Uses React Native's useColorScheme() hook
 * - Automatically updates when device setting changes
 * - Works on iOS, Android, and web
 */
export type ThemeMode = 'light' | 'dark' | 'system';

// ============================================================
// THEME HELPERS
// ============================================================

/**
 * getThemeFromMode - Get the appropriate theme based on mode and system preference
 *
 * WHY THIS HELPER?
 * - Centralizes theme selection logic
 * - Handles 'system' mode by checking systemColorScheme
 * - Returns correct theme object
 *
 * @param mode - User's preference ('light', 'dark', or 'system')
 * @param systemColorScheme - Device's current color scheme (from useColorScheme)
 * @returns The appropriate theme (lightTheme or darkTheme)
 */
export const getThemeFromMode = (
  mode: ThemeMode,
  systemColorScheme: string | null | undefined
): AppTheme => {
  /**
   * WHY CHECK MODE FIRST?
   * - If user explicitly chose light/dark, use that
   * - Only check system preference for 'system' mode
   * - Respects user choice over system setting
   */
  if (mode === 'light') return lightTheme;
  if (mode === 'dark') return darkTheme;

  // mode === 'system' - follow device setting
  /**
   * WHY DEFAULT TO LIGHT?
   * - systemColorScheme can be null (no preference)
   * - Light mode is safer default (better contrast)
   * - Matches most app defaults
   */
  return systemColorScheme === 'dark' ? darkTheme : lightTheme;
};

/**
 * isDarkTheme - Check if current theme is dark mode
 *
 * WHY THIS HELPER?
 * - Some components need to know light vs dark
 * - Cleaner than checking theme.dark everywhere
 * - Type-safe boolean return
 *
 * @param theme - Current theme object
 * @returns true if dark mode, false if light mode
 */
export const isDarkTheme = (theme: AppTheme): boolean => theme.dark;
