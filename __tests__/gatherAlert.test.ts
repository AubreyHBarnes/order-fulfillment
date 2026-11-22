import { isFreshGatherAlert } from '../src/utils/gatherAlert';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const order = {
  $id: 'o1',
  shopperID: 'me',
  status: 'ready_for_pickup' as const,
  gatherAlertAt: '2026-11-22T11:59:30Z', // 30s ago
};

describe('isFreshGatherAlert', () => {
  test('own ready order, fresh, unseen -> alert', () => {
    expect(isFreshGatherAlert(order, 'me', new Set(), NOW)).toBe(true);
  });
  test('once per order', () => {
    expect(isFreshGatherAlert(order, 'me', new Set(['o1']), NOW)).toBe(false);
  });
  test("someone else's order, no stamp, or not ready -> no alert", () => {
    expect(isFreshGatherAlert(order, 'other', new Set(), NOW)).toBe(false);
    expect(isFreshGatherAlert({ ...order, gatherAlertAt: null }, 'me', new Set(), NOW)).toBe(false);
    expect(isFreshGatherAlert({ ...order, status: 'completed' as const }, 'me', new Set(), NOW)).toBe(false);
  });
  test('a stale stamp (replayed event) -> no alert', () => {
    expect(isFreshGatherAlert({ ...order, gatherAlertAt: '2026-11-22T11:55:00Z' }, 'me', new Set(), NOW)).toBe(false);
  });
});
