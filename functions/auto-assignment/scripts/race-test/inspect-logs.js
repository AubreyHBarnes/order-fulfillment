// Read-only: recent Function executions' logs + claimLock values of the RACE-TEST rows/shoppers.
import { Functions, Query } from 'node-appwrite';
import { db, env, DB, ORDERS, SHOPPERS } from './env.js';
import { Client } from 'node-appwrite';
const fns = new Functions(new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY));
const ex = await fns.listExecutions({ functionId: 'auto-assignment', queries: [Query.orderDesc('$createdAt'), Query.limit(8)] });
for (const e of ex.executions.reverse()) console.log(`--- ${e.$createdAt} ${e.trigger} ${e.status} ${e.requestPath}\n${e.logs}\n${e.errors}`);
const o = await db.listRows(DB, ORDERS, [Query.equal('deliveryNotes', 'RACE-TEST')]);
o.rows.forEach((r) => console.log('order', r.$id, r.status, 'claimLock=', r.claimLock));
const s = await db.listRows(DB, SHOPPERS, [Query.limit(20)]);
s.rows.forEach((r) => console.log('shopper', r.shopperID, 'cur=', r.currentOrderId, 'claimLock=', r.claimLock));
