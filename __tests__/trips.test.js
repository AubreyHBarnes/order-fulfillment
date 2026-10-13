// Drives the trip actions against an in-memory stand-in for Appwrite's `databases`.
// Proves the wiring (ownership checks, arrival creation, permissions, idempotency);
// the live Function against real tables is still to be verified.
// Object.assign: the project's babel dotenv plugin rewrites `process.env.X = ...` assignments
Object.assign(process.env, {
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_ORDERS_COLLECTION_ID: 'orders',
  APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID: 'arrivals',
  APPWRITE_PICKUP_ZONES_COLLECTION_ID: 'zones',
  APPWRITE_CUSTOMER_TRIPS_COLLECTION_ID: 'trips',
});

// node-appwrite drags ESM-only deps into Jest; the handlers only need these four builders.
jest.mock('node-appwrite', () => ({
  ID: { unique: () => 'unique()' },
  Permission: { read: (role) => `read("${role}")` },
  Role: { user: (id) => `user:${id}`, team: (id) => `team:${id}` },
  Query: {
    equal: (attribute, v) => JSON.stringify({ method: 'equal', attribute, values: [].concat(v) }),
    lessThan: (attribute, v) => JSON.stringify({ method: 'lessThan', attribute, values: [v] }),
    limit: (n) => JSON.stringify({ method: 'limit', values: [n] }),
  },
}));

const { handleStartTrip, handleReportLocation, handleEndTrip, endTripsForOrder } = require('../functions/auto-assignment/src/trips.js');

const M_PER_DEG = (Math.PI * 6371000) / 180;
const at = (east, north) => ({ lat: 40 + north / M_PER_DEG, lng: -100 + east / (M_PER_DEG * Math.cos((40 * Math.PI) / 180)) });
const ring = [[0, 0], [60, 0], [60, 40], [0, 40]].map(([e, n]) => [at(e, n).lng, at(e, n).lat]);

function fakeDb(seed) {
  const tables = { orders: {}, arrivals: {}, zones: {}, trips: {}, ...seed };
  let n = 0;
  const matches = (doc, q) => {
    const { method, attribute, values } = JSON.parse(q);
    return method !== 'equal' || values.includes(doc[attribute]);
  };
  return {
    tables,
    getDocument: async (_d, c, id) => {
      if (!tables[c][id]) throw new Error('404');
      return tables[c][id];
    },
    listDocuments: async (_d, c, queries = []) => ({
      documents: Object.values(tables[c]).filter((doc) => queries.every((q) => matches(doc, q))),
    }),
    createDocument: async (_d, c, id, data, perms) => {
      const doc = { $id: id === 'unique()' ? `id${++n}` : id, ...data, $permissions: perms };
      tables[c][doc.$id] = doc;
      return doc;
    },
    updateDocument: async (_d, c, id, data, perms) => {
      Object.assign(tables[c][id], data, perms && { $permissions: perms });
      return tables[c][id];
    },
  };
}

const log = () => {};
const customer = { $id: 'cust1' };
const seed = () => ({
  orders: { o1: { $id: 'o1', customerID: 'cust1', status: 'ready_for_pickup', shopperID: 'shop1' } },
  zones: { z1: { $id: 'z1', polygon: JSON.stringify(ring) } },
});
const report = (db, tripId, east, north, extra = {}) =>
  handleReportLocation(db, customer, { tripId, ...at(east, north), accuracy: 10, ...extra }, log);

test('full trip: start, approach, auto check-in creates one arrival and opens the trip to shoppers', async () => {
  const db = fakeDb(seed());
  const started = await handleStartTrip(db, customer, { orderId: 'o1' }, log);
  const tripId = started.body.tripId;
  expect(db.tables.trips[tripId].$permissions).toEqual(['read("user:cust1")']);

  // two reports back to back are ~0s apart server-side, so the derived speed is huge unless
  // the device supplies its own - which real clients do
  const r1 = await report(db, tripId, -50, 20, { speed: 3 });
  expect(r1.body.decision).toBe('inside');
  expect(Object.keys(db.tables.arrivals)).toHaveLength(0);

  const r2 = await report(db, tripId, -10, 20, { speed: 3 });
  expect(r2.body.arrived).toBe(true);
  const arrivals = Object.values(db.tables.arrivals);
  expect(arrivals).toHaveLength(1);
  expect(arrivals[0]).toMatchObject({ orderID: 'o1', customerID: 'cust1', status: 'waiting' });
  expect(db.tables.trips[tripId].status).toBe('arrived');
  expect(db.tables.trips[tripId].$permissions).toContain('read("team:shoppers")');

  await report(db, tripId, 30, 20, { speed: 0 }); // keeps pin current, no second arrival
  expect(Object.keys(db.tables.arrivals)).toHaveLength(1);
});

test('a manual "I\'ve Arrived" already in flight is not duplicated', async () => {
  const db = fakeDb(seed());
  db.tables.arrivals.a0 = { $id: 'a0', orderID: 'o1', status: 'waiting' };
  const { body } = await handleStartTrip(db, customer, { orderId: 'o1' }, log);
  await report(db, body.tripId, 30, 20, { speed: 0 });
  await report(db, body.tripId, 30, 20, { speed: 0 });
  expect(Object.keys(db.tables.arrivals)).toEqual(['a0']);
});

test("authorization: other customers can't start, report to, or end someone else's trip", async () => {
  const db = fakeDb(seed());
  const other = { $id: 'cust2' };
  expect((await handleStartTrip(db, other, { orderId: 'o1' }, log)).status).toBe(403);
  const { body } = await handleStartTrip(db, customer, { orderId: 'o1' }, log);
  expect((await handleReportLocation(db, other, { tripId: body.tripId, ...at(30, 20), accuracy: 10 }, log)).status).toBe(403);
  expect((await handleEndTrip(db, other, { tripId: body.tripId }, log)).status).toBe(403);
});

test('validation and state: bad coordinates, second trip, ended trip, no zone', async () => {
  const db = fakeDb(seed());
  const { body } = await handleStartTrip(db, customer, { orderId: 'o1' }, log);
  expect((await handleStartTrip(db, customer, { orderId: 'o1' }, log)).status).toBe(409);
  expect((await handleReportLocation(db, customer, { tripId: body.tripId, lat: 'x', lng: 1, accuracy: 5 }, log)).status).toBe(400);
  await handleEndTrip(db, customer, { tripId: body.tripId }, log);
  expect((await report(db, body.tripId, 30, 20)).status).toBe(409);

  const noZone = fakeDb({ ...seed(), zones: {} });
  const t = await handleStartTrip(noZone, customer, { orderId: 'o1' }, log);
  expect((await report(noZone, t.body.tripId, 30, 20)).status).toBe(503);
});

test('endTripsForOrder closes active trips when the hand-off completes', async () => {
  const db = fakeDb(seed());
  const { body } = await handleStartTrip(db, customer, { orderId: 'o1' }, log);
  await endTripsForOrder(db, 'o1', log);
  expect(db.tables.trips[body.tripId].status).toBe('ended');
});
