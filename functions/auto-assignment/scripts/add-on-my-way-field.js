#!/usr/bin/env node
/**
 * One-time migration: Orders.onMyWayAt (datetime), the manual "I'm on my way" heads-up.
 * File: functions/auto-assignment/scripts/add-on-my-way-field.js
 *
 * Optional, no backfill: rows without it read as null. Run BEFORE deploying the Function
 * version that writes it (writing an unknown column fails the call). Safe to re-run.
 * REST via fetch, not node-appwrite (broken on Node 26).
 *
 * USAGE: node functions/auto-assignment/scripts/add-on-my-way-field.js
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
  const t = line.trim();
  const eq = t.indexOf('=');
  if (t && !t.startsWith('#') && eq !== -1) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
const base = `/tablesdb/${env.APPWRITE_DATABASE_ID}/tables/${env.APPWRITE_ORDERS_COLLECTION_ID}/columns`;
async function api(method, path, body) {
  const res = await fetch(`${env.APPWRITE_ENDPOINT}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-appwrite-project': env.APPWRITE_PROJECT_ID, 'x-appwrite-key': env.APPWRITE_API_KEY },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${json.message}`);
  return json;
}
const find = async () => (await api('GET', base)).columns.find((c) => c.key === 'onMyWayAt');

if (await find()) console.log('Orders.onMyWayAt: already exists');
else {
  await api('POST', `${base}/datetime`, { key: 'onMyWayAt', required: false });
  console.log('Orders.onMyWayAt: created');
}
for (let i = 0; (await find())?.status !== 'available'; i++) {
  if (i === 60) throw new Error('Orders.onMyWayAt never became available');
  await new Promise((r) => setTimeout(r, 1000));
}
console.log('Orders.onMyWayAt: available');
