import { isNewArrivalNotice } from '../src/utils/arrivalNotice';

describe('isNewArrivalNotice', () => {
  it('shows once, ignores replays, shows again after reassignment', () => {
    const seen = new Set<string>();
    const a = { $id: 'a1', notifiedShopperAt: '2026-01-01T10:00:00Z' };
    expect(isNewArrivalNotice(a, seen)).toBe(true);
    expect(isNewArrivalNotice(a, seen)).toBe(false);
    expect(isNewArrivalNotice({ ...a, notifiedShopperAt: '2026-01-01T10:01:00Z' }, seen)).toBe(true);
    expect(isNewArrivalNotice({ ...a, $id: 'a2' }, seen)).toBe(true);
  });
});
