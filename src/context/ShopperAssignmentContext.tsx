/**
 * Shopper Assignment Context
 * File: src/context/ShopperAssignmentContext.tsx
 *
 * PURPOSE:
 * Watches a shopper's own status while they're anywhere in the shopper
 * navigation stack (Dashboard, TaskDetail, AvailableTasks, etc.), and
 * surfaces it when their current order was interrupted for a rush order,
 * or when a brand new order auto-assigns while they're sitting idle -
 * so they find out live instead of only the next time they happen to
 * revisit the Dashboard screen (the only place data refreshes today,
 * via useFocusEffect). Also surfaces a customer arrival
 * (ArrivalNotificationModal) targeted at whichever specific shopper the
 * order's hand-off is currently addressed to (Order.shopperID) - the
 * same accept/decline shape as a new assignment, not a store-wide
 * notice; see docs/DECISIONS.md's arrival hand-off entry for the full
 * design (an initial store-wide-toast build of this was corrected once
 * the intended behavior - one targeted shopper, a timeout, reassignment
 * on no response - was clarified).
 *
 * WHY DOES "NEW ORDER ASSIGNED" LIVE HERE RATHER THAN ON THE DASHBOARD?
 * An order can land on a shopper in several ways - toggling Available
 * with a pending order waiting, a rush order pushed to an idle shopper,
 * a normal order auto-assigned at checkout time, or a released order
 * getting re-queued straight to whoever's free. Since the
 * auto-assignment Function (see docs/DECISIONS.md) now decides and
 * writes every one of those *asynchronously*, none of them can be
 * caught synchronously from within a single screen's own action handler
 * anymore - there's no "the assignment already happened by the time this
 * function returns" case left. This context's realtime subscription on
 * the shopper's own `shopperStatus` document (currentOrderId going from
 * empty to set) is the one place that catches all of them uniformly,
 * regardless of which screen the shopper happens to be on or what
 * triggered the assignment.
 *
 * This used to be two separate paths - this context's poll loop for the
 * "landed on an idle shopper" cases, plus ShopperDashboardScreen's own
 * instant modal for the "shopper's own toggle" case, needing an
 * `acknowledgeOwnAssignment` handshake so the two didn't both fire for
 * the same assignment. Once assignment moved fully server-side and
 * asynchronous, the dashboard's toggle stopped being able to get an
 * instant result at all, so that path (and the coordination it needed)
 * was removed - this context's subscription is now the only path.
 *
 * WHY REALTIME, NOT POLLING?
 * This used to be an 8s poll of getShopperStatus - see
 * docs/DECISIONS.md's realtime-migration entry for the Phase 0 spike
 * that verified Appwrite Realtime works correctly in this RN + Appwrite
 * Cloud setup, superseding the earlier "unverified territory" concern.
 * Three subscriptions replace the poll: subscribeToShopperStatus (own
 * shopperID) drives the currentOrderId-changed detection below;
 * subscribeToOrders backs the interrupt/new-assignment order lookups
 * and re-triggers the urgent-order check whenever a relevant order
 * changes; subscribeToCustomerArrivals drives ArrivalNotificationModal,
 * filtered (client-side, same as every other collection-wide
 * subscription in this app - see realtimeService.ts) down to arrivals
 * whose order is currently addressed to *this* shopper (see
 * handleArrivalEvent below). getNextOrderForAssignment() itself stays a
 * genuine query (not reconstructed from events) since it needs
 * whole-queue ordering, not a single document's state.
 *
 * WHY A CONTEXT, NOT A HOOK CALLED FROM EACH SCREEN?
 * The interrupt needs to be visible no matter which shopper screen is
 * open. A hook called per-screen would mean copy-pasting the polling
 * setup (and modal) into every one of them, and would restart polling
 * (losing the "haven't shown this yet" baseline) on every screen
 * change. Mounted once, above the whole ShopperStack navigator, this
 * runs continuously for as long as the shopper is logged in as a
 * shopper - see AppNavigator.tsx for where it's mounted.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getShopperStatus, updateShopperAvailability } from '../services/shopperStatusService';
import { getOrderById, getNextOrderForAssignment, releaseArrivalHandoff } from '../services/orderService';
import { getUserProfileById, getCustomerDisplayName } from '../services/userService';
import { updateArrivalStatus, recordArrivalDecline } from '../services/arrivalService';
import {
  subscribeToOrders,
  subscribeToShopperStatus,
  subscribeToCustomerArrivals,
  onRealtimeReconnect,
  onAppForeground,
  type RealtimeEvent,
} from '../services/realtimeService';
import OrderInterruptedModal from '../components/shopper/OrderInterruptedModal';
import UrgentOrderToast from '../components/shopper/UrgentOrderToast';
import NewAssignmentModal from '../components/shopper/NewAssignmentModal';
import ArrivalNotificationModal from '../components/shopper/ArrivalNotificationModal';
import type {
  Order,
  ShopperStatus,
  CustomerArrival,
  TaskCardData,
  ArrivalNotificationData,
  ShopperStackParamList,
} from '../types';

const formatDueTime = (scheduledReadyTime: string): string =>
  new Date(scheduledReadyTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

/**
 * WHY A LOCAL COPY OF THIS PARSER INSTEAD OF IMPORTING ONE?
 * ShopperDashboardScreen already has its own copy for the same reason
 * (see src/utils/orderItems.ts's own docblock) - this codebase keeps
 * these small per-file, rather than one shared module every screen
 * takes a dependency on for a two-line calculation.
 */
