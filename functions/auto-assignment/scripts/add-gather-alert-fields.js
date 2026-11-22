#!/usr/bin/env node
/**
 * One-time migration: gather-alert (ETA) columns.
 * File: functions/auto-assignment/scripts/add-gather-alert-fields.js
 *
 * CustomerTrips gets the ETA state reportLocation tracks between readings:
 *   smoothedSpeed (float, m/s), etaDistance (float, m), etaUnderCount (integer, default 0),
 *   gatherAlertAt (datetime, set once when the alert fires).
 * Orders gets gatherAlertAt (datetime): the shopper-visible half of the alert, a timestamp
 * with no location in it. See docs/DECISIONS.md, "Gather alert by ETA".
 *
 * All optional, no backfill: rows that predate a column read as null and the Function
 * handles that with `??`. Safe to re-run; an existing column is left alone.
 *
 * Run it BEFORE deploying the Function version that writes these columns - writing an
 * unknown column fails the whole reportLocation call, which would break proximity check-in.
 *
 * USAGE: node functions/auto-assignment/scripts/add-gather-alert-fields.js
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv(join(REPO_ROOT, '.env'));
const DB = env.APPWRITE_DATABASE_ID;
const TRIPS = env.APPWRITE_CUSTOMER_TRIPS_COLLECTION_ID;
const ORDERS = env.APPWRITE_ORDERS_COLLECTION_ID;

// Plain REST via global fetch, not the SDK: node-appwrite's HTTP layer fails on Node 26
// ("invalid onError method"), and these are four simple calls.
async function api(method, path, body) {
  const res = await fetch(`${env.APPWRITE_ENDPOINT}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-appwrite-project': env.APPWRITE_PROJECT_ID,
      'x-appwrite-key': env.APPWRITE_API_KEY,
    },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${json.message}`);
  return json;
}
const col = (tableId, type) => `/tablesdb/${DB}/tables/${tableId}/columns/${type}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PLAN = [
  [TRIPS, 'smoothedSpeed', () => api('POST', col(TRIPS, 'float'), { key: 'smoothedSpeed', required: false })],
  [TRIPS, 'etaDistance', () => api('POST', col(TRIPS, 'float'), { key: 'etaDistance', required: false })],
  [TRIPS, 'etaUnderCount', () => api('POST', col(TRIPS, 'integer'), { key: 'etaUnderCount', required: false, min: 0, max: 1000, default: 0 })],
  [TRIPS, 'gatherAlertAt', () => api('POST', col(TRIPS, 'datetime'), { key: 'gatherAlertAt', required: false })],
  [ORDERS, 'gatherAlertAt', () => api('POST', col(ORDERS, 'datetime'), { key: 'gatherAlertAt', required: false })],
];

const find = async (tableId, key) =>
  (await api('GET', `/tablesdb/${DB}/tables/${tableId}/columns`)).columns.find((c) => c.key === key);

for (const [tableId, key, create] of PLAN) {
  if (await find(tableId, key)) {
    console.log(`${tableId}.${key}: already exists`);
  } else {
    await create();
    console.log(`${tableId}.${key}: created`);
  }
}

// Columns build asynchronously; writes fail until each reports 'available'.
for (const [tableId, key] of PLAN) {
  for (let i = 0; ; i++) {
    if (i === 60) throw new Error(`${tableId}.${key} never became available`);
    if ((await find(tableId, key))?.status === 'available') break;
    await sleep(1000);
  }
  console.log(`${tableId}.${key}: available`);
}
console.log('Done.');
