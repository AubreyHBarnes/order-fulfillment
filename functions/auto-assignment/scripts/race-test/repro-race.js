// Reproduce race #1 (event path): with exactly ONE idle, available
// shopper, create two pending orders at the same instant. Each create
// fires its own Function execution; both ask "who's idle longest?"
// before either writes, so both may pick the same shopper.
//
//   node functions/auto-assignment/scripts/race-test/repro-race.js          run the test
//   node functions/auto-assignment/scripts/race-test/repro-race.js cleanup  cancel RACE-TEST orders, free the shopper
import { db, DB, ORDERS, SHOPPERS, Query, ID, sleep } from './env.js';

const TAG = 'RACE-TEST';

async function idleShoppers() {
  const res = await db.listRows(DB, SHOPPERS, [
    Query.equal('isAvailable', true),
    Query.equal('currentOrderId', ''),
    Query.limit(50),
  ]);
  return res.rows;
}

async function cleanup() {
  const tests = await db.listRows(DB, ORDERS, [Query.equal('deliveryNotes', TAG), Query.limit(100)]);
  const shopperIds = new Set();
  for (const o of tests.rows) {
    if (o.shopperID) shopperIds.add(o.shopperID);
    if (o.status !== 'cancelled') {
      await db.updateRow(DB, ORDERS, o.$id, { status: 'cancelled', shopperID: '' });
      console.log(`cancelled ${o.$id}`);
    }
  }
  for (const shopperId of shopperIds) {
    const s = (await db.listRows(DB, SHOPPERS, [Query.equal('shopperID', shopperId), Query.limit(1)])).rows[0];
    if (s && s.currentOrderId && tests.rows.some((o) => o.$id === s.currentOrderId)) {
      await db.updateRow(DB, SHOPPERS, s.$id, { currentOrderId: '' });
      console.log(`freed shopper ${shopperId}`);
    }
  }
}

async function run() {
  const idle = await idleShoppers();
  if (idle.length !== 1) {
    console.log(`Need exactly 1 idle+available shopper, found ${idle.length}:`);
    idle.forEach((s) => console.log('  ', s.shopperID));
    console.log('Set the others Unavailable (or one Available) in the app, then re-run.');
    process.exit(1);
  }
  const pending = await db.listRows(DB, ORDERS, [Query.equal('status', 'pending'), Query.limit(1)]);
  if (pending.total > 0) {
    console.log('There are already pending orders; the idle shopper would grab those. Clear them first.');
    process.exit(1);
  }
  const shopper = idle[0];
  // Borrow customer and items from the most recent real order.
  const template = (await db.listRows(DB, ORDERS, [Query.orderDesc('$createdAt'), Query.limit(1)])).rows[0];
  const now = Date.now();
  const make = (offsetMin) => ({
    customerID: template.customerID,
    shopperID: '',
    status: 'pending',
    items: template.items,
    totalAmount: template.totalAmount,
    deliveryAddress: 'PICKUP: race test',
    deliveryNotes: TAG,
    autoAssigned: false,
    priority: 0,
    orderDate: new Date(now).toISOString(),
    scheduledReadyTime: new Date(now + offsetMin * 60000).toISOString(),
    pickedItems: '',
  });

  console.log(`Idle shopper: ${shopper.shopperID}. Creating 2 orders at once...`);
  const [a, b] = await Promise.all([
    db.createRow(DB, ORDERS, ID.unique(), make(60)),
    db.createRow(DB, ORDERS, ID.unique(), make(61)),
  ]);
  console.log('Waiting 15s for the Function to run...');
  await sleep(15000);

  const after = await Promise.all([a, b].map((o) => db.getRow(DB, ORDERS, o.$id)));
  const s = (await db.listRows(DB, SHOPPERS, [Query.equal('shopperID', shopper.shopperID), Query.limit(1)])).rows[0];
  after.forEach((o) => console.log(`order ${o.$id}: status=${o.status} shopper=${o.shopperID || '-'}`));
  console.log(`shopper.currentOrderId = ${s.currentOrderId || '-'}`);

  const assignedToShopper = after.filter((o) => o.shopperID === shopper.shopperID).length;
  if (assignedToShopper === 2) {
    const orphan = after.find((o) => o.$id !== s.currentOrderId);
    console.log(`\nRACE REPRODUCED: both orders assigned to one shopper; order ${orphan.$id} is orphaned.`);
  } else if (assignedToShopper === 1) {
    console.log('\nNo race this run (one assigned, one pending). Run cleanup and try again a few times.');
  } else {
    console.log('\nUnexpected: neither order was assigned. Check the Function execution logs.');
  }
  console.log('Run "node functions/auto-assignment/scripts/race-test/repro-race.js cleanup" afterwards.');
}

await (process.argv[2] === 'cleanup' ? cleanup() : run());
