/**
 * Every text/graphic pair in both themes meets WCAG AA:
 * 4.5:1 for text, 3:1 for icons and UI boundaries.
 * Run with PRINT_CONTRAST=1 to print the table that DESIGN_DECISIONS.md records.
 */
import { lightColors, darkColors } from '../src/theme/colors';
import type { ColorTokens } from '../src/theme/colors';
import { contrastRatio } from '../src/theme/contrast';

type Pair = { name: string; fg: string; bg: string; min: number };

const pairsFor = (c: ColorTokens): Pair[] => {
  const T = 4.5;
  const G = 3;
  const surfaces: Array<[string, string]> = [
    ['surface', c.surface],
    ['elevation1', c.elevation.level1],
    ['elevation3', c.elevation.level3],
    ['elevation5', c.elevation.level5],
  ];
  const pairs: Pair[] = [
    { name: 'onPrimary / primary', fg: c.onPrimary, bg: c.primary, min: T },
    { name: 'onPrimaryContainer / primaryContainer', fg: c.onPrimaryContainer, bg: c.primaryContainer, min: T },
    { name: 'onSecondaryContainer / secondaryContainer', fg: c.onSecondaryContainer, bg: c.secondaryContainer, min: T },
    { name: 'onTertiaryContainer / tertiaryContainer', fg: c.onTertiaryContainer, bg: c.tertiaryContainer, min: T },
    { name: 'onError / error', fg: c.onError, bg: c.error, min: T },
    { name: 'onErrorContainer / errorContainer', fg: c.onErrorContainer, bg: c.errorContainer, min: T },
    { name: 'onSurface / surfaceVariant', fg: c.onSurface, bg: c.surfaceVariant, min: T },
    { name: 'onSurfaceVariant / surfaceVariant', fg: c.onSurfaceVariant, bg: c.surfaceVariant, min: T },
    { name: 'inverseOnSurface / inverseSurface', fg: c.inverseOnSurface, bg: c.inverseSurface, min: T },
    { name: 'onMedia / mediaScrim over black', fg: c.onMedia, bg: '#000000', min: T },
  ];
  for (const [label, bg] of surfaces) {
    pairs.push(
      { name: `onSurface / ${label}`, fg: c.onSurface, bg, min: T },
      { name: `onSurfaceVariant / ${label}`, fg: c.onSurfaceVariant, bg, min: T },
      { name: `primary / ${label}`, fg: c.primary, bg, min: T },
      { name: `error / ${label}`, fg: c.error, bg, min: T },
      { name: `outline / ${label} (boundary)`, fg: c.outline, bg, min: G },
    );
    for (const k of ['picked', 'substituted', 'unavailable', 'actionNeeded'] as const) {
      pairs.push({ name: `status.${k}.color / ${label}`, fg: c.status[k].color, bg, min: T });
    }
  }
  for (const k of ['picked', 'substituted', 'unavailable', 'actionNeeded'] as const) {
    const s = c.status[k];
    pairs.push(
      { name: `status.${k}.onContainer / container`, fg: s.onContainer, bg: s.container, min: T },
      { name: `status.${k}.onSolid / solid`, fg: s.onSolid, bg: s.solid, min: T },
    );
  }
  return pairs;
};

for (const [mode, colors] of [['light', lightColors], ['dark', darkColors]] as const) {
  describe(`${mode} theme contrast`, () => {
    for (const p of pairsFor(colors)) {
      const ratio = contrastRatio(p.fg, p.bg);
      if (process.env.PRINT_CONTRAST) {
        process.stdout.write(`${mode}|${p.name}|${p.fg} on ${p.bg}|${ratio.toFixed(2)}|${p.min}\n`);
      }
      it(`${p.name} >= ${p.min}:1`, () => {
        expect(ratio).toBeGreaterThanOrEqual(p.min);
      });
    }
  });
}

describe('amber rule', () => {
  it('brand amber fill is never used as text/icon color on light surfaces', () => {
    expect(lightColors.status.substituted.color).not.toBe('#F2B33D');
    expect(contrastRatio(lightColors.status.substituted.color, lightColors.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
