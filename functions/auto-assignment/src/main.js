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
import { Client, Databases, Query } from 'node-appwrite';

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

// ============================================================
// WRITES - same field set as assignOrderToShopper/unassignOrder/
// interruptOrder in orderService.ts
// ============================================================

/**
 * Assign orderId to shopperId: writes both sides of the relationship
 * (Order.shopperID + ShopperStatus.currentOrderId), same two-document
 * shape the client-side version always wrote.
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
    // Deliberately return 200-shaped success from the function's own
    // perspective (it did run, and logged the failure) rather than
    // retry-looping Appwrite's own event-delivery retries against a
    // deterministic bug - matches this project's existing "best effort,
    // never block the user-facing action" stance on assignment (see
    // CheckoutScreen's fire-and-forget calls in the pre-migration code).
    return res.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
