// Row exists BEFORE the lock column is added (like the live rows), then two txns race the capped increment.
import { db, DB, ID, sleep } from './env.js';
const T = 'spike_null';
const err = (e) => `${e.code ?? ''} ${e.type ?? ''}`.trim();
await db.deleteTable(DB, T).catch(() => {});
await sleep(2000);
await db.createTable(DB, T, T);
await db.createStringColumn(DB, T, 'cur', 64, false, '');
for (let i = 0; i < 30; i++) { const c = (await db.listColumns(DB, T)).columns; if (c.length === 1 && c[0].status === 'available') break; await sleep(1000); }
try {
  const row = await db.createRow(DB, T, ID.unique(), { cur: '' });
  await db.createIntegerColumn(DB, T, 'lock', false, 0, 1, 0); // added after the row exists, default 0
  for (let i = 0; i < 30; i++) { const c = (await db.listColumns(DB, T)).columns; if (c.length === 2 && c.every((x) => x.status === 'available')) break; await sleep(1000); }
  console.log('raw lock on pre-existing row:', JSON.stringify((await db.getRow(DB, T, row.$id)).lock));
  const attempt = async (n) => {
    const tx = await db.createTransaction();
    try { await db.incrementRowColumn(DB, T, row.$id, 'lock', 1, 1, tx.$id); await db.updateTransaction(tx.$id, true); return `${n}: committed`; }
    catch (e) { await db.updateTransaction(tx.$id, false, true).catch(() => {}); return `${n}: refused (${err(e)})`; }
  };
  console.log((await Promise.all([attempt('A'), attempt('B')])).join(' | '), '-> lock=', (await db.getRow(DB, T, row.$id)).lock);
  console.log('3rd, sequential:', await attempt('C'));
} finally { await db.deleteTable(DB, T).catch(() => {}); }
