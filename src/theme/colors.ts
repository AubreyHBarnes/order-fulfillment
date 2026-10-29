/**
 * Color tokens
 * File: src/theme/colors.ts
 *
 * Every token is a light/dark pair. Components never read these directly:
 * they go through useAppTheme() so a mode change re-renders them.
 *
 * Source colors (brand): primary #1F6F50, accent #F2B33D, surface #F7F8F5,
 * ink #1A1F1C. The Material 3 roles are generated from the primary hue
 * (@material/material-color-utilities, tone 80 for dark primary and the
 * container/secondary/tertiary ladders), then adjusted: light primary,
 * surface and ink are the exact brand values, and dark surfaces are the
 * M3 neutral tones (#111412 base), never pure black.
 *
 * Every text/graphic pair is checked against WCAG AA in
 * __tests__/themeContrast.test.ts, and the ratios are logged in
 * DESIGN_DECISIONS.md.
 */

/** A status meaning with its fixed visual treatment in one mode. */
export interface StatusColor {
  /** Icon/glyph and text color on the plain surface. */
  color: string;
  /** Soft background for chips and banners. */
  container: string;
  /** Text and icons on `container`. */
  onContainer: string;
  /** Solid fill for a status mark (check circle, dot). */
  solid: string;
  /** Glyph on `solid`. */
  onSolid: string;
}

export interface ColorTokens {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  /** Tonal elevation: higher level = more primary tint, not a shadow. */
  elevation: { level0: string; level1: string; level2: string; level3: string; level4: string; level5: string };
  /** Dimmed text (placeholders, disabled). Exempt from AA, but kept legible. */
  textDisabled: string;
  /** Modal scrim. One token so its opacity is tuned in one place. */
  scrim: string;
  /** Touch ripple. */
  ripple: string;
  /** Text/icon on photo overlays (always over a dark scrim, both modes). */
  onMedia: string;
  mediaScrim: string;
  status: {
    picked: StatusColor;
    substituted: StatusColor;
    unavailable: StatusColor;
    actionNeeded: StatusColor;
  };
}

export const lightColors: ColorTokens = {
  primary: '#1F6F50',
  onPrimary: '#FFFFFF',
  primaryContainer: '#CDEBDA',
  onPrimaryContainer: '#0B3D2A',
  secondary: '#4D6357',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#CFE9D9',
  onSecondaryContainer: '#0A1F16',
  tertiary: '#3D6473',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#C1E9FB',
  onTertiaryContainer: '#001F29',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#5C0F0B',
  background: '#F7F8F5',
  onBackground: '#1A1F1C',
  surface: '#F7F8F5',
  onSurface: '#1A1F1C',
  surfaceVariant: '#DCE5DD',
  onSurfaceVariant: '#454D47',
  outline: '#79827B',
  outlineVariant: '#CBD3CC',
  inverseSurface: '#2E312F',
  inverseOnSurface: '#EFF1ED',
  inversePrimary: '#6DDBAA',
  elevation: {
    level0: 'transparent',
    level1: '#F1F4F0',
    level2: '#EDF1ED',
    level3: '#E9EFEA',
    level4: '#E7EEE9',
    level5: '#E5ECE7',
  },
  textDisabled: '#8A918B',
  scrim: 'rgba(26, 31, 28, 0.5)',
  ripple: 'rgba(31, 111, 80, 0.12)',
  onMedia: '#FFFFFF',
  mediaScrim: 'rgba(0, 0, 0, 0.55)',
  status: {
    // green
    picked: { color: '#1F6F50', container: '#D5EBDD', onContainer: '#0F3B2A', solid: '#1F6F50', onSolid: '#FFFFFF' },
    // amber: the plain brand amber is 1.74:1 on the light surface, so the
    // icon/text step is a darker value of the same hue; the fill keeps the
    // brand amber with ink on it. Never amber text on white.
    substituted: { color: '#8A5A00', container: '#FBE7BC', onContainer: '#3D2A00', solid: '#F2B33D', onSolid: '#1A1F1C' },
    // gray
    unavailable: { color: '#5C655F', container: '#E2E5E0', onContainer: '#2F3631', solid: '#5C655F', onSolid: '#FFFFFF' },
    // red, sparingly
    actionNeeded: { color: '#B3261E', container: '#F9DEDC', onContainer: '#5C0F0B', solid: '#B3261E', onSolid: '#FFFFFF' },
  },
};

export const darkColors: ColorTokens = {
  primary: '#6DDBAA',
  onPrimary: '#003825',
  primaryContainer: '#0A5239',
  onPrimaryContainer: '#C6F5DD',
  secondary: '#B4CCBD',
  onSecondary: '#1F352A',
  secondaryContainer: '#364B40',
  onSecondaryContainer: '#CFE9D9',
  tertiary: '#A5CCDE',
  onTertiary: '#073543',
  tertiaryContainer: '#244C5A',
  onTertiaryContainer: '#C1E9FB',
  error: '#FFB4AB',
  onError: '#4B0008',
  errorContainer: '#7A1912',
  onErrorContainer: '#FFDAD6',
  background: '#111412',
  onBackground: '#E1E3DF',
  surface: '#111412',
  onSurface: '#E1E3DF',
  surfaceVariant: '#404943',
  onSurfaceVariant: '#BFC9C1',
  outline: '#8A938C',
  outlineVariant: '#404943',
  inverseSurface: '#E1E3DF',
  inverseOnSurface: '#2E312F',
  inversePrimary: '#006C4B',
  elevation: {
    level0: 'transparent',
    level1: '#161E1A',
    level2: '#18241E',
    level3: '#1B2A23',
    level4: '#1C2C24',
    level5: '#1E3027',
  },
  textDisabled: '#6F7872',
  scrim: 'rgba(0, 0, 0, 0.7)',
  ripple: 'rgba(109, 219, 170, 0.16)',
  onMedia: '#FFFFFF',
  mediaScrim: 'rgba(0, 0, 0, 0.55)',
  status: {
    picked: { color: '#6DDBAA', container: '#14402E', onContainer: '#C9F2DD', solid: '#6DDBAA', onSolid: '#003825' },
    // amber is naturally strong on dark: same brand hex, no shift needed
    substituted: { color: '#F2B33D', container: '#4A3810', onContainer: '#FBE3A6', solid: '#F2B33D', onSolid: '#1A1F1C' },
    unavailable: { color: '#A3ACA5', container: '#2C322E', onContainer: '#D4DAD5', solid: '#A3ACA5', onSolid: '#1A1F1C' },
    actionNeeded: { color: '#FFB4AB', container: '#7A1912', onContainer: '#FFDAD6', solid: '#FFB4AB', onSolid: '#4B0008' },
  },
};

export type StatusKey = keyof ColorTokens['status'];
