/**
 * Spacing and radius tokens
 * File: src/theme/layout.ts
 *
 * Scale taken from the audit of 398 padding/margin/gap literals: 4/8/12/16
 * /20/24/32 carried almost all of them. Off-scale values (5, 6, 10, 14, 15,
 * 18, 30) were left as they are for now: snapping them changes the layout,
 * which is a visual decision, not a refactor.
 */

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/** Minimum touch target (dp), WCAG 2.5.8 / Material. */
export const minTouchTarget = 48;
