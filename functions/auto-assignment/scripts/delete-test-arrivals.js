#!/usr/bin/env node
/**
 * Deletes emulator-test CustomerArrivals rows. Customers can't delete arrivals
 * (permissions lockdown), so this uses the dev API key from the repo-root .env.
 * Plain REST: node-appwrite's SDK is broken on Node 26.
 *
 * USAGE: node functions/auto-assignment/scripts/delete-test-arrivals.js <id>... [--yes]
 * Dry run unless --yes. Refuses any row whose vehicleDescription isn't "Emulator check".
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../../../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const args = process.argv.slice(2);
const yes = args.includes('--yes');
const ids = args.filter((a) => !a.startsWith('--'));
if (!env.APPWRITE_API_KEY || ids.length === 0) {
  console.error('Need APPWRITE_API_KEY in .env and at least one arrival id.');
  process.exit(1);
}

const url = (id) =>
  `${env.APPWRITE_ENDPOINT}/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID}/documents/${id}`;
const headers = { 'x-appwrite-project': env.APPWRITE_PROJECT_ID, 'x-appwrite-key': env.APPWRITE_API_KEY };

for (const id of ids) {
  const get = await fetch(url(id), { headers });
  if (!get.ok) { console.log('SKIP', id, 'not readable:', get.status); continue; }
  const doc = await get.json();
  if (doc.vehicleDescription !== 'Emulator check') {
    console.log('REFUSE', id, 'not an emulator test arrival');
    continue;
  }
  if (!yes) { console.log('WOULD DELETE', id, doc.status, 'order', doc.orderID); continue; }
  const del = await fetch(url(id), { method: 'DELETE', headers });
  console.log(del.ok ? 'DELETED' : `FAILED ${del.status}`, id);
}
