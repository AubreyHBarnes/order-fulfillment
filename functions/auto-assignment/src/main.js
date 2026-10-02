/**
 * Auto-Assignment Function
 * File: functions/auto-assignment/src/main.js
 *
 * PURPOSE: Server-side replacement for the client-side assignment logic
 * described in docs/DECISIONS.md ("Auto-assignment as a serverless
 * function: what it is, what's here today, and what actually needs to
 * change"). Read that entry first - this file is the implementation of
 * the plan documented there, and every function below is named to match
 * its client-side predecessor in shopperStatusService.ts/orderService.ts
 * one-for-one, so the two can be diffed side by side. Also owns the
 * arrival hand-off timeout/reassignment mechanism (docs/DECISIONS.md's
 * arrival hand-off entry) - a distinct feature, but one that reuses this
 * function's existing "find the next idle shopper" helper and shares its
 * deploy/scope, rather than standing up a second function for it.
 *
 * WHY ONE FUNCTION WITH THREE EVENTS (PLUS A SCHEDULE) INSTEAD OF
 * SEPARATE FUNCTIONS?
 * All of it feeds the same underlying question - "does some order need
 * a shopper (or a hand-off), and does some shopper need one, right
 * now?" - and shares every helper below (getNextAvailableShopper,
 * assign, release, reassignStuckArrival). Separate functions would just
 * mean copies of the same helpers with no benefit; Appwrite functions
 * are billed/scaled per function, not per trigger, so splitting them
 * buys nothing here.
 *
 * TRIGGERS THIS FUNCTION IS DEPLOYED WITH (see scripts/deploy.js):
 * 1. databases.{db}.collections.{orders}.documents.*.create
 * 2. databases.{db}.collections.{orders}.documents.*.update
 * 3. databases.{db}.collections.{shopperStatus}.documents.*.update
 * 4. a schedule (cron `* * * * *`, i.e. every minute - the finest
 *    granularity standard cron supports) for the arrival-timeout sweep
 *
 * WHY NO INFINITE-LOOP GUARD NEEDED, EVEN THOUGH THIS FUNCTION'S OWN
 * WRITES RE-TRIGGER ITS OWN EVENTS?
 * Every event-driven branch below only acts on documents in a specific
 * *transient* state (a pending+unassigned order, an available+idle
 * shopper, a ready_for_pickup order that just lost its shopper), and
 * every write this function makes moves the document OUT of that state
 * (assigning sets status:'assigned' or a non-empty shopperID; clearing
 * currentOrderId sets it to a non-empty value). The next event this
 * function's own write produces is checked against the same condition
 * and no longer matches, so each chain terminates on its own - see the
 * docstring on each handler below for the specific state transition
 * that stops it. The schedule trigger needs no such guard at all - it
 * only ever marks a shopper unavailable or retries a reassignment
 * search, both idempotent no-ops once nothing stale remains to find.
 */
import { Client, Databases, TablesDB, Query, Account } from 'node-appwrite';

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const ORDERS_COLLECTION_ID = process.env.APPWRITE_ORDERS_COLLECTION_ID;
const SHOPPER_STATUS_COLLECTION_ID = process.env.APPWRITE_SHOPPER_STATUS_COLLECTION_ID;
const CUSTOMER_ARRIVALS_COLLECTION_ID = process.env.APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID;

// How long a shopper has to respond to ArrivalNotificationModal before
// being marked unavailable and having the hand-off reassigned - see
// docs/DECISIONS.md's arrival hand-off entry for why 60s specifically.
const ARRIVAL_TIMEOUT_MS = 60 * 1000;

const nowIso = () => new Date().toISOString();

// ============================================================
// QUERIES - mirror shopperStatusService.ts / orderService.ts exactly
// ============================================================

/**
 * Same query and ordering as getNextAvailableShopper() in
 * shopperStatusService.ts: prefer whichever available, truly-idle
 * shopper has been idle longest.
 */
async function getNextAvailableShopper(databases, excludeShopperId) {
  const queries = [
    Query.equal('isAvailable', true),
    Query.equal('currentOrderId', ''),
    Query.orderAsc('lastActiveTimeStamp'),
    Query.limit(1),
  ];
  if (excludeShopperId) {
    queries.push(Query.notEqual('shopperID', excludeShopperId));
  }
  const res = await databases.listDocuments(DATABASE_ID, SHOPPER_STATUS_COLLECTION_ID, queries);
  return res.documents[0] ?? null;
}

/**
 * Same as getNextOrderForAssignment() in orderService.ts: the single
 * most time-urgent pending, unassigned order.
 */
