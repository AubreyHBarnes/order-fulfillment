/**
 * Color Palette
 * File: src/theme/colors.ts
 *
 * PURPOSE: Single source of truth for all colors in the app
 *
 * WHY CENTRALIZE COLORS?
 * - Change a color once, it updates everywhere
 * - Ensures consistency across the app
 * - Makes it easy to implement dark mode
 * - Designers can review/update colors in one place
 * - Prevents "magic numbers" (hardcoded hex values)
 *
 * ORGANIZATION:
 * 1. Palette - Raw color values (like paint colors)
 * 2. Semantic - What colors mean (primary, error, background)
 * 3. Light/Dark variants - Theme-specific mappings
 */

// ============================================================
// PALETTE - Raw Color Values
// ============================================================

/**
 * WHY SEPARATE PALETTE?
 * - These are your "paint colors" - the actual hex values
 * - Semantic colors reference these
 * - Easy to see all available colors at a glance
 * - Can be shared between light and dark themes
 *
 * NAMING CONVENTION:
 * - colorName + intensity (blue500, gray100)
 * - 50 = lightest, 900 = darkest
 * - Follows Material Design naming
 */
export const palette = {
  // ===== BRAND BLUE =====
  // Primary brand color - used for main actions, links, emphasis
  blue50: '#E3F2FD',   // Very light - backgrounds, highlights
  blue100: '#BBDEFB',  // Light - hover states, secondary backgrounds
  blue200: '#90CAF9',  // Light-medium
  blue500: '#007AFF',  // Primary - buttons, links (iOS blue)
  blue600: '#0066CC',  // Darker - pressed states
  blue700: '#0055AA',  // Dark - text on light backgrounds

  // ===== GREEN =====
  // Success states, confirmations, positive actions
  green50: '#E8F5E9',
  green100: '#C8E6C9',
  green500: '#4CAF50',  // Success - checkmarks, confirmations
  green600: '#43A047',
  green700: '#388E3C',

  // ===== RED =====
  // Error states, destructive actions, required fields
  red50: '#FFEBEE',
  red100: '#FFCDD2',
  red400: '#F44336',  // Medium red - alerts, warnings
  red500: '#E53935',   // Error - validation, destructive
  red600: '#D32F2F',
  red700: '#C62828',

  // ===== YELLOW/ORANGE =====
  // Warnings, caution states
  yellow50: '#FFF8E1',
  yellow500: '#FFC107',  // Warning
  orange500: '#FF9800',

  // ===== GRAY =====
  // Backgrounds, borders, disabled states, text
  white: '#FFFFFF',
  gray50: '#FAFAFA',   // Almost white - subtle backgrounds
  gray100: '#F5F5F5',  // Light gray - screen backgrounds
  gray200: '#EEEEEE',  // Light - card backgrounds in dark mode
  gray300: '#E0E0E0',  // Borders, dividers
  gray400: '#BDBDBD',  // Disabled text, placeholders
  gray500: '#9E9E9E',  // Secondary text
  gray600: '#757575',  // Body text (light mode)
  gray700: '#616161',
  gray800: '#424242',  // Headings (light mode)
  gray900: '#212121',  // Primary text (light mode)
  black: '#000000',

  // ===== DARK MODE SPECIFIC =====
  // Special colors for dark backgrounds
  darkBg: '#121212',       // True dark background
  darkSurface: '#1E1E1E',  // Elevated surfaces (cards)
  darkSurface2: '#2C2C2C', // Higher elevation
  darkBorder: '#333333',   // Borders in dark mode
} as const;

/**
 * WHY "as const"?
 * - Makes TypeScript treat these as literal types
 * - palette.blue500 is type '#007AFF', not just 'string'
 * - Enables autocomplete and type checking
 * - Prevents accidental modification
 */

// ============================================================
// SEMANTIC COLORS - Light Theme
// ============================================================

/**
 * WHY SEMANTIC NAMING?
 * - "primary" is more meaningful than "blue500"
 * - Components don't need to know the actual color
 * - Easy to swap colors without changing component code
 * - Example: primary could be blue for one brand, green for another
 */
