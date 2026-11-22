/**
 * Pickup-zone arrival decision - pure math, no Appwrite, so it can be unit
 * tested (__tests__/zone.test.js) and imported by the Function unchanged.
 * See docs/DECISIONS.md's "Proximity check-in and the staff lot map".
 *
 * A zone is { polygon: [[lng, lat], ...], bufferMeters, minAccuracyMeters,
 * requiredInsideReadings, maxQualifyingSpeedMps, maxPlausibleSpeedMps }.
 * A reading is { lat, lng, accuracy, speed?, isMock?, reportedAt (ms) }.
 * Trip state is { insideCount, last?: { lat, lng, reportedAt } }.
 */

const EARTH_RADIUS_M = 6371000;

// Local flat projection (meters east/north of the ring's first vertex).
// Equirectangular is exact enough over a lot-sized area; no library needed.
function projector(originLat, originLng) {
  const cosLat = Math.cos((originLat * Math.PI) / 180);
  return (lat, lng) => [
    ((lng - originLng) * Math.PI * EARTH_RADIUS_M * cosLat) / 180,
    ((lat - originLat) * Math.PI * EARTH_RADIUS_M) / 180,
  ];
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Meters from a point to the zone: 0 inside the polygon, else distance to its nearest edge. */
export function distanceToZoneMeters(lat, lng, polygon) {
  const [originLng, originLat] = polygon[0];
  const project = projector(originLat, originLng);
  const ring = polygon.map(([pLng, pLat]) => project(pLat, pLng));
  const p = project(lat, lng);
  if (pointInRing(p, ring)) return 0;
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    min = Math.min(min, distanceToSegment(p, ring[j], ring[i]));
  }
  return min;
}

/** Straight-line meters between two lat/lng points (haversine). */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Decide what one reading means. Returns { decision, insideCount, distanceMeters, arrived, last }
 * - the caller persists insideCount/last and acts on arrived. decision is one of:
 * ignored-mock, ignored-implausible, ignored-accuracy, ignored-speed, outside, inside, arrived.
 * Ignored readings never change insideCount; an outside reading resets it to 0.
 *
 * allowMock is the test-mode switch (replaying routes on a real phone); off for real trips.
 * ponytail: a car stopped at a light inside the buffer still counts as "inside" (speed 0
 * passes the speed gate) - shrink bufferMeters or draw the polygon tight to the lot if
 * that bites; see the red-light tests.
 */
export function evaluateReading(zone, state, reading, { allowMock = false } = {}) {
  const prev = state.last;
  const last = { lat: reading.lat, lng: reading.lng, reportedAt: reading.reportedAt };
  const distance = distanceToZoneMeters(reading.lat, reading.lng, zone.polygon);
  // Prefer the device's own speed; fall back to displacement over time.
  let speed = reading.speed;
  if (speed == null && prev && reading.reportedAt > prev.reportedAt) {
    speed =
      distanceMeters(prev.lat, prev.lng, reading.lat, reading.lng) /
      ((reading.reportedAt - prev.reportedAt) / 1000);
  }
  const keep = (decision) => ({
    decision,
    insideCount: state.insideCount,
    distanceMeters: distance,
    speed,
    arrived: false,
    // untrustworthy fixes must not become the baseline for the next speed estimate
    last: ['ignored-mock', 'ignored-implausible', 'ignored-accuracy'].includes(decision) ? prev : last,
  });

  if (reading.isMock && !allowMock) return keep('ignored-mock');

  if (speed != null && speed > zone.maxPlausibleSpeedMps) return keep('ignored-implausible');
  if (reading.accuracy > zone.minAccuracyMeters) return keep('ignored-accuracy');
  if (distance > zone.bufferMeters) {
    return { decision: 'outside', insideCount: 0, distanceMeters: distance, speed, arrived: false, last };
  }
  if (speed != null && speed > zone.maxQualifyingSpeedMps) return keep('ignored-speed');

  const insideCount = state.insideCount + 1;
  const arrived = insideCount >= zone.requiredInsideReadings;
  return {
    decision: arrived ? 'arrived' : 'inside',
    insideCount,
    distanceMeters: distance,
    speed,
    arrived,
    last,
  };
}

export const DEFAULT_ZONE_RULES = {
  bufferMeters: 100,
  minAccuracyMeters: 50,
  requiredInsideReadings: 2,
  maxQualifyingSpeedMps: 8,
  maxPlausibleSpeedMps: 70,
};

export const DEFAULT_ETA_RULES = {
  etaThresholdSeconds: 90, // alert when the customer is this close in time...
  requiredUnderReadings: 2, // ...for this many consecutive trusted readings (15s apart = ~30s)
  minSpeedMps: 1.5, // slower than a walk-pace crawl has no meaningful ETA (parked, queued, stopped)
  speedSmoothing: 0.5, // weight of the newest speed in the moving average
  minShrinkMeters: 5, // distance must fall by more than GPS jitter to count as approaching
};

/**
 * Gather alert: is the customer about to arrive? Pure like evaluateReading; feed it the
 * result of evaluateReading for the same reading. ETA = distance to the lot / smoothed speed,
 * straight-line (no routing API; measured speed already reflects traffic). The alert fires
 * once, when the ETA stays under the threshold on consecutive readings AND the distance is
 * shrinking (so a car driving past on the road never fires). Arrival itself is unchanged.
 *
 * state: { smoothedSpeed?, prevDistance?, underCount, alerted }
 * returns { fire, etaSeconds (Infinity if no usable speed), state }
 * ponytail: straight-line distance understates a route that bends (highway between stores);
 * swap in a routing API only if real-phone tests show too many early or late alerts.
 */
export function evaluateEta(state, result, rules = DEFAULT_ETA_RULES) {
  // untrusted fixes (mock, bad accuracy, impossible speed) must not move the ETA either way
  if (state.alerted || result.decision.startsWith('ignored-') && result.decision !== 'ignored-speed') {
    return { fire: false, etaSeconds: Infinity, state };
  }
  const smoothedSpeed =
    result.speed == null
      ? state.smoothedSpeed
      : state.smoothedSpeed == null
        ? result.speed
        : rules.speedSmoothing * result.speed + (1 - rules.speedSmoothing) * state.smoothedSpeed;
  const etaSeconds =
    smoothedSpeed != null && smoothedSpeed >= rules.minSpeedMps
      ? result.distanceMeters / smoothedSpeed
      : Infinity;
  const approaching =
    state.prevDistance != null && result.distanceMeters < state.prevDistance - rules.minShrinkMeters;
  const underCount = approaching && etaSeconds <= rules.etaThresholdSeconds ? state.underCount + 1 : 0;
  const fire = underCount >= rules.requiredUnderReadings;
  return {
    fire,
    etaSeconds,
    state: { smoothedSpeed, prevDistance: result.distanceMeters, underCount, alerted: fire },
  };
}