async function getNextOrderForAssignment(databases) {
  const res = await databases.listDocuments(DATABASE_ID, ORDERS_COLLECTION_ID, [
    Query.equal('status', 'pending'),
    Query.equal('shopperID', ''),
    Query.orderAsc('scheduledReadyTime'),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

/**
 * Same as getInterruptCandidateShopper() in shopperStatusService.ts:
 * among busy-but-available shoppers, find the one whose current order
 * has the furthest-out scheduledReadyTime - the safest one to bump for
 * a rush order.
 */
async function getInterruptCandidateShopper(databases) {
  const shoppersRes = await databases.listDocuments(DATABASE_ID, SHOPPER_STATUS_COLLECTION_ID, [
    Query.equal('isAvailable', true),
    Query.notEqual('currentOrderId', ''),
    Query.limit(50),
  ]);
  if (shoppersRes.documents.length === 0) {
    return { shopper: null, order: null };
  }

  const orderIds = shoppersRes.documents.map((s) => s.currentOrderId);
  const ordersRes = await databases.listDocuments(DATABASE_ID, ORDERS_COLLECTION_ID, [
    Query.equal('$id', orderIds),
    Query.limit(orderIds.length),
  ]);
  if (ordersRes.documents.length === 0) {
    return { shopper: null, order: null };
  }

  const leastUrgentOrder = ordersRes.documents.reduce((latest, candidate) =>
    candidate.scheduledReadyTime > latest.scheduledReadyTime ? candidate : latest
  );
  const shopper = shoppersRes.documents.find((s) => s.currentOrderId === leastUrgentOrder.$id);
  if (!shopper) {
    return { shopper: null, order: null };
  }
  return { shopper, order: leastUrgentOrder };
}

async function getShopperStatusDoc(databases, shopperId) {
  const res = await databases.listDocuments(DATABASE_ID, SHOPPER_STATUS_COLLECTION_ID, [
    Query.equal('shopperID', shopperId),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

/**
 * Resolve an HTTP action's caller from the JWT it supplied, verifying it
 * against Appwrite itself rather than trusting anything the client
 * claims. This project's Appwrite plan can't scope a Function's execute
 * permission to "logged-in users" (only any/guests - confirmed live),
 * so `execute` is wide open and this check is the *only* authentication
 * boundary an HTTP action has - see docs/DECISIONS.md's "Permission
 * tightening" entry for the full spike that established this pattern.
 * `caller.$id` is the same Appwrite Auth user ID stored as `shopperID`
 * everywhere else in this app (AuthContext sets it to `newAccount.$id`
 * at signup), so it's directly usable as one without a lookup.
 */
async function resolveCaller(jwt) {
  if (!jwt) {
    return null;
  }
  try {
    const jwtClient = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setJWT(jwt);
    return await new Account(jwtClient).get();
  } catch {
    return null;
  }
}

// ============================================================
// CLAIM LOCKS - see docs/DECISIONS.md's "Race #1 fixed" entry
// ============================================================

/**
 * WHY LOCKS AT ALL?
 * Every assignment decision reads first ("is this shopper idle? is this
 * order still unclaimed?") and writes later. Appwrite runs executions of
 * this Function concurrently, so two of them can both pass the same check
 * before either writes - two orders placed together both picking the one
 * idle shopper, or two shoppers both claiming the same order.
 *
 * HOW THEY WORK:
 * Orders.claimLock and ShopperStatus.claimLock are 0/1 integer columns.
 * - An order's lock is 1 while a shopper holds it in the shopping stage
 *   (assigned/shopping), 0 while it's pending or once it's past shopping.
 * - A shopper's lock is 1 while their currentOrderId points at something.
 * Taking a lock is a capped increment (max 1) and giving one up from a
 * held order is a capped decrement (min 0): the database itself refuses
 * the second attempt, so exactly one execution wins. Each lock change is
 * staged in one transaction with the writes it guards, so either all of
 * it lands or none of it does - which also means a crash can no longer
 * leave an Order and a ShopperStatus disagreeing about each other.
 *
 * WHY NOT A TRANSACTION ALONE?
 * Verified live (2026-10-01): a row only *read* inside a transaction isn't
 * conflict-checked at commit, so a transaction by itself doesn't stop two
 * executions acting on the same stale read. The capped increment is what
 * turns "both passed the check" into "only one of them can commit".
 */
function isLostRace(err) {
  const type = err?.type ?? '';
  return type.endsWith('_limit_exceeded') || err?.code === 409;
}

/**
 * Stage writes via `stage(tables, transactionId)` and commit them as one.
 * Returns false when the commit lost a race (another execution got the
 * lock first) - every caller treats that as "re-read and decide again",
 * not as an error. Anything else is a real failure and is rethrown.
 */
async function runTransaction(databases, stage) {
  const tables = new TablesDB(databases.client);
  const tx = await tables.createTransaction();
  try {
    await stage(tables, tx.$id);
    await tables.updateTransaction(tx.$id, true);
    return true;
  } catch (err) {
    await tables.updateTransaction(tx.$id, false, true).catch(() => {});
    if (isLostRace(err)) {
      return false;
    }
    throw err;
  }
}

// ============================================================
// WRITES - same field set as assignOrderToShopper/unassignOrder/
// interruptOrder in orderService.ts
// ============================================================

/**
 * The Order fields that put an order back in the pending queue - same
 * shape as unassignOrder() (reason omitted) or interruptOrder() (reason
 * given).
 */
function releasedOrderData(reason) {
  const data = {
    shopperID: '',
    status: 'pending',
    autoAssigned: false,
    claimLock: 0,
  };
  if (reason) {
    data.interruptedAt = nowIso();
    data.interruptReason = reason;
  }
  return data;
}

/**
 * Assign orderId to shopperId: writes both sides of the relationship
 * (Order.shopperID + ShopperStatus.currentOrderId) in one transaction,
 * guarded by both claim locks. Returns false if another execution got the
 * order or the shopper first - nothing is written in that case.
 *
 * OPTIONS:
 * - autoAssigned / status: what the order is stamped with ('shopping'
 *   for a manual claim or swap, which start shopping immediately).
 * - releaseOrderId / releaseReason: the shopper is moving straight off
 *   another order they hold (a swap, or being bumped for a rush order).
 *   That order goes back to pending in the same transaction, and its
 *   capped decrement is the guard instead of the shopper's lock - the
 *   shopper stays locked throughout, and if two executions try to move
 *   them off the same order, only one decrement can succeed. It also
 *   fails if the order has already moved past shopping (its lock is
 *   cleared then), so a stale read can't drag a ready_for_pickup order
 *   back to pending.
 *
 * WHY ALSO SET isAvailable: true HERE, EVEN THOUGH EVERY AUTOMATIC
 * CALLER ALREADY REQUIRES isAvailable === true TO FIND A CANDIDATE?
 * Found live, via claimOrder (docs/DECISIONS.md's "Permission
 * tightening" entry): this write's own currentOrderId update re-fires
 * the shopperStatus `isUpdate` handler below, whose `isAvailable ===
 * false` branch (handleShopperWentUnavailable) matches on ANY update
 * where isAvailable happens to be false, not just a transition into it
 * - not distinguishable from a payload snapshot alone. For every
 * existing automatic-assignment caller this is a genuine no-op
 * (isAvailable was already true, by construction of the query that
 * found the shopper). For a manual claim, though, the shopper is
 * realistically almost always Unavailable at the moment they claim
 * (the Function auto-grabs any pending order the instant a shopper
 * goes idle+available, sub-second - there's essentially no UI-reachable
 * window where "available, idle, and a pending order exists" survives
 * long enough for a human to tap Claim first) - without this write,
 * handleShopperWentUnavailable immediately released the just-claimed
 * order right back to pending, confirmed via its own execution log
 * ("went unavailable, released order ..."), moments after a successful
 * claim. Setting it true here isn't a workaround for that alone - it's
 * also the correct invariant: a shopper actively holding an in-progress
 * order should read as available/on-duty, matching what every other
 * assignment path in this app already guarantees by construction.
 */
async function assign(databases, orderId, shopperId, options = {}) {
  const { autoAssigned = true, status = 'assigned', releaseOrderId = null, releaseReason } = options;
  const shopperStatus = await getShopperStatusDoc(databases, shopperId);
  if (!shopperStatus) {
    return false;
  }

  return runTransaction(databases, async (tables, txId) => {
    await tables.incrementRowColumn(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, 'claimLock', 1, 1, txId);
    if (releaseOrderId) {
      await tables.decrementRowColumn(DATABASE_ID, ORDERS_COLLECTION_ID, releaseOrderId, 'claimLock', 1, 0, txId);
      await tables.updateRow(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        releaseOrderId,
        releasedOrderData(releaseReason),
        undefined,
        txId
      );
    } else {
      await tables.incrementRowColumn(
        DATABASE_ID,
        SHOPPER_STATUS_COLLECTION_ID,
        shopperStatus.$id,
        'claimLock',
        1,
        1,
        txId
      );
    }
    await tables.updateRow(
      DATABASE_ID,
      ORDERS_COLLECTION_ID,
      orderId,
      { shopperID: shopperId, status, autoAssigned, interruptedAt: null, interruptReason: null },
      undefined,
      txId
    );
    await tables.updateRow(
      DATABASE_ID,
      SHOPPER_STATUS_COLLECTION_ID,
      shopperStatus.$id,
      { currentOrderId: orderId, isAvailable: true, lastActiveTimeStamp: nowIso() },
      undefined,
      txId
    );
  });
}

/**
 * Free a shopper: clears their currentOrderId and lock, and - when
 * releaseOrderId is given - puts that order back in the pending queue in
 * the same transaction. Returns false if the order release lost a race
 * (someone else already released or moved it), in which case nothing was
 * written and the caller decides what to do about the shopper's pointer.
 */
async function freeShopper(databases, shopperStatusDocId, releaseOrderId) {
  return runTransaction(databases, async (tables, txId) => {
    if (releaseOrderId) {
      await tables.decrementRowColumn(DATABASE_ID, ORDERS_COLLECTION_ID, releaseOrderId, 'claimLock', 1, 0, txId);
      await tables.updateRow(DATABASE_ID, ORDERS_COLLECTION_ID, releaseOrderId, releasedOrderData(), undefined, txId);
    }
    await tables.updateRow(
      DATABASE_ID,
      SHOPPER_STATUS_COLLECTION_ID,
      shopperStatusDocId,
      { currentOrderId: '', claimLock: 0, lastActiveTimeStamp: nowIso() },
      undefined,
      txId
    );
  });
}

/**
 * How many times an assignment handler re-reads and tries again after
 * losing a race. Each loss means another execution just took the shopper
 * or order it wanted, so a fresh read sees different candidates; a small
 * number is plenty.
 */
const MAX_ASSIGN_ATTEMPTS = 3;

/**
 * Hand a stuck arrival's order off to the next idle shopper: finds the
 * order's still-'waiting' CustomerArrival (if any), and if an idle
 * shopper exists, transfers Order.shopperID to them and resets the
 * arrival's notifiedShopperAt (restarting the 60s clock for the new
 * shopper). Leaves everything untouched if there's no stuck arrival for
 * this order, or no idle shopper to give it to - in the latter case the
 * order simply stays addressed to its current (already-unavailable, in
 * every caller of this function) shopper until a later sweep or event
 * finds someone free.
 *
 * WHY NOT TOUCH Order.status?
 * The order is already ready_for_pickup - shopping is done, only the
 * hand-off needs a new owner. This deliberately mirrors
 * releaseArrivalHandoff() on the client side (orderService.ts), which
 * clears shopperID without touching status for the exact same reason.
 *
 * CALLED FROM THREE PLACES, ALL CONVERGING HERE SO THE ACTUAL
 * REASSIGNMENT LOGIC EXISTS ONCE:
 * 1. The `orders` update handler below, when a client's
 *    releaseArrivalHandoff() clears shopperID directly (an explicit
 *    "Unavailable" decline on ArrivalNotificationModal).
 * 2. handleShopperWentUnavailable, when a shopper who's the hand-off
 *    contact for a ready_for_pickup order goes unavailable some other
 *    way (manually toggling off, or the schedule sweep marking them so
 *    the first time it finds them timed out).
 * 3. The schedule sweep itself, retrying on a later minute for an
 *    arrival whose shopper is *already* unavailable (a previous attempt
 *    found no one free) - no new shopperStatus event fires to trigger
 *    path 2 again on its own in that case, so the sweep has to retry it
 *    directly.
 */
async function reassignStuckArrival(databases, order, log) {
  const arrivalsRes = await databases.listDocuments(DATABASE_ID, CUSTOMER_ARRIVALS_COLLECTION_ID, [
    Query.equal('orderID', order.$id),
    Query.equal('status', 'waiting'),
    Query.limit(1),
  ]);
  const arrival = arrivalsRes.documents[0];
  if (!arrival) {
    return;
  }

  // WHY EXCLUDE arrival.declinedByShopperID?
  // A shopper who explicitly declined (as opposed to timing out) is NOT
  // marked unavailable - see handleShopperWentUnavailable's docstring -
  // so they can easily still be sitting idle and match
  // getNextAvailableShopper()'s own criteria. Without excluding them
  // here, a decline could hand the same arrival straight back to the
  // same shopper who just said no to it. Not relevant for the timeout
  // path (that shopper is already isAvailable: false by the time this
  // runs, which already excludes them from the query itself).
  const nextShopper = await getNextAvailableShopper(databases, arrival.declinedByShopperID);
  if (!nextShopper) {
    log(`Arrival ${arrival.$id}: no available shopper to reassign to - left stuck`);
    return;
  }

  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, order.$id, {
    shopperID: nextShopper.shopperID,
    autoAssigned: true,
  });
  await databases.updateDocument(DATABASE_ID, CUSTOMER_ARRIVALS_COLLECTION_ID, arrival.$id, {
    notifiedShopperAt: nowIso(),
    // Reset for the newly-targeted shopper - they haven't declined
    // anything yet, so any previous decliner's exclusion no longer
    // applies once someone new is holding it.
    declinedByShopperID: null,
  });
  log(`Arrival ${arrival.$id}: reassigned from ${order.shopperID} to ${nextShopper.shopperID}`);
}

// ============================================================
// HANDLERS - one per client-side function this replaces
// ============================================================

/**
 * Replaces tryAssignToIdleShopper() + handleNewOrderPlacement()/
 * handleRushOrderPlacement() in shopperStatusService.ts, called on a
 * fresh `orders` create event. A rush order (priority === 1) falls back
 * to interrupting a busy shopper if no one's idle; a normal order does
 * not (unchanged from the original's "no interrupt fallback" rule for
 * non-rush orders).
 *
 * WHAT STOPS THIS FROM RE-FIRING ITSELF:
 * A successful assign() sets status: 'assigned' on the order - the next
 * `orders` update event this produces no longer matches "status ===
 * 'pending'" in handleOrderReleased below, so nothing re-processes it.
 */
async function handleNewOrderPlacement(databases, order, log) {
  const outcome = await assignToIdleShopper(databases, order.$id, log);
  if (outcome !== 'no_shopper') {
    return;
  }

  if (order.priority !== 1) {
    log(`Order ${order.$id}: no idle shopper, not rush - left pending`);
    return;
  }

  const { shopper: candidate, order: victimOrder } = await getInterruptCandidateShopper(databases);
  if (!candidate || !victimOrder) {
    log(`Order ${order.$id}: rush order, no idle or interruptible shopper - left pending`);
    return;
  }

  const assigned = await assign(databases, order.$id, candidate.shopperID, {
    releaseOrderId: victimOrder.$id,
    releaseReason: 'Bumped for a rush order',
  });
  if (!assigned) {
    log(`Order ${order.$id}: rush interrupt lost a race (order or ${victimOrder.$id} changed) - left pending`);
    return;
  }
  log(`Order ${order.$id}: rush-assigned to ${candidate.shopperID}, bumped order ${victimOrder.$id}`);
}

/**
 * Hand orderId to the longest-idle available shopper, re-reading and
 * retrying if another execution takes that shopper (or the order) first.
 * Returns 'assigned', 'no_shopper' (nobody idle - the caller decides what
 * happens next), or 'order_taken' (someone else already has the order).
 */
async function assignToIdleShopper(databases, orderId, log) {
  for (let attempt = 1; attempt <= MAX_ASSIGN_ATTEMPTS; attempt++) {
    const idleShopper = await getNextAvailableShopper(databases);
    if (!idleShopper) {
      return 'no_shopper';
    }
    if (await assign(databases, orderId, idleShopper.shopperID)) {
      log(`Order ${orderId}: assigned to idle shopper ${idleShopper.shopperID}`);
      return 'assigned';
    }

    const order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId).catch(() => null);
    if (!order || order.status !== 'pending' || order.shopperID !== '') {
      log(`Order ${orderId}: taken by another execution first - nothing to do`);
      return 'order_taken';
    }
    log(`Order ${orderId}: shopper ${idleShopper.shopperID} taken by another execution first - retrying (attempt ${attempt})`);
  }
  log(`Order ${orderId}: still losing races after ${MAX_ASSIGN_ATTEMPTS} attempts - left pending`);
  return 'order_taken';
}

/**
 * Replaces reassignIfMostUrgent() in shopperStatusService.ts, called on
 * an `orders` update event whose new state is pending+unassigned - which
 * only ever happens right after an order is released (see module docstring:
 * assigned orders don't match this state, so this only fires on a
 * genuine release, whatever caused it - a shopper going unavailable, an
 * interrupt, or a manual swap). Unlike handleNewOrderPlacement, this
 * only acts if the released order is *still* the single most urgent
 * pending order by the time this runs, and never falls back to
 * interrupting anyone - both match the original's behavior exactly.
 */
async function handleOrderReleased(databases, order, log) {
  const mostUrgent = await getNextOrderForAssignment(databases);
  if (!mostUrgent || mostUrgent.$id !== order.$id) {
    log(`Order ${order.$id}: released, but not the most urgent pending order - left queued`);
    return;
  }

  const outcome = await assignToIdleShopper(databases, order.$id, log);
  if (outcome === 'no_shopper') {
    log(`Order ${order.$id}: most urgent pending, but no idle shopper - left queued`);
  }
}

/**
 * Replaces autoAssignNextOrderTo() + updateShopperAvailability()'s
 * "becoming available" branch. Fires on a `shopperStatus` update event
 * whose new state is available+idle - which includes both a shopper
 * explicitly toggling Available (client now writes only `isAvailable`)
 * and a shopper finishing a task via clearCurrentOrder() (client clears
 * only `currentOrderId`) - either write lands the document in the same
 * state, so one handler covers both without the client needing to know
 * or care which triggered it.
 *
 * WHAT STOPS THIS FROM RE-FIRING ITSELF:
 * A successful assign() sets currentOrderId to the new order's ID - the
 * next `shopperStatus` update event this produces no longer has an
 * empty currentOrderId, so this handler's own condition (checked by the
 * caller before this is invoked) no longer matches.
 */
async function handleShopperBecameAvailable(databases, shopperStatus, log) {
  for (let attempt = 1; attempt <= MAX_ASSIGN_ATTEMPTS; attempt++) {
    const order = await getNextOrderForAssignment(databases);
    if (!order) {
      log(`Shopper ${shopperStatus.shopperID}: became available, no pending orders`);
      return;
    }
    if (await assign(databases, order.$id, shopperStatus.shopperID)) {
      log(`Shopper ${shopperStatus.shopperID}: auto-assigned order ${order.$id}`);
      return;
    }

    const fresh = await getShopperStatusDoc(databases, shopperStatus.shopperID);
    if (!fresh || !fresh.isAvailable || fresh.currentOrderId !== '') {
      log(`Shopper ${shopperStatus.shopperID}: no longer idle (another execution got here first) - nothing to do`);
      return;
    }
    log(`Shopper ${shopperStatus.shopperID}: order ${order.$id} taken by another execution first - retrying (attempt ${attempt})`);
  }
  log(`Shopper ${shopperStatus.shopperID}: still losing races after ${MAX_ASSIGN_ATTEMPTS} attempts - left idle`);
}

/**
 * Replaces updateShopperAvailability()'s "becoming unavailable while
 * working" branch, and also covers the arrival hand-off side of going
 * unavailable (see docs/DECISIONS.md's arrival hand-off entry). Fires
 * on every `shopperStatus` update event where the new state is
 * unavailable - unlike the original version, no longer gated on
 * currentOrderId being non-empty, since a shopper can go unavailable
 * while holding zero, one, or both of "a currently-shopping order" and
 * "a stuck ready_for_pickup hand-off," and both need checking
 * independently.
 *
 * WHY GUARD THE RELEASE STEP ON currentOrderId BEING TRUTHY?
 * There's nothing to release or clear otherwise - this branch only
 * applies to a shopper who was actually mid-task when they went
 * unavailable, and skipping it avoids a pointless write (and the extra
 * `shopperStatus` event it would fire).
 *
 * WHAT STOPS THE RELEASE HALF FROM RE-FIRING ITSELF:
 * Clearing currentOrderId here produces one more `shopperStatus` update
 * event whose new state has isAvailable: false AND currentOrderId: ''
 * - the release half's own precondition (currentOrderId non-empty) no
 * longer matches, so that chain stops. The ready_for_pickup check below
 * is naturally idempotent instead - a shopper with nothing stuck just
 * gets a no-op query, and reassignStuckArrival() only ever moves an
 * order's shopperID *away* from this shopper, never re-triggering this
 * same condition for them again.
 */
async function handleShopperWentUnavailable(databases, shopperStatus, log) {
  const orderId = shopperStatus.currentOrderId;
  if (orderId) {
    // WHY FETCH AND CHECK STATUS BEFORE RELEASING, RATHER THAN
    // CALLING IT UNCONDITIONALLY LIKE THE ORIGINAL VERSION DID?
    // currentOrderId is normally cleared the moment an order reaches
    // ready_for_pickup (OrderCompletionScreen's clearCurrentOrder), so
    // it should never legitimately still point at a post-shopping
    // order - but that's two separate, non-atomic writes
    // (completeOrder() then clearCurrentOrder()), so a crash between
    // them (or any other bug that leaves currentOrderId stale) could
    // leave it pointing at an order that's already moved past shopping.
    // Releasing unconditionally forces status back to 'pending' -
    // calling it on a ready_for_pickup/out_for_delivery/completed order
    // would silently corrupt a real, already-progressed order back
    // into looking like a fresh unclaimed one. Only release if the
    // order is actually still at a shopping-stage status; otherwise
    // just clear the stale pointer and leave the order alone entirely.
    //
    // The claim lock (see "CLAIM LOCKS" above) now enforces the same rule
    // at commit time too: if the order moved past shopping or was released
    // by someone else between this read and the write, the release loses
    // its race and only the pointer is cleared.
    const currentOrder = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId).catch(() => null);
    const stillShopping =
      currentOrder &&
      currentOrder.shopperID === shopperStatus.shopperID &&
      (currentOrder.status === 'assigned' || currentOrder.status === 'shopping');
    if (stillShopping && (await freeShopper(databases, shopperStatus.$id, orderId))) {
      log(`Shopper ${shopperStatus.shopperID}: went unavailable, released order ${orderId}`);
    } else {
      await freeShopper(databases, shopperStatus.$id, null);
      log(`Shopper ${shopperStatus.shopperID}: currentOrderId pointed at order ${orderId}, no longer theirs to release (status: ${currentOrder?.status ?? 'missing'}) - clearing stale pointer only, order left untouched`);
    }
  }

  const readyOrdersRes = await databases.listDocuments(DATABASE_ID, ORDERS_COLLECTION_ID, [
    Query.equal('shopperID', shopperStatus.shopperID),
    Query.equal('status', 'ready_for_pickup'),
  ]);
  for (const readyOrder of readyOrdersRes.documents) {
    await reassignStuckArrival(databases, readyOrder, log);
  }
}

/**
 * The schedule-triggered half of the arrival hand-off mechanism - finds
 * every 'waiting' CustomerArrival whose notifiedShopperAt is older than
 * ARRIVAL_TIMEOUT_MS and, for each:
 * - if its order's shopper is still available: marks them unavailable.
 *   Deliberately does NOT call reassignStuckArrival directly here too -
 *   that write's own resulting `shopperStatus` update event reaches
 *   handleShopperWentUnavailable, which does the actual reassignment.
 *   Doing both here AND there would race two independent attempts to
 *   reassign the same order.
 * - if their shopper is already unavailable (a previous sweep already
 *   marked them so but found no one free at the time): retries the
 *   reassignment search directly, since no new shopperStatus event will
 *   fire on its own to trigger handleShopperWentUnavailable again for
 *   an already-unavailable shopper.
 */
async function handleScheduledSweep(databases, log) {
  const cutoff = new Date(Date.now() - ARRIVAL_TIMEOUT_MS).toISOString();
  const staleRes = await databases.listDocuments(DATABASE_ID, CUSTOMER_ARRIVALS_COLLECTION_ID, [
    Query.equal('status', 'waiting'),
    Query.lessThan('notifiedShopperAt', cutoff),
    Query.limit(100),
  ]);

  if (staleRes.documents.length === 0) {
    log('Scheduled sweep: no stale arrivals');
    return;
  }

  for (const arrival of staleRes.documents) {
    let order;
    try {
      order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, arrival.orderID);
    } catch (err) {
      log(`Scheduled sweep: order ${arrival.orderID} for arrival ${arrival.$id} not found - skipping`);
      continue;
    }
    if (order.status !== 'ready_for_pickup' || !order.shopperID) {
      // Already handed off, cancelled, or already reassigned away from
      // whoever timed out - this specific staleness has already been
      // resolved one way or another, nothing to do.
      continue;
    }

    const shopperStatusDoc = await getShopperStatusDoc(databases, order.shopperID);
    if (shopperStatusDoc && shopperStatusDoc.isAvailable) {
      await databases.updateDocument(DATABASE_ID, SHOPPER_STATUS_COLLECTION_ID, shopperStatusDoc.$id, {
        isAvailable: false,
        lastActiveTimeStamp: nowIso(),
      });
      log(`Scheduled sweep: shopper ${order.shopperID} timed out on arrival ${arrival.$id} - marked unavailable`);
    } else {
      log(`Scheduled sweep: shopper ${order.shopperID} already unavailable - retrying reassignment for arrival ${arrival.$id}`);
      await reassignStuckArrival(databases, order, log);
    }
  }
}

// ============================================================
// HTTP ACTIONS - one per client-side write this replaces, per
// docs/DECISIONS.md's "Permission tightening" entry. Each is
// responsible for its own authorization beyond "is the JWT valid" -
// resolveCaller() only proves *who*, not what they're allowed to do.
// ============================================================

/**
 * claimOrder - a shopper manually claiming an unclaimed order from the
 * available-tasks list. Replaces TaskDetailScreen's 'claim' branch,
 * which today makes three separate client writes in sequence
 * (assignOrderToShopper on Orders, assignOrderToShopper on
 * ShopperStatus, then startShopping) with no check that the order is
 * still actually unclaimed by the time each write lands - exactly the
 * "two clients read stale state, second write wins silently" race the
 * original auto-assignment primer described for the automatic path,
 * never closed for the manual one. This re-checks both sides fresh,
 * inside one server-side execution, immediately before writing.
 *
 * WHY CHECK THE SHOPPER'S OWN currentOrderId TOO, NOT JUST THE ORDER?
 * TaskDetailScreen only ever offers 'claim' when the shopper has no
 * active order (offers 'swap' instead otherwise) - but that's a client
 * UI decision, not something enforced here today. Once this is the
 * actual authorization boundary, it has to hold on its own regardless
 * of what UI state the caller's screen happened to be in.
 */
async function handleClaimOrder(databases, caller, payload, log) {
  const { orderId } = payload;
  if (!orderId) {
    return { status: 400, body: { ok: false, error: 'orderId is required' } };
  }

  let order;
  try {
    order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId);
  } catch {
    return { status: 404, body: { ok: false, error: 'Order not found' } };
  }
  if (order.status !== 'pending' || order.shopperID !== '') {
    return { status: 409, body: { ok: false, error: 'Order is no longer available to claim' } };
  }

  const shopperStatus = await getShopperStatusDoc(databases, caller.$id);
  if (!shopperStatus) {
    return { status: 403, body: { ok: false, error: 'No shopper profile for this account' } };
  }
  if (shopperStatus.currentOrderId !== '') {
    return { status: 409, body: { ok: false, error: 'You already have an active order' } };
  }

  // Manual claim starts shopping immediately (the button reads "Claim &
  // Start Shopping"), so the order goes straight to 'shopping' in the
  // same transaction rather than stopping at 'assigned'. The checks above
  // give a clear error in the common case; the claim locks are what
  // actually decide it when two shoppers tap Claim at the same moment.
  const claimed = await assign(databases, orderId, caller.$id, { autoAssigned: false, status: 'shopping' });
  if (!claimed) {
    return { status: 409, body: { ok: false, error: 'Order is no longer available to claim' } };
  }

  log(`claimOrder: ${orderId} claimed by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

/**
 * swapOrder - a shopper swapping off their current order onto a
 * different pending one from the available-tasks list, releasing the
 * previous order back to the queue. Replaces TaskDetailScreen's 'swap'
 * branch (swapCurrentOrder in shopperStatusService.ts).
 *
 * WHY DERIVE previousOrderId FROM shopperStatus.currentOrderId INSTEAD
 * OF TAKING IT AS A PARAMETER, THE WAY THE CLIENT VERSION DID?
 * The old client version trusted whatever order ID the caller's own
 * last-read local state claimed was their current one - fine when the
 * client was also the only place doing the writing, but not something
 * an authorization boundary can accept: a forged previousOrderId would
 * release an unrelated order back to pending on the caller's say-so
 * alone. The caller only gets to choose which NEW order they want;
 * which order gets released is always read fresh from the shopper's
 * own server-side ShopperStatus doc, never taken on faith.
 *
 * WHY CLAIM AND RELEASE IN ONE TRANSACTION?
 * This used to be three separate writes, claim first, so a failure
 * partway left the shopper with their original order intact rather than
 * with neither. One transaction gives that guarantee outright: the
 * shopper either moves to the new order or stays exactly where they were.
 * By the time the old order's `orders` update event reaches
 * handleOrderReleased, this shopper's currentOrderId already points at
 * the new order, so the just-released order can't be handed straight
 * back to the shopper who swapped off it.
 */
async function handleSwapOrder(databases, caller, payload, log) {
  const { newOrderId } = payload;
  if (!newOrderId) {
    return { status: 400, body: { ok: false, error: 'newOrderId is required' } };
  }

  const shopperStatus = await getShopperStatusDoc(databases, caller.$id);
  if (!shopperStatus) {
    return { status: 403, body: { ok: false, error: 'No shopper profile for this account' } };
  }
  const previousOrderId = shopperStatus.currentOrderId;
  if (!previousOrderId) {
    return { status: 409, body: { ok: false, error: 'No active order to swap from' } };
  }
  if (newOrderId === previousOrderId) {
    return { status: 409, body: { ok: false, error: 'Already working this order' } };
  }

  let newOrder;
  try {
    newOrder = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, newOrderId);
  } catch {
    return { status: 404, body: { ok: false, error: 'Order not found' } };
  }
  if (newOrder.status !== 'pending' || newOrder.shopperID !== '') {
    return { status: 409, body: { ok: false, error: 'Order is no longer available to claim' } };
  }

  // Same "claim starts shopping immediately" behavior as claimOrder -
  // the button reads "Swap for This Order" and navigates straight to
  // the Shopping screen, so the new order needs to already be past
  // 'assigned' by the time that navigation happens.
  const swapped = await assign(databases, newOrderId, caller.$id, {
    autoAssigned: false,
    status: 'shopping',
    releaseOrderId: previousOrderId,
  });
  if (!swapped) {
    return { status: 409, body: { ok: false, error: 'Order is no longer available to claim' } };
  }

  log(`swapOrder: ${caller.$id} swapped from ${previousOrderId} to ${newOrderId}`);
  return { status: 200, body: { ok: true } };
}

/**
 * Every arrival action needs both the CustomerArrival and the Order it
 * points at (arrival.orderID) - the Order is what actually says who the
 * hand-off is addressed to (Order.shopperID), matching
 * ShopperAssignmentContext's own targeting check (handleArrivalEvent)
 * exactly, not a separate field on the arrival itself.
 */
async function getArrivalAndOrder(databases, arrivalId) {
  const arrival = await databases
    .getDocument(DATABASE_ID, CUSTOMER_ARRIVALS_COLLECTION_ID, arrivalId)
    .catch(() => null);
  if (!arrival) {
    return { arrival: null, order: null };
  }
  const order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, arrival.orderID).catch(() => null);
  return { arrival, order };
}

/**
 * acceptArrivalHandoff - the targeted shopper acknowledging
 * ArrivalNotificationModal ("Hand Off Order"). Replaces
 * ShopperAssignmentContext's acceptArrival, which called
 * updateArrivalStatus() directly with no check the caller was actually
 * the shopper this arrival is addressed to - only the client's own
 * local `pendingArrival` state (itself already filtered to matching
 * orders) kept that true in practice. Doesn't touch Order.shopperID -
 * accepting keeps this shopper responsible, same as the client version.
 */
async function handleAcceptArrivalHandoff(databases, caller, payload, log) {
  const { arrivalId } = payload;
  if (!arrivalId) {
    return { status: 400, body: { ok: false, error: 'arrivalId is required' } };
  }

  const { arrival, order } = await getArrivalAndOrder(databases, arrivalId);
  if (!arrival) {
    return { status: 404, body: { ok: false, error: 'Arrival could not be found' } };
  }
  if (!order || order.shopperID !== caller.$id) {
    return { status: 403, body: { ok: false, error: 'This hand-off is not addressed to you' } };
  }

  await databases.updateDocument(DATABASE_ID, CUSTOMER_ARRIVALS_COLLECTION_ID, arrival.$id, {
    status: 'in_progress',
  });
  log(`acceptArrivalHandoff: ${arrivalId} accepted by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

/**
 * declineArrivalHandoff - the targeted shopper declining
 * ArrivalNotificationModal ("Unavailable"). Replaces
 * ShopperAssignmentContext's declineArrival (recordArrivalDecline() +
 * releaseArrivalHandoff() as two separate client writes), same
 * targeting check as accept. Order matters here exactly as the client
 * version's own WHY-comment already explains: declinedByShopperID has
 * to be written before shopperID clears, so the resulting `orders`
 * update event's reassignment search (reassignStuckArrival, triggered
 * below by this exact write) already excludes this shopper by the time
 * it runs - both writes happen inside one execution here, so that
 * ordering is naturally guaranteed rather than depending on two
 * sequential client calls landing in order.
 *
 * WHY {shopperID: ''} ONLY, NOT THE SHARED releasedOrderData()?
 * releasedOrderData() also forces status back to 'pending' - wrong here, this
 * order is ready_for_pickup and stays that way; only who's holding the
 * hand-off changes. Matches releaseArrivalHandoff()'s exact shape in
 * orderService.ts, not unassignOrder()'s.
 */
async function handleDeclineArrivalHandoff(databases, caller, payload, log) {
  const { arrivalId } = payload;
  if (!arrivalId) {
    return { status: 400, body: { ok: false, error: 'arrivalId is required' } };
  }

  const { arrival, order } = await getArrivalAndOrder(databases, arrivalId);
  if (!arrival) {
    return { status: 404, body: { ok: false, error: 'Arrival could not be found' } };
  }
  if (!order || order.shopperID !== caller.$id) {
    return { status: 403, body: { ok: false, error: 'This hand-off is not addressed to you' } };
  }

  await databases.updateDocument(DATABASE_ID, CUSTOMER_ARRIVALS_COLLECTION_ID, arrival.$id, {
    declinedByShopperID: caller.$id,
  });
  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, order.$id, { shopperID: '' });

  log(`declineArrivalHandoff: ${arrivalId} declined by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

/**
 * completeArrivalHandoff - physically handing the order to the
 * customer from Customer Check-ins ("Hand Off Order"). Replaces
 * CustomerCheckInsScreen's two separate, unguarded writes
 * (updateArrivalStatus + completeOrder) with one execution that does
 * both together.
 *
 * WHY NO order.shopperID === caller.$id CHECK, UNLIKE ACCEPT/DECLINE?
 * Deliberately looser by design, not an oversight - Customer Check-ins
 * is a shared queue any on-duty shopper works from, and the README
 * documents this exactly: "Any on-duty shopper can also complete a
 * hand-off directly from Customer Check-ins regardless of who's
 * currently targeted." The real authorization question here is only
 * "is this caller actually a shopper at all," not "is it THE shopper."
 */
async function handleCompleteArrivalHandoff(databases, caller, payload, log) {
  const { arrivalId } = payload;
  if (!arrivalId) {
    return { status: 400, body: { ok: false, error: 'arrivalId is required' } };
  }

  const { arrival, order } = await getArrivalAndOrder(databases, arrivalId);
  if (!arrival) {
    return { status: 404, body: { ok: false, error: 'Arrival could not be found' } };
  }
  if (!order) {
    return { status: 404, body: { ok: false, error: 'Order could not be found' } };
  }

  const callerShopperStatus = await getShopperStatusDoc(databases, caller.$id);
  if (!callerShopperStatus) {
    return { status: 403, body: { ok: false, error: 'No shopper profile for this account' } };
  }

  await databases.updateDocument(DATABASE_ID, CUSTOMER_ARRIVALS_COLLECTION_ID, arrival.$id, {
    status: 'completed',
  });
  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, order.$id, { status: 'completed' });

  log(`completeArrivalHandoff: ${arrivalId} completed by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

const COMPLETE_ORDER_STATUSES = ['ready_for_pickup', 'out_for_delivery', 'completed'];

/**
 * completeOrder - the shopper progressing their order to the next
 * fulfillment-lifecycle status (OrderCompletionScreen's "Mark Ready
 * for Pickup"/"Mark Out for Delivery", DropOffsScreen's "Mark
 * Delivered"). Replaces two separate client call sites
 * (orderService.ts's completeOrder, now dead code, removed) that both
 * wrote `status` directly with no check the order actually belonged to
 * the calling shopper - only that it was already in their own
 * locally-fetched list, never re-verified against the write itself.
 *
 * WHY VALIDATE nextStatus AGAINST A FIXED LIST INSTEAD OF ANY STRING?
 * Baseline input validation, not a full transition state-machine - the
 * old client code accepted any string here too (TypeScript's union
 * type was compile-time only, no runtime check), so this isn't a new
 * restriction, just the same guarantee finally enforced at the one
 * place that can actually enforce it.
 */
async function handleCompleteOrder(databases, caller, payload, log) {
  const { orderId, nextStatus } = payload;
  if (!orderId || !COMPLETE_ORDER_STATUSES.includes(nextStatus)) {
    return { status: 400, body: { ok: false, error: 'orderId and a valid nextStatus are required' } };
  }

  let order;
  try {
    order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId);
  } catch {
    return { status: 404, body: { ok: false, error: 'Order not found' } };
  }
  if (order.shopperID !== caller.$id) {
    return { status: 403, body: { ok: false, error: 'This order is not assigned to you' } };
  }

  // Past shopping, so the order's claim lock is cleared - a swap or rush
  // interrupt working from a stale read can no longer release it back to
  // pending (see "CLAIM LOCKS" above).
  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, { status: nextStatus, claimLock: 0 });
  log(`completeOrder: ${orderId} -> ${nextStatus} by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

/**
 * releaseAfterCompletion - frees the caller's own ShopperStatus once
 * their order reaches a post-shopping status (OrderCompletionScreen,
 * right after completeOrder - see its own file header for why this is
 * a separate call, not folded into completeOrder itself: DropOffsScreen
 * calls completeOrder alone, without this, since that shopper's
 * currentOrderId was already cleared earlier when the order first
 * reached out_for_delivery).
 *
 * WHY NO orderId PARAMETER, UNLIKE EVERY OTHER ACTION SO FAR?
 * There's nothing to authorize beyond "is this caller a shopper at
 * all" - it only ever clears the caller's own currentOrderId, derived
 * from their own resolved identity, never anyone else's. No parameter
 * means nothing to forge.
 */
async function handleReleaseAfterCompletion(databases, caller, log) {
  const shopperStatus = await getShopperStatusDoc(databases, caller.$id);
  if (!shopperStatus) {
    return { status: 403, body: { ok: false, error: 'No shopper profile for this account' } };
  }

  if (!(await freeShopper(databases, shopperStatus.$id, null))) {
    return { status: 409, body: { ok: false, error: 'Your status changed at the same moment - please try again' } };
  }

  log(`releaseAfterCompletion: ${caller.$id} freed`);
  return { status: 200, body: { ok: true } };
}

/**
 * startShopping - the shopper moving an already-assigned order from
 * 'assigned' to 'shopping' (TaskDetailScreen's 'start' action,
 * ShopperDashboardScreen's current-task tap for an 'assigned' order).
 * Replaces orderService.ts's startShopping (now dead code, removed),
 * which wrote status unconditionally with no check the order actually
 * belonged to the calling shopper - same gap completeOrder closed for
 * the later lifecycle transitions.
 *
 * WHY NOT ALSO VALIDATE order.status === 'assigned'?
 * The old client version never did either - both callers only ever
 * offer this action for an order already known to be 'assigned', and
 * writing status: 'shopping' over an order already 'shopping' is an
 * inert no-op, not a corruption risk the way an unchecked ownership
 * write is.
 */
async function handleStartShopping(databases, caller, payload, log) {
  const { orderId } = payload;
  if (!orderId) {
    return { status: 400, body: { ok: false, error: 'orderId is required' } };
  }

  let order;
  try {
    order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId);
  } catch {
    return { status: 404, body: { ok: false, error: 'Order not found' } };
  }
  if (order.shopperID !== caller.$id) {
    return { status: 403, body: { ok: false, error: 'This order is not assigned to you' } };
  }

  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, { status: 'shopping' });
  log(`startShopping: ${orderId} started by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

/**
 * toggleAvailability - a shopper flipping their own on-duty status
 * (ShopperDashboardScreen's status dropdown, and
 * ShopperAssignmentContext's decline-a-fresh-assignment path, which
 * reuses "go unavailable" rather than a dedicated decline action - see
 * that call site's own WHY-comment). Replaces
 * shopperStatusService.ts's updateShopperAvailability (now dead code,
 * removed).
 *
 * WHY NO shopperId PARAMETER, LIKE releaseAfterCompletion?
 * Same reasoning - nothing to authorize beyond "is this caller a
 * shopper at all," so it always targets the caller's own ShopperStatus,
 * never one taken from the client.
 *
 * WHY NO currentOrderId HANDLING HERE?
 * Unchanged from the client version this replaces - see
 * shopperStatusService.ts's original file header, still accurate: this
 * action's only job is the isAvailable write itself. The resulting
 * `shopperStatus` update event is what the rest of this Function (the
 * become-available/went-unavailable handlers already above) reacts to
 * for whatever follows.
 */
async function handleToggleAvailability(databases, caller, payload, log) {
  if (typeof payload.isAvailable !== 'boolean') {
    return { status: 400, body: { ok: false, error: 'isAvailable (boolean) is required' } };
  }

  const shopperStatus = await getShopperStatusDoc(databases, caller.$id);
  if (!shopperStatus) {
    return { status: 403, body: { ok: false, error: 'No shopper profile for this account' } };
  }

  await databases.updateDocument(DATABASE_ID, SHOPPER_STATUS_COLLECTION_ID, shopperStatus.$id, {
    isAvailable: payload.isAvailable,
    lastActiveTimeStamp: nowIso(),
  });

  log(`toggleAvailability: ${caller.$id} -> isAvailable: ${payload.isAvailable}`);
  return { status: 200, body: { ok: true } };
}

/**
 * Parse/format the compact `itemIssues` string - a hand-reimplemented
 * copy of src/utils/orderItems.ts's parseItemIssues/formatItemIssues,
 * not an import: this Function is plain JS with no build step sharing
 * code with the TypeScript client (every query/write helper above
 * already mirrors its client-side counterpart the same way, per this
 * file's own header comment on getNextAvailableShopper etc.). Format:
 * "productId:oos" (out of stock, no substitute) or
 * "productId:sub:subProductId:pending|approved|rejected" (a
 * substitution proposal and its approval state).
 */
function parseItemIssues(itemIssues) {
  if (!itemIssues) return [];
  const issues = [];
  for (const entry of itemIssues.split(',')) {
    if (!entry) continue;
    const parts = entry.split(':');
    const productId = parts[0];
    const kind = parts[1];
    if (!productId) continue;
    if (kind === 'oos') {
      issues.push({ productId, kind: 'oos' });
    } else if (kind === 'sub') {
      const subProductId = parts[2];
      const status = parts[3];
      if (subProductId && (status === 'pending' || status === 'approved' || status === 'rejected')) {
        issues.push({ productId, kind: 'sub', subProductId, status });
      }
    }
  }
  return issues;
}

function formatItemIssues(issues) {
  return issues
    .map((issue) =>
      issue.kind === 'oos'
        ? `${issue.productId}:oos`
        : `${issue.productId}:sub:${issue.subProductId}:${issue.status}`
    )
    .join(',');
}

/**
 * cancelOrder - a customer cancelling their own order (OrderDetailScreen's
 * "Cancel Order"). Replaces orderService.ts's cancelOrder (removed - this
 * was its only remaining set of callers), and the first action in this
 * Function authorized against a CUSTOMER caller rather than a shopper -
 * every prior action's identity check has been `order.shopperID ===
 * caller.$id` or a ShopperStatus lookup; this one is `order.customerID
 * === caller.$id` instead, the same `caller.$id` (an Appwrite Auth user
 * ID) either role's account uses (see the Role.any() primer above for
 * why Appwrite itself can't tell a shopper from a customer at the
 * permission layer - this app-level check is the only place that
 * distinction gets enforced).
 *
 * WHY VALIDATE order.status HERE, WHEN completeOrder AND startShopping
 * DELIBERATELY DON'T VALIDATE STATUS BEYOND A FIXED LIST/NOT-AT-ALL?
 * Unlike those two, the old client version already had a real
 * business-logic gate on this exact write - canCancelOrder() in
 * OrderDetailScreen.tsx only ever shows the Cancel button for a
 * 'pending' or 'assigned' order - it was just never enforced anywhere
 * but the UI. A forged call against a 'shopping'/'ready_for_pickup'
 * order would cancel an order already being actively fulfilled, a real
 * correctness gap once this is the actual authorization boundary, not
 * a new restriction invented here.
 */
async function handleCancelOrder(databases, caller, payload, log) {
  const { orderId } = payload;
  if (!orderId) {
    return { status: 400, body: { ok: false, error: 'orderId is required' } };
  }

  let order;
  try {
    order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId);
  } catch {
    return { status: 404, body: { ok: false, error: 'Order not found' } };
  }
  if (order.customerID !== caller.$id) {
    return { status: 403, body: { ok: false, error: 'This order does not belong to you' } };
  }
  if (order.status !== 'pending' && order.status !== 'assigned') {
    return { status: 409, body: { ok: false, error: 'This order can no longer be cancelled' } };
  }

  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, { status: 'cancelled', claimLock: 0 });
  log(`cancelOrder: ${orderId} cancelled by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

/**
 * respondToSubstitution - the customer approving/rejecting a pending
 * substitution proposal (OrderDetailScreen's SubstitutionApprovalCard).
 * Replaces orderService.ts's respondToSubstitution (removed - this was
 * its only remaining set of callers). Same customer-ownership check as
 * cancelOrder, same read-modify-write shape the old client version used
 * (itemIssues has no partial-field update, the whole compact string
 * gets read, the matching entry's status flipped in memory, and the
 * whole string written back).
 *
 * WHY NO CHECK THAT A MATCHING PENDING 'sub' ISSUE ACTUALLY EXISTS FOR
 * productId?
 * Matches the old client's own behavior exactly - it mapped over every
 * issue and only touched the one matching kind:'sub' + productId; a
 * productId with no matching pending substitution was always a silent
 * no-op (the formatted string comes back unchanged). Not a new gap
 * introduced here, and adding a stricter check would be new behavior
 * the client version never had, not just closing an authorization hole.
 */
async function handleRespondToSubstitution(databases, caller, payload, log) {
  const { orderId, productId, approve } = payload;
  if (!orderId || !productId || typeof approve !== 'boolean') {
    return { status: 400, body: { ok: false, error: 'orderId, productId, and approve (boolean) are required' } };
  }

  let order;
  try {
    order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId);
  } catch {
    return { status: 404, body: { ok: false, error: 'Order not found' } };
  }
  if (order.customerID !== caller.$id) {
    return { status: 403, body: { ok: false, error: 'This order does not belong to you' } };
  }

  const issues = parseItemIssues(order.itemIssues ?? '');
  const updatedIssues = issues.map((issue) =>
    issue.kind === 'sub' && issue.productId === productId
      ? { ...issue, status: approve ? 'approved' : 'rejected' }
      : issue
  );

  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, {
    itemIssues: formatItemIssues(updatedIssues),
  });
  log(`respondToSubstitution: ${orderId} product ${productId} ${approve ? 'approved' : 'rejected'} by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

/**
 * updatePickedItems - the shopper checking off found items and adjusting
 * quantities while working the checklist (ShoppingScreen's
 * `persistPicked`, fired on every Found/quantity change). Replaces
 * orderService.ts's updatePickedItems (removed - this was its only
 * remaining set of callers). Back to a shopper-authorized action - same
 * `order.shopperID === caller.$id` ownership check `completeOrder` and
 * `startShopping` already use.
 *
 * WHY NO VALIDATION OF pickedItems' CONTENTS (e.g. that each productId
 * is actually on the order, or quantities don't exceed what was
 * ordered)?
 * The old client version wrote whatever compact string
 * `formatPickedItemsString` produced with no server-side check either -
 * this is the single highest-frequency write in the whole shopping
 * workflow (fires on every checklist interaction), and adding real
 * validation here would be new business logic invented for this
 * migration, not closing an authorization hole. The authorization
 * boundary (only the assigned shopper can write this order's progress
 * at all) is the actual gap this action closes.
 */
async function handleUpdatePickedItems(databases, caller, payload, log) {
  const { orderId, pickedItems } = payload;
  if (!orderId || typeof pickedItems !== 'string') {
    return { status: 400, body: { ok: false, error: 'orderId and pickedItems (string) are required' } };
  }

  let order;
  try {
    order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId);
  } catch {
    return { status: 404, body: { ok: false, error: 'Order not found' } };
  }
  if (order.shopperID !== caller.$id) {
    return { status: 403, body: { ok: false, error: 'This order is not assigned to you' } };
  }

  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, { pickedItems });
  log(`updatePickedItems: ${orderId} updated by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

/**
 * updateItemIssues - the shopper marking an item out-of-stock or
 * proposing a substitute (ShoppingScreen's `persistIssues`, fired from
 * handleMarkOutOfStock/handleSelectSubstitute/the found-clears-issue
 * path). Replaces orderService.ts's updateItemIssues (removed - this
 * was its only remaining set of callers). Same ownership check and same
 * "no content validation, only the authorization gap closes" reasoning
 * as updatePickedItems above - the shopper-authored half of the exact
 * itemIssues field `respondToSubstitution` above writes the
 * customer-authored half of.
 */
async function handleUpdateItemIssues(databases, caller, payload, log) {
  const { orderId, itemIssues } = payload;
  if (!orderId || typeof itemIssues !== 'string') {
    return { status: 400, body: { ok: false, error: 'orderId and itemIssues (string) are required' } };
  }

  let order;
  try {
    order = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId);
  } catch {
    return { status: 404, body: { ok: false, error: 'Order not found' } };
  }
  if (order.shopperID !== caller.$id) {
    return { status: 403, body: { ok: false, error: 'This order is not assigned to you' } };
  }

  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, { itemIssues });
  log(`updateItemIssues: ${orderId} updated by ${caller.$id}`);
  return { status: 200, body: { ok: true } };
}

async function handleHttpAction(databases, payload, log) {
  const caller = await resolveCaller(payload.jwt);
  if (!caller) {
    return { status: 401, body: { ok: false, error: 'Invalid or missing authentication' } };
  }

  switch (payload.action) {
    case 'claimOrder':
      return await handleClaimOrder(databases, caller, payload, log);
    case 'swapOrder':
      return await handleSwapOrder(databases, caller, payload, log);
    case 'acceptArrivalHandoff':
      return await handleAcceptArrivalHandoff(databases, caller, payload, log);
    case 'declineArrivalHandoff':
      return await handleDeclineArrivalHandoff(databases, caller, payload, log);
    case 'completeArrivalHandoff':
      return await handleCompleteArrivalHandoff(databases, caller, payload, log);
    case 'completeOrder':
      return await handleCompleteOrder(databases, caller, payload, log);
    case 'releaseAfterCompletion':
      return await handleReleaseAfterCompletion(databases, caller, log);
    case 'startShopping':
      return await handleStartShopping(databases, caller, payload, log);
    case 'toggleAvailability':
      return await handleToggleAvailability(databases, caller, payload, log);
    case 'cancelOrder':
      return await handleCancelOrder(databases, caller, payload, log);
    case 'respondToSubstitution':
      return await handleRespondToSubstitution(databases, caller, payload, log);
    case 'updatePickedItems':
      return await handleUpdatePickedItems(databases, caller, payload, log);
    case 'updateItemIssues':
      return await handleUpdateItemIssues(databases, caller, payload, log);
    default:
      return { status: 400, body: { ok: false, error: `Unknown action: ${payload.action}` } };
  }
}

// ============================================================
// ENTRYPOINT
// ============================================================

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const databases = new Databases(client);

  const event = req.headers['x-appwrite-event'] ?? '';
  // WHY DERIVE trigger FROM x-appwrite-trigger, FALLING BACK TO
  // event-PRESENCE RATHER THAN TRUSTING THE HEADER NAME BLINDLY?
  // This function is now deployed with both `events` and a `schedule`
  // (see scripts/deploy.js) - a scheduled invocation carries no
  // x-appwrite-event header at all, which is a more robust signal than
  // depending on one specific header name/value this project hasn't
  // independently verified for the schedule case (unlike x-appwrite-event
  // and x-appwrite-key, both confirmed empirically - see the
  // tablesdb/databases naming gotcha above and the scopes gotcha in
  // docs/DECISIONS.md).
  const trigger = req.headers['x-appwrite-trigger'] ?? (event ? 'event' : 'schedule');

  try {
    if (trigger === 'schedule') {
      await handleScheduledSweep(databases, log);
      return res.json({ ok: true });
    }

    let payload;
    try {
      payload = req.bodyJson ?? JSON.parse(req.body || '{}');
    } catch (parseErr) {
      error(`Failed to parse event payload: ${parseErr}`);
      return res.json({ ok: false, error: 'invalid payload' }, 400);
    }

    if (trigger === 'http') {
      const result = await handleHttpAction(databases, payload, log);
      return res.json(result.body, result.status);
    }

    // WHY .includes(collectionId) INSTEAD OF THE FULL LEGACY PATH?
    // This project's Appwrite Cloud instance dual-emits every database
    // event under two different naming schemes for the same underlying
    // change - the legacy `databases.{db}.collections.{id}.documents...`
    // form (what this function's own `events` registration uses, per
    // scripts/deploy.js) and a newer `tablesdb.{db}.tables.{id}.rows...`
    // form, and the `x-appwrite-event` header delivered at runtime uses
    // the *new* form even though registration used the legacy one - the
    // exact same dual-naming fact already documented in DECISIONS.md's
    // Realtime migration entry, hit again here on first live test.
    // Matching on the bare collection ID (a fairly unique substring
    // either way, unlike a doc ID) instead of a specific path shape
    // is robust to whichever naming Appwrite uses for a given event.
    const isOrdersEvent = event.includes(ORDERS_COLLECTION_ID);
    const isShopperStatusEvent = event.includes(SHOPPER_STATUS_COLLECTION_ID);
    const isCreate = event.endsWith('.create');
    const isUpdate = event.endsWith('.update');

    if (isOrdersEvent) {
      if (isCreate) {
        // Checkout always creates orders pending + unassigned, but Orders
        // keeps create("any"), so a create can carry any status/shopperID -
        // only a genuinely new, unclaimed order is ours to place.
        if (payload.status === 'pending' && !payload.shopperID) {
          await handleNewOrderPlacement(databases, payload, log);
        } else {
          log(`Order ${payload.$id}: created as ${payload.status} (shopper ${payload.shopperID || 'none'}), not a new unclaimed order - skipped`);
        }
      } else if (isUpdate && payload.status === 'pending' && payload.shopperID === '') {
        await handleOrderReleased(databases, payload, log);
      } else if (isUpdate && payload.status === 'ready_for_pickup' && payload.shopperID === '') {
        // A client's releaseArrivalHandoff() (the "Unavailable" decline
        // on ArrivalNotificationModal) cleared shopperID directly -
        // same reassignment path the timeout mechanism uses.
        await reassignStuckArrival(databases, payload, log);
      }
    } else if (isShopperStatusEvent && isUpdate) {
      if (payload.isAvailable === true && payload.currentOrderId === '') {
        await handleShopperBecameAvailable(databases, payload, log);
      } else if (payload.isAvailable === false) {
        await handleShopperWentUnavailable(databases, payload, log);
      }
    } else {
      log(`Ignoring event outside scope: ${event}`);
    }
    return res.json({ ok: true });
  } catch (err) {
    error(`Auto-assignment failed for event ${event}: ${err instanceof Error ? err.message : err}`);
    if (trigger === 'http') {
      // Unlike the event/schedule case below, an HTTP caller is a real
      // client waiting on a result - it needs an actual error status to
      // know the action didn't happen, not a 200-shaped "ok: false" it
      // has no retry-loop reason to swallow silently.
      return res.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
    // Deliberately return 200-shaped success from the function's own
    // perspective (it did run, and logged the failure) rather than
    // retry-looping Appwrite's own event-delivery retries against a
    // deterministic bug - matches this project's existing "best effort,
    // never block the user-facing action" stance on assignment (see
    // CheckoutScreen's fire-and-forget calls in the pre-migration code).
    return res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
