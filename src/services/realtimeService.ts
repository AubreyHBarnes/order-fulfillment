/**
 * Realtime Service
 * File: src/services/realtimeService.ts
 *
 * PURPOSE: Thin wrapper around Appwrite's Realtime service for the 3
 * collections this app needs live updates from (orders, shopperStatus,
 * customerArrivals). See docs/DECISIONS.md for the Phase 0 empirical
 * spike that verified this SDK version behaves correctly in this RN
 * app before any real feature was migrated onto it.
 *
 * WHY NO SERVER-SIDE FILTERING?
 * Appwrite Realtime channels are collection-scoped, not query-scoped -
 * every subscriber receives every document's create/update/delete
 * events project-wide on that collection. Callers must check payload
 * fields (customerID, shopperID, $id, status) themselves before acting,
 * the same way polling callers already filter/diff a fetched list -
 * this just moves where the filtering happens, not whether it happens.
 *
 * WHY A SINGLE MODULE-LEVEL Realtime INSTANCE?
 * The SDK multiplexes every subscribe() call over one shared WebSocket
 * per Client instance internally - one instance here means every
 * screen/context's subscribe/close is as cheap as it already is inside
 * the SDK, with no extra sockets opened per call site.
 *
 * WHY THREE NAMED EXPORTS INSTEAD OF ONE GENERIC subscribe(collectionId)?
 * Mirrors the existing service-per-collection split already used by
 * orderService.ts/shopperStatusService.ts/arrivalService.ts, and there
 * are exactly 3 collections in scope here, not an open-ended set.
 *
 * WHY RETURN A SYNCHRONOUS Unsubscribe INSTEAD OF THE SDK'S OWN
 * Promise<RealtimeSubscription>?
 * Every call site hands this straight back as a useEffect/useFocusEffect
 * cleanup function, which must be synchronous - this matches the exact
 * shape the clearInterval calls it replaces already have.
 *
 * WHY NOT THE {success, data, error} SHAPE THE REST OF THE SERVICE LAYER
 * USES?
 * That shape models a request with one pass/fail outcome. A subscription
 * isn't that - it's a live channel that starts, may silently reconnect,
 * and needs a teardown function. There's no single result to report.
 */
import { Realtime } from 'appwrite';
import { AppState, type AppStateStatus } from 'react-native';
import client, { config } from './appwrite';
import type { Order, ShopperStatus, CustomerArrival } from '../types';

const realtime = new Realtime(client);

export type Unsubscribe = () => void;

/**
 * WHY A LOCAL EVENT TYPE INSTEAD OF THE SDK'S OWN RealtimeResponseEvent?
 * The installed SDK (appwrite@21.5.0) ships two different type
 * declarations both named RealtimeResponseEvent (one under
 * types/client.d.ts, one under types/services/realtime.d.ts) that
 * disagree on the shape of `timestamp` - Realtime.subscribe()'s own
 * signature can't be satisfied by the type it publicly re-exports from
 * the package root, which breaks generic inference on any typed
 * callback. Defining our own minimal shape here (verified against the
 * real payloads received in the Phase 0 spike) sidesteps that SDK-level
 * inconsistency entirely.
 */
export interface RealtimeEvent<T> {
  events: string[];
  channels: string[];
  timestamp: string;
  payload: T;
}

const ordersChannel = `databases.${config.databaseId}.collections.${config.ordersCollectionId}.documents`;
const shopperStatusChannel = `databases.${config.databaseId}.collections.${config.shopperStatusCollectionId}.documents`;
const customerArrivalsChannel = `databases.${config.databaseId}.collections.${config.customerArrivalsCollectionId}.documents`;

const subscribeToChannel = <T>(
  channel: string,
  callback: (event: RealtimeEvent<T>) => void
): Unsubscribe => {
  const subscriptionPromise = realtime.subscribe(channel, (event) => {
    callback(event as unknown as RealtimeEvent<T>);
  });
  let closed = false;

  return () => {
    if (closed) {
      return;
    }
    closed = true;
    subscriptionPromise
      .then((subscription) => subscription.close())
      .catch((error) => {
        console.error('Error closing realtime subscription:', error);
      });
  };
};

export const subscribeToOrders = (
  callback: (event: RealtimeEvent<Order>) => void
): Unsubscribe => subscribeToChannel(ordersChannel, callback);

export const subscribeToShopperStatus = (
  callback: (event: RealtimeEvent<ShopperStatus>) => void
): Unsubscribe => subscribeToChannel(shopperStatusChannel, callback);

export const subscribeToCustomerArrivals = (
  callback: (event: RealtimeEvent<CustomerArrival>) => void
): Unsubscribe => subscribeToChannel(customerArrivalsChannel, callback);

export const isCreateEvent = (event: RealtimeEvent<unknown>): boolean =>
  event.events.some((e) => e.endsWith('.create'));

export const isUpdateEvent = (event: RealtimeEvent<unknown>): boolean =>
  event.events.some((e) => e.endsWith('.update'));

export const isDeleteEvent = (event: RealtimeEvent<unknown>): boolean =>
  event.events.some((e) => e.endsWith('.delete'));

/**
 * Fires once on initial socket connect and again after every automatic
 * reconnect (network drop). Appwrite Realtime does not replay events
 * missed while disconnected, so callers register this to re-run their
 * normal fetch-based baseline as a reconcile step - the exact fetch
 * they already do on mount, just re-triggered.
 *
 * WHY IS THIS SAFE TO CALL ONLY FROM A ONCE-PER-SESSION MOUNT?
 * The underlying SDK's onOpen() has no matching "unregister" method -
 * it only ever pushes callbacks into an array. ShopperAssignmentContext
 * and CustomerOrderContext each mount exactly once per session, so
 * registering here once is fine. A screen that mounts/unmounts on every
 * visit (ShoppingScreen, OrderDetailScreen, the focus-based list
 * screens) must NOT call this - repeated mounts would leak callbacks
 * that keep firing for a screen that's long gone. Those screens instead
 * rely on their own existing mount-time fetch as their reconcile step.
 */
export const onRealtimeReconnect = (callback: () => void): void => {
  realtime.onOpen(callback);
};

/**
 * Backstop for RN backgrounding: fires the given callback whenever the
 * app returns to the foreground, regardless of what the underlying
 * WebSocket's own close/reconnect handling did while backgrounded - its
 * internal state isn't exposed to check from here, so this just always
 * re-reconciles on resume rather than trying to guess if it's needed.
 */
export const onAppForeground = (callback: () => void): Unsubscribe => {
  let previousState: AppStateStatus = AppState.currentState;

  const subscription = AppState.addEventListener('change', (nextState) => {
    if (previousState !== 'active' && nextState === 'active') {
      callback();
    }
    previousState = nextState;
  });

  return () => subscription.remove();
};
