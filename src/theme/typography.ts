/**
 * Typography tokens
 * File: src/theme/typography.ts
 *
 * Plus Jakarta Sans for headings, Inter for body (SIL OFL, static files in
 * android/app/src/main/assets/fonts). On Android a custom font is addressed
 * by its file name, so each weight is its own family and `fontWeight` is
 * left at 400: a heavier fontWeight on top would be faux-bolded.
 *
 * iOS: the same .ttf files must be added to the Xcode target and listed in
 * Info.plist UIFont. Not done or verified: development here is Android-only.
 */

import { configureFonts } from 'react-native-paper';
import type { TextStyle } from 'react-native';

export const fontFamilies = {
  headingSemiBold: 'PlusJakartaSans_600SemiBold',
  heading: 'PlusJakartaSans_700Bold',
  headingExtraBold: 'PlusJakartaSans_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Quantities, prices and ETAs line up in columns. */
export const tabularNums: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

type Variant = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: '400';
};

const v = (fontFamily: string, fontSize: number, lineHeight: number, letterSpacing = 0): Variant => ({
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
  fontWeight: '400',
});

// M3 type scale sizes, brand families
export const fonts = configureFonts({
  config: {
    displayLarge: v(fontFamilies.heading, 57, 64, -0.25),
    displayMedium: v(fontFamilies.heading, 45, 52),
    displaySmall: v(fontFamilies.heading, 36, 44),
    headlineLarge: v(fontFamilies.heading, 32, 40),
    headlineMedium: v(fontFamilies.heading, 28, 36),
    headlineSmall: v(fontFamilies.heading, 24, 32),
    titleLarge: v(fontFamilies.heading, 22, 28),
    titleMedium: v(fontFamilies.headingSemiBold, 16, 24, 0.15),
    titleSmall: v(fontFamilies.headingSemiBold, 14, 20, 0.1),
    labelLarge: v(fontFamilies.bodySemiBold, 14, 20, 0.1),
    labelMedium: v(fontFamilies.bodySemiBold, 12, 16, 0.5),
    labelSmall: v(fontFamilies.bodyMedium, 11, 16, 0.5),
    bodyLarge: v(fontFamilies.body, 16, 24, 0.15),
    bodyMedium: v(fontFamilies.body, 14, 20, 0.25),
    bodySmall: v(fontFamilies.body, 12, 16, 0.4),
  },
});
