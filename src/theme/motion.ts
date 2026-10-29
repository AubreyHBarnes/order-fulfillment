/**
 * Motion tokens
 * File: src/theme/motion.ts
 *
 * Plain data, no animation library: Reanimated (Phase 2) reads these.
 * Nothing the shopper has to wait through should exceed `slow`.
 *
 * Easings are cubic-bezier control points [x1, y1, x2, y2] so they can feed
 * Reanimated's Easing.bezier(...) or any other engine.
 */

export const duration = {
  fast: 150, // feedback: taps, check marks
  base: 250, // continuity: state changes, banners
  slow: 400, // orientation: screen-level transitions
} as const;

export const easing = {
  /** Things entering or settling: quick start, soft landing. */
  standard: [0.2, 0, 0, 1],
  /** Things leaving: soft start, quick exit. */
  exit: [0.3, 0, 1, 1],
  /** Symmetric, for progress that moves between two resting points. */
  emphasized: [0.4, 0, 0.2, 1],
} as const;

/** Spring configs (Reanimated withSpring). Assured, not bouncy. */
export const spring = {
  /** Default: confident settle, no visible overshoot. */
  settle: { damping: 20, stiffness: 220, mass: 1 },
  /** A little life for confirmations (the item-picked check). */
  pop: { damping: 14, stiffness: 260, mass: 0.8 },
  /** Layout shifts: list rows reflowing. */
  layout: { damping: 24, stiffness: 200, mass: 1 },
} as const;