export const lightColors = {
  // ===== PRIMARY =====
  // Main brand color - buttons, links, active states
  primary: palette.blue500,
  primaryLight: palette.blue50,
  primaryDark: palette.blue700,
  onPrimary: palette.white,  // Text/icons ON primary color

  // ===== SECONDARY =====
  // Accent color - less prominent than primary
  secondary: palette.green500,
  secondaryLight: palette.green50,
  onSecondary: palette.white,

  // ===== BACKGROUND =====
  // Screen and surface backgrounds
  background: palette.gray100,     // Screen background
  surface: palette.white,          // Card/modal backgrounds
  surfaceVariant: palette.gray50,  // Subtle surface variation

  // ===== TEXT =====
  // All text colors
  textPrimary: palette.gray900,    // Main text, headings
  textSecondary: palette.gray600,  // Subtitles, captions
  textDisabled: palette.gray400,   // Disabled/placeholder text
  textOnPrimary: palette.white,    // Text on primary color

  // ===== STATES =====
  // Feedback colors
  error: palette.red500,
  errorLight: palette.red50,
  onError: palette.white,
  success: palette.green500,
  successLight: palette.green50,
  warning: palette.yellow500,
  warningLight: palette.yellow50,

  // ===== BORDERS & DIVIDERS =====
  border: palette.gray300,
  borderLight: palette.gray200,
  divider: palette.gray200,

  // ===== INTERACTIVE =====
  // States for interactive elements
  disabled: palette.gray300,
  disabledText: palette.gray400,
  ripple: 'rgba(0, 122, 255, 0.1)',  // Touch feedback

  // ===== SPECIFIC UI =====
  // Component-specific colors
  cardBackground: palette.white,
  inputBackground: palette.white,
  inputBorder: palette.gray300,
  inputBorderFocused: palette.blue500,
  headerBackground: palette.white,
  tabBarBackground: palette.white,
  statusBar: 'dark-content',  // iOS status bar style
} as const;

// ============================================================
// SEMANTIC COLORS - Dark Theme
// ============================================================

/**
 * WHY DIFFERENT DARK COLORS?
 * - Light colors on dark backgrounds need different values
 * - Pure white (#FFFFFF) is too harsh on dark backgrounds
 * - Colors need higher contrast ratios
 * - Some colors need to be lighter (blue500 → blue200)
 */
export const darkColors = {
  // ===== PRIMARY =====
  // Lighter primary for visibility on dark backgrounds
  primary: palette.blue200,         // Lighter blue for dark mode
  primaryLight: palette.blue100,
  primaryDark: palette.blue500,
  onPrimary: palette.gray900,       // Dark text on light primary

  // ===== SECONDARY =====
  secondary: palette.green100,
  secondaryLight: palette.green50,
  onSecondary: palette.gray900,

  // ===== BACKGROUND =====
  background: palette.darkBg,           // True black background
  surface: palette.darkSurface,         // Elevated surfaces
  surfaceVariant: palette.darkSurface2, // Higher elevation

  // ===== TEXT =====
  // Light text on dark backgrounds
  textPrimary: palette.gray100,     // Main text (almost white)
  textSecondary: palette.gray400,   // Subtitles (dimmer)
  textDisabled: palette.gray600,    // Disabled text
  textOnPrimary: palette.gray900,   // Dark text on primary

  // ===== STATES =====
  // Lighter error/success for visibility
  error: palette.red100,
  errorLight: 'rgba(229, 57, 53, 0.2)',  // Semi-transparent red
  onError: palette.gray900,
  success: palette.green100,
  successLight: 'rgba(76, 175, 80, 0.2)',
  warning: palette.yellow500,
  warningLight: 'rgba(255, 193, 7, 0.2)',

  // ===== BORDERS & DIVIDERS =====
  border: palette.darkBorder,
  borderLight: palette.gray800,
  divider: palette.gray800,

  // ===== INTERACTIVE =====
  disabled: palette.gray700,
  disabledText: palette.gray600,
  ripple: 'rgba(144, 202, 249, 0.2)',  // Light blue ripple

  // ===== SPECIFIC UI =====
  cardBackground: palette.darkSurface,
  inputBackground: palette.darkSurface,
  inputBorder: palette.darkBorder,
  inputBorderFocused: palette.blue200,
  headerBackground: palette.darkSurface,
  tabBarBackground: palette.darkSurface,
  statusBar: 'light-content',  // Light status bar for dark mode
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

/**
 * WHY EXPORT TYPES?
 * - TypeScript knows what colors are available
 * - Autocomplete in IDE
 * - Catch typos at compile time
 * - Components can type their color props
 */
export type ColorPalette = typeof palette;
export type SemanticColors = typeof lightColors;