const parseItemCounts = (items: string): { itemCount: number; uniqueItemCount: number } => {
  if (!items || items.trim() === '') {
    return { itemCount: 0, uniqueItemCount: 0 };
  }

  const itemPairs = items.split(',').filter((item) => item.length > 0);
  let totalItems = 0;

  for (const pair of itemPairs) {
    const quantity = pair.split(':')[1] ?? '0';
    totalItems += parseInt(quantity, 10) || 0;
  }

  return { itemCount: totalItems, uniqueItemCount: itemPairs.length };
};

const generateShortOrderId = (orderId: string): string => orderId.slice(-8).toUpperCase();

/**
 * Build just enough TaskCardData to render NewAssignmentModal.
 *
 * WHY shopperName: '' AND pickedItemCount: 0?
 * NewAssignmentModal only ever reads shortOrderId, customerName,
 * uniqueItemCount, and dueTime from a task - shopperName and
 * pickedItemCount exist on the type for CurrentTaskCard's benefit, which
 * this TaskCardData never reaches. A freshly-assigned order also always
 * has empty pickedItems, so 0 is accurate anyway, not just a stand-in.
 */
const buildTaskCardData = (order: Order, customerName: string): TaskCardData => {
  const { itemCount, uniqueItemCount } = parseItemCounts(order.items);
  return {
    orderId: order.$id,
    shortOrderId: generateShortOrderId(order.$id),
    itemCount,
    uniqueItemCount,
    pickedItemCount: 0,
    customerName,
    shopperName: '',
    fulfillmentType: order.deliveryAddress.startsWith('PICKUP:') ? 'pickup' : 'delivery',
    dueTime: order.scheduledReadyTime ? formatDueTime(order.scheduledReadyTime) : undefined,
    status: order.status,
    isRush: order.priority === 1,
  };
};

interface ShopperAssignmentContextType {
  interruptedOrder: Order | null;
  dismissInterrupt: () => void;
  /**
   * Bumps whenever a pending assignment this context showed (poll-
   * detected, not the dashboard's own toggle-triggered one) is accepted
   * or declined - see the state declaration above for why the dashboard
   * needs this instead of relying on useFocusEffect.
   */
  assignmentResolvedSignal: number;
}

const ShopperAssignmentContext = createContext<ShopperAssignmentContextType | undefined>(
  undefined
);

interface ShopperAssignmentProviderProps {
  shopperId: string;
  children: ReactNode;
}

