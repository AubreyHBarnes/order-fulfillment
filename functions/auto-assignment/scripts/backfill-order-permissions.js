#!/usr/bin/env node
/**
 * One-time backfill for issue #5 step 4 (docs/DECISIONS.md): rewrites
 * every existing Orders row's permissions to read(customer) +
 * read(team:shoppers) - the same two permissions createOrder now
 * stamps on every new order. Must run before step 5's rowSecurity flip,
 * or every pre-existing order becomes unreadable to everyone (rowSecurity
 * is still false right now, so this write has no behavioural effect yet -
 * row permissions are only enforced once that flips). Idempotent -
 * re-run it safely; a row whose permissions already match exactly is
 * skipped.
 *
 * Also closes a gap independent of the flip: a client-created row with
 * no permissions specified defaults to read/update/delete for its
 * creator (confirmed live by the spike), so every pre-existing order
 * currently lets its own customer update or delete it directly against
 * the database - this backfill removes that too, not just adding the
 * Team read.
 *
 * USAGE: node functions/auto-assignment/scripts/backfill-order-permissions.js
 * Needs the dev key to have tables.write (documents.write) on Orders.
 */
import { Permission, Role } from 'node-appwrite';
import { db, DB, ORDERS, Query } from './race-test/env.js';

const SHOPPERS_TEAM_ID = 'shoppers';
const PAGE_SIZE = 100;

const wantedPermissions = (customerId) => [
  Permission.read(Role.user(customerId)),
  Permission.read(Role.team(SHOPPERS_TEAM_ID)),
];

const samePermissions = (current, wanted) => {
  const a = [...current].sort();
  const b = [...wanted].sort();
  return a.length === b.length && a.every((p, i) => p === b[i]);
};

let cursor;
let updated = 0;
let skipped = 0;
let failed = 0;

for (;;) {
  const queries = [Query.limit(PAGE_SIZE), Query.orderAsc('$id')];
  if (cursor) queries.push(Query.cursorAfter(cursor));

  const { rows } = await db.listRows(DB, ORDERS, queries);
  if (rows.length === 0) break;

  for (const row of rows) {
    if (!row.customerID) {
      console.log('SKIP (no customerID)', row.$id);
      failed++;
      continue;
    }

    const wanted = wantedPermissions(row.customerID);
    if (samePermissions(row.$permissions, wanted)) {
      skipped++;
      continue;
    }

    try {
      await db.updateRow(DB, ORDERS, row.$id, {}, wanted);
      updated++;
      console.log('updated', row.$id);
    } catch (e) {
      failed++;
      console.log('FAILED', row.$id, e.message);
    }
  }

  cursor = rows[rows.length - 1].$id;
  if (rows.length < PAGE_SIZE) break;
}

console.log(`done: ${updated} updated, ${skipped} already correct, ${failed} failed`);
