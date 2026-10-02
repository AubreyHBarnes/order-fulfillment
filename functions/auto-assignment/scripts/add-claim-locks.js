#!/usr/bin/env node
/**
 * One-time migration: claim-lock columns for the auto-assignment Function
 * File: functions/auto-assignment/scripts/add-claim-locks.js
 *
 * Adds `claimLock` (integer 0-1, default 0) to Orders and ShopperStatus,
 * then backfills it from current state so rows that are already held
 * start out locked:
 * - an order in 'assigned'/'shopping' with a shopper -> 1
 * - a shopper whose currentOrderId is set -> 1
 * Every other row keeps the default 0. See src/main.js ("CLAIM LOCKS") and
 * docs/DECISIONS.md's "Race #1 fixed" entry for what the locks do.
 *
 * Safe to re-run: an existing column is left alone, and the backfill only
 * writes rows whose value is wrong.
 *
 * Run it BEFORE deploying the Function version that uses the locks.
 *
 * USAGE: node functions/auto-assignment/scripts/add-claim-locks.js
 */
import { Client, TablesDB, Query } from 'node-appwrite';
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
const ORDERS = env.APPWRITE_ORDERS_COLLECTION_ID;
const SHOPPERS = env.APPWRITE_SHOPPER_STATUS_COLLECTION_ID;

const tables = new TablesDB(
  new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY)
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureColumn(tableId) {
  const existing = (await tables.listColumns(DB, tableId)).columns.find((c) => c.key === 'claimLock');
  if (!existing) {
    await tables.createIntegerColumn(DB, tableId, 'claimLock', false, 0, 1, 0);
    console.log(`${tableId}: claimLock column created`);
  } else {
    console.log(`${tableId}: claimLock column already exists`);
  }
  // Columns are built asynchronously; writes to them fail until ready.
  for (let i = 0; i < 60; i++) {
    const column = (await tables.listColumns(DB, tableId)).columns.find((c) => c.key === 'claimLock');
    if (column?.status === 'available') return;
    await sleep(1000);
  }
  throw new Error(`${tableId}: claimLock column never became available`);
}

async function allRows(tableId) {
  const rows = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await tables.listRows(DB, tableId, queries);
    rows.push(...page.rows);
    if (page.rows.length < 100) return rows;
    cursor = page.rows[page.rows.length - 1].$id;
  }
}

async function backfill(tableId, shouldBeLocked) {
  let changed = 0;
  for (const row of await allRows(tableId)) {
    const want = shouldBeLocked(row) ? 1 : 0;
    if ((row.claimLock ?? 0) !== want) {
      await tables.updateRow(DB, tableId, row.$id, { claimLock: want });
      changed++;
    }
  }
  console.log(`${tableId}: backfilled ${changed} row(s)`);
}

await ensureColumn(ORDERS);
await ensureColumn(SHOPPERS);
await backfill(ORDERS, (o) => (o.status === 'assigned' || o.status === 'shopping') && o.shopperID !== '');
await backfill(SHOPPERS, (s) => s.currentOrderId !== '');
console.log('Done.');
