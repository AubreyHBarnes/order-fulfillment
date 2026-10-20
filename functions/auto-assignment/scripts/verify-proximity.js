#!/usr/bin/env node
// Live check of startTrip / reportLocation / endTrip as the test customer (session -> JWT -> Function).
// USAGE: node functions/auto-assignment/scripts/verify-proximity.js
// Needs a non-finished order for rush.tester@example.com. Deletes the trip and the auto arrival it creates.
import { Client, Users, Account, Functions, TablesDB } from 'node-appwrite';
import { db, DB, ORDERS, env, Query, sleep } from './race-test/env.js';

const TRIPS = env.APPWRITE_CUSTOMER_TRIPS_COLLECTION_ID;
const ZONES = env.APPWRITE_PICKUP_ZONES_COLLECTION_ID;
const ARRIVALS = env.APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID;
const server = new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
const users = new Users(server);
const asUser = async (email) => {
  const user = (await users.list([Query.equal('email', email)])).users[0];
  if (!user) throw new Error(`no account ${email}`);
  const c = new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setSession((await users.createSession(user.$id)).secret);
  return { user, client: c, tables: new TablesDB(c) };
};

const customer = await asUser('rush.tester@example.com');
const shopper = await asUser('shopper.tester@example.com');
const call = async (action, payload) => {
  const jwt = (await new Account(customer.client).createJWT()).jwt;
  const ex = await new Functions(customer.client).createExecution({ functionId: 'auto-assignment', body: JSON.stringify({ action, jwt, ...payload }), async: false });
  const body = JSON.parse(ex.responseBody || '{}');
  return { http: ex.responseStatusCode, ...body };
};

// zone centre -> points due north of it, so "N metres out" is simple arithmetic (polygon is ~12 m wide, so ~N m from its edge)
const zone = (await db.listRows(DB, ZONES, [Query.limit(1)])).rows[0];
if (!zone) throw new Error('no pickup zone row');
const ring = JSON.parse(zone.polygon);
const cLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
const cLng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
const north = (m) => cLat + m / 111320;

const order = (await db.listRows(DB, ORDERS, [Query.equal('customerID', customer.user.$id), Query.limit(50)])).rows
  .find((o) => !['completed', 'cancelled'].includes(o.status));
if (!order) throw new Error('rush.tester has no unfinished order - place one in the app first');
console.log('order', order.$id.slice(-8), 'status', order.status, '| zone buffer', zone.bufferMeters ?? 100, 'm\n');

let tripId;
const started = new Date().toISOString();
try {
  const s = await call('startTrip', { orderId: order.$id });
  console.log('startTrip:', s.http, s.ok ? 'ok' : s.error);
  tripId = s.tripId;
  if (!tripId) throw new Error('no tripId');

  const asShopper = async () => shopper.tables.getRow(DB, TRIPS, tripId).then(() => 'READABLE', () => 'hidden');
  console.log('shopper can see trip before arrival:', await asShopper(), '(expected hidden)\n');

  // [metres north of zone, speed m/s, expectation]
  const route = [
    [400, 12, 'outside'],
    [250, 12, 'outside'],
    [150, 10, 'outside (beyond the 100 m buffer)'],
    [90, 15, 'ignored-speed (inside buffer but driving past)'],
    [60, 3, 'inside, count 1'],
    [40, 2, 'arrived'],
  ];
  for (const [m, speed, expect] of route) {
    await sleep(4500); // keeps implied speed between fixes plausible
    const r = await call('reportLocation', { tripId, lat: north(m), lng: cLng, accuracy: 10, speed, isMock: false });
    console.log(`${String(m).padStart(4)} m  ${r.http}  decision=${r.decision ?? r.error}  dist=${r.distanceMeters}  arrived=${r.arrived}   <- expected ${expect}`);
  }

  await sleep(1500);
  console.log('\nshopper can see trip after arrival:', await asShopper(), '(expected READABLE)');
  const arrival = (await db.listRows(DB, ARRIVALS, [Query.equal('orderID', order.$id), Query.limit(5)])).rows.filter((a) => a.arrivedAt >= started);
  console.log('CustomerArrival rows created:', arrival.length, arrival[0] ? `(${arrival[0].status}, ${arrival[0].notes})` : '');
} finally {
  if (tripId) await db.deleteRow(DB, TRIPS, tripId).catch((e) => console.log('trip cleanup failed', e.message));
  const stale = (await db.listRows(DB, ARRIVALS, [Query.equal('orderID', order.$id), Query.limit(10)])).rows.filter((a) => a.arrivedAt >= started);
  for (const a of stale) await db.deleteRow(DB, ARRIVALS, a.$id).catch(() => {});
  console.log('cleaned up trip +', stale.length, 'arrival row(s)');
}
