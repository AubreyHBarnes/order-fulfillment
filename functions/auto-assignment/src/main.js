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
import { Client, Databases, Query, Account } from 'node-appwrite';

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
// WRITES - same field set as assignOrderToShopper/unassignOrder/
// interruptOrder in orderService.ts
// ============================================================

/**
 * Assign orderId to shopperId: writes both sides of the relationship
 * (Order.shopperID + ShopperStatus.currentOrderId), same two-document
 * shape the client-side version always wrote.
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
async function assign(databases, orderId, shopperId, autoAssigned = true) {
  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, {
    shopperID: shopperId,
    status: 'assigned',
    autoAssigned,
    interruptedAt: null,
    interruptReason: null,
  });

  const shopperStatus = await getShopperStatusDoc(databases, shopperId);
  if (shopperStatus) {
    await databases.updateDocument(DATABASE_ID, SHOPPER_STATUS_COLLECTION_ID, shopperStatus.$id, {
      currentOrderId: orderId,
      isAvailable: true,
      lastActiveTimeStamp: nowIso(),
    });
  }
}

/**
 * Release orderId back to the pending queue - same shape as
 * unassignOrder() (reason omitted) or interruptOrder() (reason given).
 * Only touches the Order side; ShopperStatus.currentOrderId is cleared
 * separately by whichever caller already knows to (see
 * handleShopperWentUnavailable below - this function is also called
 * from there, after which it clears currentOrderId itself).
 */
async function release(databases, orderId, reason) {
  const data = {
    shopperID: '',
    status: 'pending',
    autoAssigned: false,
  };
  if (reason) {
    data.interruptedAt = nowIso();
    data.interruptReason = reason;
  }
  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, data);
}

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
  const idleShopper = await getNextAvailableShopper(databases);
  if (idleShopper) {
    await assign(databases, order.$id, idleShopper.shopperID, true);
    log(`Order ${order.$id}: assigned to idle shopper ${idleShopper.shopperID}`);
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

  await release(databases, victimOrder.$id, 'Bumped for a rush order');
  await assign(databases, order.$id, candidate.shopperID, true);
  log(`Order ${order.$id}: rush-assigned to ${candidate.shopperID}, bumped order ${victimOrder.$id}`);
}

/**
 * Replaces reassignIfMostUrgent() in shopperStatusService.ts, called on
 * an `orders` update event whose new state is pending+unassigned - which
 * only ever happens right after release() runs (see module docstring:
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

  const idleShopper = await getNextAvailableShopper(databases);
  if (!idleShopper) {
    log(`Order ${order.$id}: most urgent pending, but no idle shopper - left queued`);
    return;
  }

  await assign(databases, order.$id, idleShopper.shopperID, true);
  log(`Order ${order.$id}: most-urgent released order handed to idle shopper ${idleShopper.shopperID}`);
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
  const order = await getNextOrderForAssignment(databases);
  if (!order) {
    log(`Shopper ${shopperStatus.shopperID}: became available, no pending orders`);
    return;
  }
  await assign(databases, order.$id, shopperStatus.shopperID, true);
  log(`Shopper ${shopperStatus.shopperID}: auto-assigned order ${order.$id}`);
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
 * release()/updateDocument would fail outright on an empty document ID
 * if called unconditionally - this branch only applies to a shopper who
 * was actually mid-task when they went unavailable.
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
    // WHY FETCH AND CHECK STATUS BEFORE release()-ING, RATHER THAN
    // CALLING IT UNCONDITIONALLY LIKE THE ORIGINAL VERSION DID?
    // currentOrderId is normally cleared the moment an order reaches
    // ready_for_pickup (OrderCompletionScreen's clearCurrentOrder), so
    // it should never legitimately still point at a post-shopping
    // order - but that's two separate, non-atomic writes
    // (completeOrder() then clearCurrentOrder()), so a crash between
    // them (or any other bug that leaves currentOrderId stale) could
    // leave it pointing at an order that's already moved past shopping.
    // release() unconditionally forces status back to 'pending' -
    // calling it on a ready_for_pickup/out_for_delivery/completed order
    // would silently corrupt a real, already-progressed order back
    // into looking like a fresh unclaimed one. Only release if the
    // order is actually still at a shopping-stage status; otherwise
    // just clear the stale pointer and leave the order alone entirely.
    const currentOrder = await databases.getDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId).catch(() => null);
    if (currentOrder && (currentOrder.status === 'assigned' || currentOrder.status === 'shopping')) {
      await release(databases, orderId, undefined);
      log(`Shopper ${shopperStatus.shopperID}: went unavailable, released order ${orderId}`);
    } else if (currentOrder) {
      log(`Shopper ${shopperStatus.shopperID}: currentOrderId pointed at order ${orderId} already past shopping (status: ${currentOrder.status}) - clearing stale pointer only, order left untouched`);
    }
    await databases.updateDocument(DATABASE_ID, SHOPPER_STATUS_COLLECTION_ID, shopperStatus.$id, {
      currentOrderId: '',
    });
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

  await assign(databases, orderId, caller.$id, false);
  // Manual claim starts shopping immediately (the button reads "Claim &
  // Start Shopping") - assign() alone only reaches 'assigned', same as
  // every automatic-assignment path, so a second write bumps it the
  // rest of the way, matching the client's existing two-call sequence.
  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, orderId, { status: 'shopping' });

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
 * WHY CLAIM THE NEW ORDER BEFORE RELEASING THE OLD ONE?
 * Same reasoning as the client version this replaces: if claiming the
 * new order fails partway, the shopper still has their original order
 * intact - nothing lost. Releasing first would risk leaving them with
 * neither. It also matters for a second reason specific to this
 * server-side version: assign()'s ShopperStatus write (currentOrderId
 * -> newOrderId) happens first, so by the time release() fires the
 * old order's `orders` update event, this shopper's currentOrderId no
 * longer reads as idle - handleOrderReleased's getNextAvailableShopper
 * query correctly can't hand the just-released order right back to the
 * same shopper who just swapped off it.
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

  await assign(databases, newOrderId, caller.$id, false);
  // Same "claim starts shopping immediately" behavior as claimOrder -
  // the button reads "Swap for This Order" and navigates straight to
  // the Shopping screen, so the new order needs to already be past
  // 'assigned' by the time that navigation happens.
  await databases.updateDocument(DATABASE_ID, ORDERS_COLLECTION_ID, newOrderId, { status: 'shopping' });
  await release(databases, previousOrderId, undefined);

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
 * WHY {shopperID: ''} ONLY, NOT THE SHARED release() HELPER?
 * release() also forces status back to 'pending' - wrong here, this
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
        await handleNewOrderPlacement(databases, payload, log);
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
