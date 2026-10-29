/**
 * Dark theme. File: src/theme/darkTheme.ts
 * Dark gray surfaces with tonal elevation (no shadows); tokens in colors.ts.
 */
import { buildTheme } from './buildTheme';
import { darkColors } from './colors';

export const darkTheme = buildTheme(darkColors, true);
export type AppDarkTheme = typeof darkTheme;
