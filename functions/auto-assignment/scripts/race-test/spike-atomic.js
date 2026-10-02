// Which Appwrite primitives are actually atomic under concurrency?
// Runs entirely in a throwaway table (created and deleted here); touches
// no app data.
//
//   A. Does a read inside a transaction count toward its conflict check?
//   B. Two transactions each stage "increment lock, max 1" - does the
//      second commit fail?
//   C. 10 concurrent plain incrementRowColumn(max 1) - exactly 1 winner?
//   D. 10 concurrent createRow with the same custom ID - exactly 1 winner?
import { db, DB, ID, sleep } from './env.js';

const TABLE = 'spike_race_locks';
const N = 10;
const errMsg = (e) => `${e.code ?? ''} ${e.type ?? ''} ${e.message ?? e}`.trim();

async function setup() {
  await db.deleteTable(DB, TABLE).catch(() => {});
  await sleep(2000);
  await db.createTable(DB, TABLE, TABLE);
  await db.createIntegerColumn(DB, TABLE, 'lock', false, 0, 100, 0);
  await db.createIntegerColumn(DB, TABLE, 'v', false, 0, 100, 0);
  for (let i = 0; i < 30; i++) {
    const cols = (await db.listColumns(DB, TABLE)).columns;
    if (cols.length === 2 && cols.every((c) => c.status === 'available')) return;
    await sleep(1000);
  }
  throw new Error('columns never became available');
}

async function testA() {
  const row = await db.createRow(DB, TABLE, ID.unique(), { lock: 0, v: 0 });
  const tx = await db.createTransaction();
  const seen = await db.getRow(DB, TABLE, row.$id, undefined, tx.$id);
  await db.updateRow(DB, TABLE, row.$id, { v: 1 }); // outside write after the read
  await db.updateRow(DB, TABLE, row.$id, { v: seen.v + 10 }, undefined, tx.$id);
  try {
    await db.updateTransaction(tx.$id, true);
    const final = await db.getRow(DB, TABLE, row.$id);
    console.log(`A: commit SUCCEEDED (v=${final.v}) -> reads are NOT conflict-tracked; txns alone don't fix check-then-act`);
  } catch (e) {
    console.log(`A: commit FAILED (${errMsg(e)}) -> a read inside a txn IS conflict-tracked`);
  }
}

async function testB() {
  const row = await db.createRow(DB, TABLE, ID.unique(), { lock: 0, v: 0 });
  const [t1, t2] = await Promise.all([db.createTransaction(), db.createTransaction()]);
  for (const t of [t1, t2]) {
    await db.incrementRowColumn(DB, TABLE, row.$id, 'lock', 1, 1, t.$id);
  }
  const results = await Promise.allSettled([t1, t2].map((t) => db.updateTransaction(t.$id, true)));
  const final = await db.getRow(DB, TABLE, row.$id);
  console.log(`B: commits -> ${results.map((r) => (r.status === 'fulfilled' ? 'ok' : `FAIL(${errMsg(r.reason)})`)).join(' | ')}; final lock=${final.lock}`);
  console.log(final.lock === 1 && results.filter((r) => r.status === 'fulfilled').length === 1
    ? '   -> capped increment inside a txn is a safe lock'
    : '   -> NOT safe');
}

async function testC() {
  const row = await db.createRow(DB, TABLE, ID.unique(), { lock: 0, v: 0 });
  const results = await Promise.allSettled(
    Array.from({ length: N }, () => db.incrementRowColumn(DB, TABLE, row.$id, 'lock', 1, 1))
  );
  const wins = results.filter((r) => r.status === 'fulfilled').length;
  const final = await db.getRow(DB, TABLE, row.$id);
  const firstErr = results.find((r) => r.status === 'rejected');
  console.log(`C: ${wins}/${N} succeeded, final lock=${final.lock}${firstErr ? `, loser error: ${errMsg(firstErr.reason)}` : ''}`);
}

async function testD() {
  const id = `lock_${Date.now()}`;
  const results = await Promise.allSettled(
    Array.from({ length: N }, () => db.createRow(DB, TABLE, id, { lock: 1 }))
  );
  const wins = results.filter((r) => r.status === 'fulfilled').length;
  const firstErr = results.find((r) => r.status === 'rejected');
  console.log(`D: ${wins}/${N} succeeded${firstErr ? `, loser error: ${errMsg(firstErr.reason)}` : ''}`);
}

try {
  await setup();
  for (const [name, t] of [['A', testA], ['B', testB], ['C', testC], ['D', testD]]) {
    try { await t(); } catch (e) { console.log(`${name}: errored - ${errMsg(e)}`); }
  }
} finally {
  await db.deleteTable(DB, TABLE).catch((e) => console.log(`cleanup failed: ${errMsg(e)}`));
  console.log('throwaway table deleted');
}
