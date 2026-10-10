// Mirrors assign(): per transaction, capped-increment two locks AND updateRow the same rows.
// Two such transactions race for one shopper. Throwaway table; touches no app data.
import { db, DB, ID, sleep } from './env.js';
const T = 'spike_assign_shape';
const err = (e) => `${e.code ?? ''} ${e.type ?? ''}`.trim();
await db.deleteTable(DB, T).catch(() => {});
await sleep(2000);
await db.createTable(DB, T, T);
await db.createIntegerColumn(DB, T, 'lock', false, 0, 100, 0);
await db.createStringColumn(DB, T, 'cur', 64, false, '');
for (let i = 0; i < 30; i++) {
  const c = (await db.listColumns(DB, T)).columns;
  if (c.length === 2 && c.every((x) => x.status === 'available')) break;
  await sleep(1000);
}
try {
  for (const withUpdate of [false, true]) {
    const shopper = await db.createRow(DB, T, ID.unique(), { lock: 0, cur: '' });
    const attempt = async (name) => {
      const tx = await db.createTransaction();
      try {
        await db.incrementRowColumn(DB, T, shopper.$id, 'lock', 1, 1, tx.$id);
        if (withUpdate) await db.updateRow(DB, T, shopper.$id, { cur: name }, undefined, tx.$id);
        await db.updateTransaction(tx.$id, true);
        return `${name}: committed`;
      } catch (e) {
        await db.updateTransaction(tx.$id, false, true).catch(() => {});
        return `${name}: refused (${err(e)})`;
      }
    };
    const out = await Promise.all([attempt('A'), attempt('B')]);
    const f = await db.getRow(DB, T, shopper.$id);
    console.log(`withUpdate=${withUpdate}: ${out.join(' | ')} -> lock=${f.lock} cur=${f.cur}`);
  }
} finally {
  await db.deleteTable(DB, T).catch(() => {});
}
