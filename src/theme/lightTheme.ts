/**
 * Light theme. File: src/theme/lightTheme.ts
 * Tokens live in colors.ts; mapping lives in buildTheme.ts.
 */
import { buildTheme } from './buildTheme';
import { lightColors } from './colors';

export const lightTheme = buildTheme(lightColors, false);
