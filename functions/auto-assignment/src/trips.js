/**
 * Proximity check-in actions: startTrip / reportLocation / endTrip, plus the
 * helpers main.js calls on hand-off completion and from the cron sweep.
 * The phone only reports location; zone.js decides arrival and this file
 * creates the CustomerArrival, so the existing targeted hand-off runs
 * unchanged. Design: docs/DECISIONS.md's "Proximity check-in and the staff
 * lot map". DRAFT - needs the PickupZones/CustomerTrips tables and the
 * `shoppers` Team before it can run live.
 *
 * Time used for speed/staleness is the server's receive time, not the
 * client's clock. ponytail: a phone that batches readings while offline will
 * look faster/slower than it was; add a client timestamp sanity check if
 * that shows up in field tests.
 */
import { ID, Permission, Query, Role } from 'node-appwrite';
import { DEFAULT_ZONE_RULES, evaluateReading } from './zone.js';

// `env` alias: the app's babel dotenv plugin would inline `process.env.X` reads under Jest
const env = process.env;
const IDS = {
  db: env.APPWRITE_DATABASE_ID,
  orders: env.APPWRITE_ORDERS_COLLECTION_ID,
  arrivals: env.APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID,
  zones: env.APPWRITE_PICKUP_ZONES_COLLECTION_ID,
  trips: env.APPWRITE_CUSTOMER_TRIPS_COLLECTION_ID,
};
const SHOPPERS_TEAM_ID = 'shoppers';
// Test-mode switch: lets mocked locations count (route replay on a real phone). Off for real trips.
const ALLOW_MOCK = env.PROXIMITY_ALLOW_MOCK === 'true';
const TRIP_IDLE_EXPIRY_MS = 15 * 60 * 1000;
const TERMINAL_ORDER_STATUSES = ['completed', 'cancelled'];
const ACTIVE_ARRIVAL_STATUSES = ['waiting', 'notified', 'in_progress'];

const fail = (status, error) => ({ status, body: { ok: false, error } });

async function loadOwnedTrip(databases, caller, tripId) {
  const trip = await databases.getDocument(IDS.db, IDS.trips, tripId).catch(() => null);
  if (!trip) return { error: fail(404, 'Trip not found') };
  if (trip.customerID !== caller.$id) return { error: fail(403, 'This trip is not yours') };
  return { trip };
}

async function loadZone(databases) {
  const res = await databases.listDocuments(IDS.db, IDS.zones, [Query.limit(1)]);
  const doc = res.documents[0];
  if (!doc) return null;
  return { ...DEFAULT_ZONE_RULES, ...doc, polygon: JSON.parse(doc.polygon) };
}

/** startTrip - customer opts in to sharing location for one pickup order. */
export async function handleStartTrip(databases, caller, payload, log) {
  const { orderId } = payload;
  if (!orderId) return fail(400, 'orderId is required');

  const order = await databases.getDocument(IDS.db, IDS.orders, orderId).catch(() => null);
  if (!order) return fail(404, 'Order not found');
  if (order.customerID !== caller.$id) return fail(403, 'This order is not yours');
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) return fail(409, 'Order is already finished');

  const existing = await databases.listDocuments(IDS.db, IDS.trips, [
    Query.equal('orderID', orderId),
    Query.equal('status', ['active', 'arrived']),
    Query.limit(1),
  ]);
  if (existing.documents.length > 0) return fail(409, 'A trip is already active for this order');

  // Owner-only read until arrival: a shopper cannot fetch an approaching customer's location.
  const trip = await databases.createDocument(
    IDS.db,
    IDS.trips,
    ID.unique(),
    {
      orderID: orderId,
      customerID: caller.$id,
      status: 'active',
      insideCount: 0,
      startedAt: new Date().toISOString(),
    },
    [Permission.read(Role.user(caller.$id))]
  );
  log(`startTrip: ${trip.$id} for order ${orderId}`);
  return { status: 200, body: { ok: true, tripId: trip.$id } };
}

/** The server creates the arrival itself - same shape as arrivalService.recordArrival. */
async function createArrivalOnce(databases, trip, nowIso) {
  const existing = await databases.listDocuments(IDS.db, IDS.arrivals, [
    Query.equal('orderID', trip.orderID),
    Query.equal('status', ACTIVE_ARRIVAL_STATUSES),
    Query.limit(1),
  ]);
  if (existing.documents.length > 0) return existing.documents[0]; // manual tap beat us to it
  return databases.createDocument(IDS.db, IDS.arrivals, ID.unique(), {
    orderID: trip.orderID,
    customerID: trip.customerID,
    arrivedAt: nowIso,
    notifiedShopperAt: nowIso,
    status: 'waiting',
    parkingSpot: 1,
    vehicleDescription: '',
    notes: 'Auto check-in (arrived at pickup area)',
  });
}

