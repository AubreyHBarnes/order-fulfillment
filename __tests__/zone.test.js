import {
  DEFAULT_ZONE_RULES,
  distanceToZoneMeters,
  evaluateReading,
} from '../functions/auto-assignment/src/zone.js';

// Stand-in geography (not a real store): origin in empty farmland, meters east/north of it.
const ORIGIN = { lat: 40, lng: -100 };
const M_PER_DEG_LAT = (Math.PI * 6371000) / 180;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);
const at = (east, north) => ({
  lat: ORIGIN.lat + north / M_PER_DEG_LAT,
  lng: ORIGIN.lng + east / M_PER_DEG_LNG,
});

// Pickup lot: 60m x 40m. A road runs east-west 40m north of its edge (inside the 100m buffer).
// A competitor's pickup lot sits 356m east, per the real geometry this models.
const lotRing = [
  [0, 0],
  [60, 0],
  [60, 40],
  [0, 40],
].map(([e, n]) => {
  const p = at(e, n);
  return [p.lng, p.lat];
});
const zone = { polygon: lotRing, ...DEFAULT_ZONE_RULES };

const INTERVAL_MS = 15000;

// Feed [east, north] points (one per 15s, accuracy 10m) through the rules.
function run(points, { rules = {}, extra = {} } = {}) {
  const z = { ...zone, ...rules };
  let state = { insideCount: 0 };
  const decisions = [];
  points.forEach(([e, n], i) => {
    const { lat, lng } = at(e, n);
    const r = evaluateReading(z, state, { lat, lng, accuracy: 10, reportedAt: i * INTERVAL_MS, ...extra });
    decisions.push(r.decision);
    state = { insideCount: r.insideCount, last: r.last };
  });
  return decisions;
}

const arrivedAt = (decisions) => decisions.indexOf('arrived');

describe('distanceToZoneMeters', () => {
  test('0 inside, edge distance outside', () => {
    const inside = at(30, 20);
    const east = at(160, 20);
    const corner = at(-30, -40); // 30 west, 40 south of the corner -> 50m
    expect(distanceToZoneMeters(inside.lat, inside.lng, lotRing)).toBe(0);
    expect(distanceToZoneMeters(east.lat, east.lng, lotRing)).toBeCloseTo(100, 0);
    expect(distanceToZoneMeters(corner.lat, corner.lng, lotRing)).toBeCloseTo(50, 0);
  });
});

describe('fixture trips', () => {
  test('approach and park -> arrives once, at the second qualifying reading', () => {
    const d = run([[-400, 20], [-300, 20], [-200, 20], [-100, 20], [-50, 20], [-10, 20], [30, 20]]);
    expect(arrivedAt(d)).toBe(4); // -100 is 100m out (inside), -50 confirms
    expect(d.slice(0, 3)).toEqual(['outside', 'outside', 'outside']);
  });

  test('drive past on the road at 35 mph -> never arrives (speed gate)', () => {
    // 15.6 m/s = 235m per 15s reading; every reading is fast.
    const d = run([[-500, 80], [-265, 80], [-30, 80], [205, 80], [440, 80]]);
    expect(arrivedAt(d)).toBe(-1);
    expect(d).toContain('ignored-speed');
  });

  test('stopped at a light inside the buffer -> DOES arrive (known limit, see ponytail note)', () => {
    const d = run([[-300, 80], [-100, 80], [-5, 80], [-5, 80], [-5, 80]]);
    expect(arrivedAt(d)).toBeGreaterThan(-1);
  });

  test('same light with the buffer tightened to the lot -> no arrival', () => {
    const d = run([[-300, 80], [-100, 80], [-5, 80], [-5, 80], [-5, 80]], { rules: { bufferMeters: 20 } });
    expect(arrivedAt(d)).toBe(-1);
  });

  test("parking in the competitor's lot 356m east -> never arrives", () => {
    const d = run([[600, 20], [450, 20], [416, 20], [416, 20], [416, 20], [416, 20]]);
    expect(arrivedAt(d)).toBe(-1);
    expect(new Set(d)).toEqual(new Set(['outside']));
  });

  test('jitter across the 100m edge -> never arrives', () => {
    // 95m, 105m alternating: each outside reading resets the count
    const d = run([[-95, 20], [-105, 20], [-95, 20], [-105, 20], [-95, 20], [-105, 20]]);
    expect(arrivedAt(d)).toBe(-1);
  });

  test('poor-accuracy readings inside the lot never count', () => {
    const inLot = at(30, 20);
    let state = { insideCount: 0 };
    for (let i = 0; i < 5; i++) {
      const r = evaluateReading(zone, state, { ...inLot, accuracy: 120, reportedAt: i * INTERVAL_MS });
      expect(r.decision).toBe('ignored-accuracy');
      state = { insideCount: r.insideCount, last: r.last };
    }
    expect(state.insideCount).toBe(0);
  });

  test('mock readings are ignored unless test mode allows them', () => {
    const d = run([[30, 20], [30, 20], [30, 20]], { extra: { isMock: true } });
    expect(new Set(d)).toEqual(new Set(['ignored-mock']));

    const z = { ...zone };
    let state = { insideCount: 0 };
    const p = at(30, 20);
    for (let i = 0; i < 2; i++) {
      const r = evaluateReading(z, state, { ...p, accuracy: 10, isMock: true, reportedAt: i * INTERVAL_MS }, { allowMock: true });
      state = { insideCount: r.insideCount, last: r.last };
    }
    expect(state.insideCount).toBe(2);
  });

  test('an impossible jump is ignored and does not become the speed baseline', () => {
    // 5km in 15s is ~333 m/s; the next sane reading must not be judged against the glitch
    const d = run([[30, 20], [5030, 20], [30, 20], [30, 20]]);
    expect(d[1]).toBe('ignored-implausible');
    expect(arrivedAt(d)).toBe(2); // glitch leaves the count at 1, next sane reading confirms
  });
});
