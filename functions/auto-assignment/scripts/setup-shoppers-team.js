#!/usr/bin/env node
/**
 * One-time setup for issue #5 (docs/DECISIONS.md): creates the `shoppers`
 * Team and adds every account that has a ShopperStatus row to it.
 * Idempotent - re-run it to repair a shopper whose signup-time join missed.
 *
 * USAGE: node functions/auto-assignment/scripts/setup-shoppers-team.js
 * Needs the dev key to have teams.write and users.read.
 */
import { Client, Teams, Query } from 'node-appwrite';
import { db, DB, SHOPPERS, env } from './race-test/env.js';

const teams = new Teams(new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY));
const TEAM = 'shoppers';

try { await teams.create(TEAM, TEAM); console.log('created team'); }
catch (e) { if (e.code !== 409) throw e; console.log('team exists'); }

const { rows } = await db.listRows(DB, SHOPPERS, [Query.limit(500)]);
for (const id of new Set(rows.map((r) => r.shopperID).filter(Boolean))) {
  try { await teams.createMembership(TEAM, ['member'], undefined, id); console.log('added', id); }
  catch (e) { if (e.code !== 409) console.log('FAILED', id, e.message); else console.log('already in', id); }
}
