// A fully commits, THEN B stages+commits the same capped increment. Throwaway table.
import { db, DB, ID, sleep } from './env.js';
const T = 'spike_sequential';
const err = (e) => `${e.code ?? ''} ${e.type ?? ''}`.trim();
await db.deleteTable(DB, T).catch(() => {});
await sleep(2000);
await db.createTable(DB, T, T);
await db.createIntegerColumn(DB, T, 'lock', false, 0, 100, 0);
for (let i = 0; i < 30; i++) {
  const c = (await db.listColumns(DB, T)).columns;
  if (c.length === 1 && c[0].status === 'available') break;
  await sleep(1000);
}
try {
  const row = await db.createRow(DB, T, ID.unique(), { lock: 0 });
  const attempt = async (name, gap) => {
    const tx = await db.createTransaction();
    try {
      await db.incrementRowColumn(DB, T, row.$id, 'lock', 1, 1, tx.$id);
      await sleep(gap);
      await db.updateTransaction(tx.$id, true);
      return `${name}: committed`;
    } catch (e) {
      await db.updateTransaction(tx.$id, false, true).catch(() => {});
      return `${name}: refused (${err(e)})`;
    }
  };
  console.log(await attempt('A', 0));
  console.log(await attempt('B (after A committed)', 0));
  // B stages BEFORE A commits, commits AFTER: stage-time vs commit-time check
  const row2 = await db.createRow(DB, T, ID.unique(), { lock: 0 });
  const t1 = await db.createTransaction(), t2 = await db.createTransaction();
  await db.incrementRowColumn(DB, T, row2.$id, 'lock', 1, 1, t1.$id);
  await db.incrementRowColumn(DB, T, row2.$id, 'lock', 1, 1, t2.$id);
  await db.updateTransaction(t1.$id, true);
  await sleep(500);
  try { await db.updateTransaction(t2.$id, true); console.log('staged-both, commit t1 then t2 (500ms later): both committed'); }
  catch (e) { console.log(`staged-both, commit t1 then t2: t2 refused (${err(e)})`); }
  console.log('row1 lock=', (await db.getRow(DB, T, row.$id)).lock, ' row2 lock=', (await db.getRow(DB, T, row2.$id)).lock);
} finally {
  await db.deleteTable(DB, T).catch(() => {});
}