export const ShopperAssignmentProvider: React.FC<ShopperAssignmentProviderProps> = ({
  shopperId,
  children,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<ShopperStackParamList>>();

  const [interruptedOrder, setInterruptedOrder] = useState<Order | null>(null);

  /**
   * Due time to show in the non-blocking "more urgent order arrived"
   * toast - see poll() below. null both before anything's been found
   * and after the toast auto-dismisses.
   */
  const [urgentOrderDueTime, setUrgentOrderDueTime] = useState<string | null>(null);

  /**
   * A customer arrival currently addressed to *this* shopper, for
   * ArrivalNotificationModal - null before anything's been found and
   * after accept/decline. Unlike pendingAssignment below (also scoped
   * to this shopper, but via currentOrderId), this is matched by
   * checking the arrival's order's shopperID against this context's own
   * shopperId - see handleArrivalEvent.
   */
  const [pendingArrival, setPendingArrival] = useState<ArrivalNotificationData | null>(null);
  const [declineArrivalLoading, setDeclineArrivalLoading] = useState(false);

  /**
   * A new order that auto-assigned while the shopper was idle, not yet
   * started or declined. See buildTaskCardData for why the TaskCardData
   * here is intentionally partial.
   */
  const [pendingAssignment, setPendingAssignmentState] = useState<{
    order: Order;
    taskData: TaskCardData;
  } | null>(null);
  const [declineAssignmentLoading, setDeclineAssignmentLoading] = useState(false);

  /**
   * Bumped every time a pending assignment shown BY THIS CONTEXT (not
   * the dashboard's own toggle-triggered one) is accepted or declined.
   * ShopperDashboardScreen watches this to refetch its status/current
   * task display if it's the screen currently open - useFocusEffect
   * alone wouldn't catch this since no navigation occurred, the shopper
   * was sitting on Dashboard the whole time the popup was up.
   */
  const [assignmentResolvedSignal, setAssignmentResolvedSignal] = useState(0);

  /**
   * WHY A REF MIRROR OF pendingAssignment STATE?
   * poll() is defined once inside the effect below and closes over
   * whatever pendingAssignment was AT MOUNT TIME - state updates after
   * that don't change what the closure sees. The ref is what poll()
   * actually reads to decide "is a popup already showing", so it always
   * sees the current value.
   */
  const pendingAssignmentRef = useRef<{ order: Order; taskData: TaskCardData } | null>(null);

  const setPendingAssignment = (
    value: { order: Order; taskData: TaskCardData } | null
  ): void => {
    pendingAssignmentRef.current = value;
    setPendingAssignmentState(value);
  };

  /**
   * WHY REFS INSTEAD OF STATE FOR THE POLL LOOP'S OWN BOOKKEEPING?
   * These are read/written inside the interval's closure on every tick.
   * Using state here would need to be a useEffect dependency, tearing
   * down and recreating the interval on every single poll instead of
   * once per shopperId.
   */
  const lastKnownOrderIdRef = useRef<string | null>(null);
  const hasBaselineRef = useRef(false);

  /**
   * Which pending order's id the urgent-order toast was last shown for,
   * so the same order doesn't re-trigger the toast every 8s while it
   * sits unclaimed - only a genuinely different (still more urgent)
   * candidate fires again.
   */
  const lastNotifiedUrgentOrderIdRef = useRef<string | null>(null);

  /**
   * Which of the shopper's own orders the urgent-order baseline above
   * was established for. Whenever currentOrderId changes (swap, claim,
   * auto-assign after completing one, ...) this no longer matches, so
   * the next poll re-baselines against whatever's already sitting in
   * the queue *silently* instead of alerting - the shopper picked (or
   * was given) this task with that queue state already visible/decided,
   * so it isn't "new". Only a candidate that shows up *after* that is a
   * genuine interrupt-worthy arrival.
   */
  const lastUrgentCheckOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    lastKnownOrderIdRef.current = null;
    hasBaselineRef.current = false;
    lastNotifiedUrgentOrderIdRef.current = null;
    lastUrgentCheckOrderIdRef.current = null;
    setPendingAssignment(null);

    /**
     * NEW ASSIGNMENT WHILE IDLE
     *
     * Was idle (no order), has one now, and nothing's already showing
     * for it. Catches every way an order can land on a shopper - a
     * rush push, a normal auto-assigned order landing on an
     * already-Available idle shopper, or the shopper's own toggle to
     * Available - all of it now happens asynchronously via the
     * auto-assignment Function, so this is the one path that catches
     * all of them (see the file header for why there's no longer a
     * separate synchronous path for the toggle case).
     */
    const checkNewAssignment = async (currentOrderId: string): Promise<void> => {
      if (pendingAssignmentRef.current) {
        return;
      }
      const newOrderResult = await getOrderById(currentOrderId);
      if (newOrderResult.success && newOrderResult.data) {
        const newOrder = newOrderResult.data;
        const customerResult = await getUserProfileById(newOrder.customerID);
        const customerName = getCustomerDisplayName(customerResult.data);
        setPendingAssignment({ order: newOrder, taskData: buildTaskCardData(newOrder, customerName) });
      }
    };

    /**
     * Their order changed underneath them - confirm it was actually an
     * interrupt (interruptedAt set) rather than assuming, since a
     * completed/cancelled order also clears currentOrderId.
     */
    const checkInterrupt = async (previousOrderId: string): Promise<void> => {
      const orderResult = await getOrderById(previousOrderId);
      if (orderResult.success && orderResult.data?.interruptedAt) {
        setInterruptedOrder(orderResult.data);
      }
    };

    /**
     * URGENT ORDER CHECK
     *
     * Only meaningful while the shopper is actively working an order -
     * compares the single most urgent pending order in the queue
     * (getNextOrderForAssignment, already sorted by scheduledReadyTime
     * ascending) against the shopper's own current order's due time.
     * A non-blocking toast, not the OrderInterruptedModal treatment -
     * nothing has happened to THIS shopper's order, they just might
     * not know something more urgent is sitting unclaimed.
     */
    const checkUrgentOrder = async (currentOrderId: string): Promise<void> => {
      const currentOrderResult = await getOrderById(currentOrderId);
      const currentOrder = currentOrderResult.success ? currentOrderResult.data : null;
      if (!currentOrder || (currentOrder.status !== 'assigned' && currentOrder.status !== 'shopping')) {
        return;
      }

      const nextResult = await getNextOrderForAssignment();
      const candidate = nextResult.success ? nextResult.data : null;
      const isMoreUrgent = !!candidate && candidate.scheduledReadyTime < currentOrder.scheduledReadyTime;

      if (lastUrgentCheckOrderIdRef.current !== currentOrderId) {
        // First check against this particular order (just swapped/claimed/
        // reopened onto it) - whatever's already sitting in the queue was
        // there when the shopper took this task, so record it as the
        // baseline without alerting.
        lastUrgentCheckOrderIdRef.current = currentOrderId;
        lastNotifiedUrgentOrderIdRef.current = isMoreUrgent ? candidate!.$id : null;
        return;
      }

      if (isMoreUrgent && candidate!.$id !== lastNotifiedUrgentOrderIdRef.current) {
        lastNotifiedUrgentOrderIdRef.current = candidate!.$id;
        setUrgentOrderDueTime(formatDueTime(candidate!.scheduledReadyTime));
      }
    };

    /**
     * Fetch-based baseline/reconcile - unchanged from the old poll()
     * body, just no longer run on a timer. Runs once on mount, and
     * again after any realtime reconnect or app-foreground event, since
     * Appwrite Realtime doesn't replay events missed while disconnected.
     */
    const fetchAndReconcile = async (): Promise<void> => {
      const statusResult = await getShopperStatus(shopperId);
      if (!statusResult.success || !statusResult.data) {
        return;
      }

      const currentOrderId = statusResult.data.currentOrderId || null;

      if (!hasBaselineRef.current) {
        // First fetch after mount just establishes the baseline - a
        // shopper who already has no order when they open the app
        // didn't just get interrupted, there's nothing to compare yet.
        lastKnownOrderIdRef.current = currentOrderId;
        hasBaselineRef.current = true;
        return;
      }

      const previousOrderId = lastKnownOrderIdRef.current;
      lastKnownOrderIdRef.current = currentOrderId;

      if (!previousOrderId && currentOrderId) {
        await checkNewAssignment(currentOrderId);
      }

      if (previousOrderId && previousOrderId !== currentOrderId) {
        await checkInterrupt(previousOrderId);
      }

      if (!currentOrderId) {
        lastUrgentCheckOrderIdRef.current = null;
        return;
      }

      await checkUrgentOrder(currentOrderId);
    };

    /**
     * Live path: one shopperStatus event at a time, applying the same
     * "currentOrderId changed" diff as fetchAndReconcile above. Guarded
     * on hasBaselineRef so an event that arrives before the initial
     * fetchAndReconcile() baseline completes doesn't get treated as a
     * transition from nothing.
     */
    const handleShopperStatusEvent = (event: RealtimeEvent<ShopperStatus>): void => {
      const status = event.payload;
      if (status.shopperID !== shopperId || !hasBaselineRef.current) {
        return;
      }

      const currentOrderId = status.currentOrderId || null;
      const previousOrderId = lastKnownOrderIdRef.current;
      if (previousOrderId === currentOrderId) {
        return;
      }
      lastKnownOrderIdRef.current = currentOrderId;

      if (!previousOrderId && currentOrderId) {
        checkNewAssignment(currentOrderId);
      }

      if (previousOrderId && previousOrderId !== currentOrderId) {
        checkInterrupt(previousOrderId);
      }

      if (currentOrderId) {
        checkUrgentOrder(currentOrderId);
      } else {
        lastUrgentCheckOrderIdRef.current = null;
      }
    };

    /**
     * Live path for the urgent-order comparison: re-runs
     * getNextOrderForAssignment() (a genuine query, not reconstructed
     * from this event) whenever an order event could plausibly change
     * who the most-urgent-pending candidate is - either a pending,
     * unassigned order changing (entering/leaving contention) or the
     * shopper's own current order itself changing (e.g. its due time,
     * though that's rare in practice).
     */
    const handleOrderEvent = (event: RealtimeEvent<Order>): void => {
      const order = event.payload;
      const currentOrderId = lastKnownOrderIdRef.current;
      if (!currentOrderId || !hasBaselineRef.current) {
        return;
      }

      const isCandidateChange = order.status === 'pending' && !order.shopperID;
      const isOwnOrder = order.$id === currentOrderId;
      if (isCandidateChange || isOwnOrder) {
        checkUrgentOrder(currentOrderId);
      }
    };

    /**
     * ARRIVAL HAND-OFF ADDRESSED TO THIS SHOPPER
     *
     * Fires on two distinct occasions, both handled identically: a
     * customer just tapped "I've Arrived" (a fresh CustomerArrival,
     * status 'waiting'), or a stuck arrival just got reassigned to this
     * shopper after the previous one didn't respond in time (an update
     * to the same document - notifiedShopperAt reset, status still
     * 'waiting' - see functions/auto-assignment). Either way, the
     * arrival's *order* is fetched to check whether this shopper is the
     * one currently addressed - CustomerArrival itself has no shopper
     * field, Order.shopperID is the only source of truth for who it's
     * for right now, and that can change over the arrival's lifetime.
     *
     * WHY NOT FILTER TO isCreateEvent LIKE THE ORIGINAL (store-wide
     * toast) BUILD DID?
     * A reassignment is an *update* to the same document, driven
     * server-side, not this shopper's own action - restricting to
     * create events would silently miss every reassignment landing on
     * a new shopper, which is the whole point of this mechanism.
     */
    const handleArrivalEvent = async (event: RealtimeEvent<CustomerArrival>): Promise<void> => {
      const arrival = event.payload;
      if (arrival.status !== 'waiting') {
        return;
      }
      const orderResult = await getOrderById(arrival.orderID);
      if (!orderResult.success || !orderResult.data || orderResult.data.shopperID !== shopperId) {
        return;
      }
      const customerResult = await getUserProfileById(arrival.customerID);
      setPendingArrival({
        arrivalId: arrival.$id,
        orderId: orderResult.data.$id,
        customerName: getCustomerDisplayName(customerResult.data),
        shortOrderId: generateShortOrderId(orderResult.data.$id),
        vehicleDescription: arrival.vehicleDescription,
        notes: arrival.notes,
      });
    };

    const unsubscribeStatus = subscribeToShopperStatus(handleShopperStatusEvent);
    const unsubscribeOrders = subscribeToOrders(handleOrderEvent);
    const unsubscribeArrivals = subscribeToCustomerArrivals(handleArrivalEvent);
    onRealtimeReconnect(fetchAndReconcile);
    const stopWatchingForeground = onAppForeground(fetchAndReconcile);

    fetchAndReconcile();

    return () => {
      unsubscribeStatus();
      unsubscribeOrders();
      unsubscribeArrivals();
      stopWatchingForeground();
    };
  }, [shopperId]);

  const dismissInterrupt = (): void => {
    setInterruptedOrder(null);
  };

  const dismissUrgentOrderToast = (): void => {
    setUrgentOrderDueTime(null);
  };

  /**
   * Accept the arrival hand-off: acknowledges it (status -> 'in_progress',
   * so it stays visible in Customer Check-ins - see arrivalService.ts's
   * getActiveArrivals) and navigates there so the shopper can complete
   * the physical hand-off ("Hand Off Order") once they've actually
   * brought the order out. Doesn't touch Order.shopperID - accepting
   * keeps this shopper as the one responsible, only declining or timing
   * out hands it to someone else.
   */
  const acceptArrival = async (): Promise<void> => {
    if (!pendingArrival) {
      return;
    }
    const result = await updateArrivalStatus(pendingArrival.arrivalId, 'in_progress');
    // WHY TREAT "could not be found" AS A SILENT NO-OP, NOT AN ALERT?
    // The arrival this modal is showing can stop existing out from under
    // it - completed/reassigned/deleted by something else while it was
    // up (a race this project's own rapid REST-driven test scripts hit
    // directly; a real customer's arrival won't normally vanish, but a
    // stale modal referencing a gone document is still a real
    // reachable state worth handling gracefully rather than surfacing a
    // raw Appwrite error). Any other failure (network, permissions)
    // still alerts normally.
    if (!result.success) {
      if (result.error?.includes('could not be found')) {
        setPendingArrival(null);
        return;
      }
      Alert.alert('Error', result.error ?? 'Failed to accept arrival');
      return;
    }
    setPendingArrival(null);
    navigation.navigate('CustomerCheckIns');
  };

  /**
   * Decline the arrival hand-off.
   *
   * WHY releaseArrivalHandoff(orderId) INSTEAD OF
   * updateShopperAvailability(shopperId, false) (NewAssignmentModal's
   * decline, and this modal's own "Unavailable" label)?
   * Labeled the same as NewAssignmentModal's decline for the same
   * reason - "not me right now" - but the underlying action has to be
   * narrower: unlike a fresh assignment (only ever shown to an idle
   * shopper with nothing else in flight), the shopper an arrival is
   * addressed to already finished shopping this order and could easily
   * be actively shopping a *different* one right now. Going through
   * updateShopperAvailability would also release that unrelated order
   * (see its own docstring) as a side effect of declining a drop-off -
   * not the intended behavior. releaseArrivalHandoff only clears this
   * one order's shopperID, leaving status and everything else about
   * this shopper's current work untouched; the auto-assignment
   * Function's `orders` update handler treats that the same way it
   * treats a released pending order - hands it to the next idle
   * shopper (see docs/DECISIONS.md's arrival hand-off entry).
   *
   * WHY recordArrivalDecline() BEFORE releaseArrivalHandoff(), AND WHY
   * AT ALL?
   * Declining doesn't mark this shopper unavailable (see above) - they
   * can easily still be sitting idle (isAvailable true, currentOrderId
   * empty) immediately after declining, which is exactly what
   * getNextAvailableShopper() looks for. Without recording who just
   * declined, the reassignment search could hand the same arrival
   * straight back to the same shopper who just said no to it. Recording
   * it first (awaited before releaseArrivalHandoff runs) guarantees the
   * auto-assignment Function sees declinedByShopperID already set by
   * the time the order's shopperID-cleared event reaches it.
   */
  const declineArrival = async (): Promise<void> => {
    if (!pendingArrival) {
      return;
    }
    setDeclineArrivalLoading(true);
    // Best-effort - if the arrival itself is already gone (see
    // acceptArrival's comment on the same failure mode), there's
    // nothing to stamp a decliner onto, but the order-side release
    // below should still be attempted regardless.
    await recordArrivalDecline(pendingArrival.arrivalId, shopperId);
    const result = await releaseArrivalHandoff(pendingArrival.orderId);
    if (!result.success && !result.error?.includes('could not be found')) {
      Alert.alert('Error', result.error ?? 'Failed to decline arrival');
    }
    setPendingArrival(null);
    setDeclineArrivalLoading(false);
  };

  /**
   * Start the pending order - the order's already assigned server-side
   * (whatever auto-assigned it wrote currentOrderId already), so there's
   * nothing left to call here. Whichever shopper screen is open will
   * pick it up next time it fetches (Dashboard's useFocusEffect, most
   * likely, since that's where "Current Task" lives).
   */
  const acceptPendingAssignment = (): void => {
    setPendingAssignment(null);
    setAssignmentResolvedSignal((n) => n + 1);
  };

  /**
   * Decline the pending order.
   *
   * WHY CALL updateShopperAvailability(shopperId, false) INSTEAD OF NEW
   * LOGIC?
   * The shopper's status doc already has currentOrderId set to this
   * order (the auto-assignment Function already wrote it) - flipping
   * isAvailable to false produces the same `shopperStatus` update event
   * the Function reacts to for any other "went unavailable while
   * holding an order" case, releasing it back to the queue and
   * re-checking whether it's now the most urgent pending order. No new
   * logic needed here for decline specifically.
   */
  const declinePendingAssignment = async (): Promise<void> => {
    setDeclineAssignmentLoading(true);
    const result = await updateShopperAvailability(shopperId, false);

    if (result.success) {
      lastKnownOrderIdRef.current = null;
    } else {
      Alert.alert('Error', result.error ?? 'Failed to decline assignment');
    }

    setPendingAssignment(null);
    setDeclineAssignmentLoading(false);
    setAssignmentResolvedSignal((n) => n + 1);
  };

  return (
    <ShopperAssignmentContext.Provider
      value={{
        interruptedOrder,
        dismissInterrupt,
        assignmentResolvedSignal,
      }}
    >
      {children}
      <OrderInterruptedModal
        visible={!!interruptedOrder}
        order={interruptedOrder}
        onDismiss={dismissInterrupt}
      />
      <UrgentOrderToast
        visible={!!urgentOrderDueTime}
        dueTime={urgentOrderDueTime}
        onDismiss={dismissUrgentOrderToast}
      />
      <NewAssignmentModal
        visible={!!pendingAssignment}
        task={pendingAssignment?.taskData ?? null}
        onAccept={acceptPendingAssignment}
        onDecline={declinePendingAssignment}
        declineLoading={declineAssignmentLoading}
      />
      <ArrivalNotificationModal
        visible={!!pendingArrival}
        arrival={pendingArrival}
        onAccept={acceptArrival}
        onDecline={declineArrival}
        declineLoading={declineArrivalLoading}
      />
    </ShopperAssignmentContext.Provider>
  );
};

export const useShopperAssignment = (): ShopperAssignmentContextType => {
  const context = useContext(ShopperAssignmentContext);
  if (!context) {
    throw new Error('useShopperAssignment must be used within a ShopperAssignmentProvider');
  }
  return context;
};
