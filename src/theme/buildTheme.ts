/**
 * Theme builder
 * File: src/theme/buildTheme.ts
 *
 * Maps one ColorTokens set onto Paper's MD3 theme plus the app's `custom`
 * extension, so light and dark are built by the same code and cannot drift
 * apart structurally.
 */

import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import type { ColorTokens } from './colors';
import { fonts } from './typography';

export interface CustomThemeColors {
  /** Legacy aliases kept so existing screens keep working; new code uses `status`. */
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  textSecondary: string;
  textDisabled: string;
  divider: string;
  border: string;
  borderLight: string;
  inputBackground: string;
  inputBorder: string;
  inputBorderFocused: string;
  cardBackground: string;
  ripple: string;
  disabled: string;
  disabledText: string;
  statusBar: 'dark-content' | 'light-content';
  status: ColorTokens['status'];
  scrim: string;
  onMedia: string;
  mediaScrim: string;
}

export interface AppTheme extends MD3Theme {
  custom: CustomThemeColors;
}

export const buildTheme = (c: ColorTokens, dark: boolean): AppTheme => {
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark,
    fonts,
    colors: {
      ...base.colors,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primaryContainer,
      onPrimaryContainer: c.onPrimaryContainer,
      secondary: c.secondary,
      onSecondary: c.onSecondary,
      secondaryContainer: c.secondaryContainer,
      onSecondaryContainer: c.onSecondaryContainer,
      tertiary: c.tertiary,
      onTertiary: c.onTertiary,
      tertiaryContainer: c.tertiaryContainer,
      onTertiaryContainer: c.onTertiaryContainer,
      error: c.error,
      onError: c.onError,
      errorContainer: c.errorContainer,
      onErrorContainer: c.onErrorContainer,
      background: c.background,
      onBackground: c.onBackground,
      surface: c.surface,
      onSurface: c.onSurface,
      surfaceVariant: c.surfaceVariant,
      onSurfaceVariant: c.onSurfaceVariant,
      outline: c.outline,
      outlineVariant: c.outlineVariant,
      inverseSurface: c.inverseSurface,
      inverseOnSurface: c.inverseOnSurface,
      inversePrimary: c.inversePrimary,
      surfaceDisabled: c.textDisabled + '33',
      onSurfaceDisabled: c.textDisabled,
      shadow: '#000000',
      scrim: '#000000',
      backdrop: c.scrim,
      elevation: c.elevation,
    },
    custom: {
      success: c.status.picked.color,
      successLight: c.status.picked.container,
      warning: c.status.substituted.color,
      warningLight: c.status.substituted.container,
      textSecondary: c.onSurfaceVariant,
      textDisabled: c.textDisabled,
      divider: c.outlineVariant,
      border: c.outline,
      borderLight: c.outlineVariant,
      inputBackground: c.surface,
      inputBorder: c.outline,
      inputBorderFocused: c.primary,
      cardBackground: c.elevation.level1,
      ripple: c.ripple,
      disabled: c.surfaceVariant,
      disabledText: c.textDisabled,
      statusBar: dark ? 'light-content' : 'dark-content',
      status: c.status,
      scrim: c.scrim,
      onMedia: c.onMedia,
      mediaScrim: c.mediaScrim,
    },
  };
};