/** reportLocation - one reading in, one decision out. Arrival is concluded here, never by the client. */
export async function handleReportLocation(databases, caller, payload, log) {
  const { tripId, lat, lng, accuracy, speed, isMock } = payload;
  if (!tripId || ![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return fail(400, 'tripId, lat, lng and accuracy are required');
  }
  const { trip, error } = await loadOwnedTrip(databases, caller, tripId);
  if (error) return error;
  if (!['active', 'arrived'].includes(trip.status)) return fail(409, 'Trip is no longer active');

  const zone = await loadZone(databases);
  if (!zone) return fail(503, 'No pickup zone is configured');

  const now = Date.now();
  const state = {
    insideCount: trip.insideCount ?? 0,
    last: trip.lat == null ? undefined : { lat: trip.lat, lng: trip.lng, reportedAt: Date.parse(trip.reportedAt) },
  };
  const result = evaluateReading(
    zone,
    state,
    { lat, lng, accuracy, speed: Number.isFinite(speed) ? speed : undefined, isMock: !!isMock, reportedAt: now },
    { allowMock: ALLOW_MOCK }
  );
  log(`reportLocation ${tripId}: ${result.decision} dist=${Math.round(result.distanceMeters)}m count=${result.insideCount}`);

  const update = {
    insideCount: result.insideCount,
    distanceMeters: Math.round(result.distanceMeters),
  };
  if (result.last && result.last.reportedAt === now) {
    // only trusted fixes move the pin; ignored ones keep the previous position
    Object.assign(update, { lat: lat, lng: lng, accuracy, reportedAt: new Date(now).toISOString() });
  }

  // Already arrived: keep the pin current for the staff map, nothing else to decide.
  if (trip.status === 'arrived' || !result.arrived) {
    await databases.updateDocument(IDS.db, IDS.trips, trip.$id, update);
    return { status: 200, body: { ok: true, decision: result.decision, distanceMeters: update.distanceMeters, arrived: trip.status === 'arrived' } };
  }

  // Arrival: create the arrival first (guarded against duplicates), then flip the trip and open
  // it to shoppers. If the trip write fails, the next reading re-concludes arrival harmlessly.
  const nowIso = new Date(now).toISOString();
  await createArrivalOnce(databases, trip, nowIso);
  await databases.updateDocument(
    IDS.db,
    IDS.trips,
    trip.$id,
    { ...update, status: 'arrived', arrivedAt: nowIso },
    [Permission.read(Role.user(trip.customerID)), Permission.read(Role.team(SHOPPERS_TEAM_ID))]
  );
  log(`reportLocation ${tripId}: ARRIVED, arrival created for order ${trip.orderID}`);
  return { status: 200, body: { ok: true, decision: 'arrived', distanceMeters: update.distanceMeters, arrived: true } };
}

/** endTrip - customer stops sharing ("I'm not coming now"). */
export async function handleEndTrip(databases, caller, payload, log) {
  if (!payload.tripId) return fail(400, 'tripId is required');
  const { trip, error } = await loadOwnedTrip(databases, caller, payload.tripId);
  if (error) return error;
  if (['active', 'arrived'].includes(trip.status)) {
    await databases.updateDocument(IDS.db, IDS.trips, trip.$id, { status: 'ended' });
    log(`endTrip: ${trip.$id}`);
  }
  return { status: 200, body: { ok: true } };
}

/** Server-side end, called when a hand-off completes - the trip has served its purpose. */
export async function endTripsForOrder(databases, orderId, log) {
  if (!IDS.trips) return; // tables not provisioned yet
  const res = await databases.listDocuments(IDS.db, IDS.trips, [
    Query.equal('orderID', orderId),
    Query.equal('status', ['active', 'arrived']),
  ]);
  for (const trip of res.documents) {
    await databases.updateDocument(IDS.db, IDS.trips, trip.$id, { status: 'ended' });
    log(`endTripsForOrder: ${trip.$id} ended with order ${orderId}`);
  }
}

/** Cron sweep: a forgotten trip can't track indefinitely. */
export async function expireStaleTrips(databases, log) {
  if (!IDS.trips) return;
  const cutoff = new Date(Date.now() - TRIP_IDLE_EXPIRY_MS).toISOString();
  const res = await databases.listDocuments(IDS.db, IDS.trips, [
    Query.equal('status', ['active', 'arrived']),
    Query.lessThan('$updatedAt', cutoff),
    Query.limit(100),
  ]);
  for (const trip of res.documents) {
    await databases.updateDocument(IDS.db, IDS.trips, trip.$id, { status: 'expired' });
    log(`expireStaleTrips: ${trip.$id} expired`);
  }
}
