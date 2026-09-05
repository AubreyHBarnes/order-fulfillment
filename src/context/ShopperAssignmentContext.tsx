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
 * via useFocusEffect).
 *
 * WHY DOES "NEW ORDER ASSIGNED" ALSO NEED TO LIVE HERE, NOT JUST ON THE
 * DASHBOARD?
 * ShopperDashboardScreen already shows NewAssignmentModal instantly when
 * toggling to Available auto-assigns an order - that's a synchronous
 * result of the shopper's own action, no polling needed. But an order
 * can also land on an idle, already-Available shopper asynchronously -
 * a rush order pushed to them, or (since normal orders now auto-assign
 * to an idle shopper at checkout time too, see handleNewOrderPlacement)
 * any regular order placed while they happen to be free. Previously
 * there was no signal for this at all - the shopper would only notice
 * next time something refetched (e.g. navigating back to Dashboard).
 * This context's poll loop catches that transition and shows the same
 * modal, globally, the same way it already does for interrupts.
 *
 * WHY NOT JUST LET THE DASHBOARD'S OWN PATH HANDLE BOTH?
 * The dashboard's version only fires from within handleStatusChange,
 * synchronously - it has no way to notice an assignment that happens
 * while the shopper is on TaskDetail, AvailableTasks, or anywhere else.
 * Keeping both paths (instead of moving the toggle-triggered one here
 * too) avoids the toggle case losing its instant, no-poll-latency feel
 * and avoids ShopperDashboardScreen's `currentTask` losing its immediate
 * local update on accept. `acknowledgeOwnAssignment` (below) is the only
 * coordination needed between the two: the dashboard calls it right
 * after showing its own modal so this context's poll doesn't also flag
 * the same transition ~8s later as "new" and pop a duplicate.
 *
 * WHY POLLING, NOT APPWRITE REALTIME?
 * This app has zero realtime/live-update infrastructure anywhere -
 * everything else is fetch-on-focus. True push (Appwrite's Realtime
 * service, already an unused part of the installed `appwrite` SDK) was
 * considered, but the current Appwrite Cloud database-scoped channel
 * string format isn't documented anywhere in this installed SDK
 * version, and one of its code paths touches `window.localStorage`
 * without the guard the older client code has elsewhere - likely not a
 * global that exists in this React Native runtime. Polling reuses the
 * exact fetch (getShopperStatus) this app already calls elsewhere, with
 * zero new unknowns, at the cost of up-to-POLL_INTERVAL_MS latency
 * instead of instant push. See docs/DECISIONS.md for the full writeup;
 * Realtime is logged there as a deferred follow-up, not abandoned.
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
import { getShopperStatus, updateShopperAvailability } from '../services/shopperStatusService';
import { getOrderById, getNextOrderForAssignment } from '../services/orderService';
import { getUserProfileById, getCustomerDisplayName } from '../services/userService';
import OrderInterruptedModal from '../components/shopper/OrderInterruptedModal';
import UrgentOrderToast from '../components/shopper/UrgentOrderToast';
import NewAssignmentModal from '../components/shopper/NewAssignmentModal';
import type { Order, TaskCardData } from '../types';

const POLL_INTERVAL_MS = 8000;

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
   * Tell this context's poll loop "the shopper's currentOrderId just
   * changed to this because of something already handled elsewhere" (the
   * Dashboard's own instant toggle-triggered assignment modal) - so the
   * next poll tick doesn't also treat it as a brand new, unhandled
   * assignment and show a duplicate popup for the same order.
   */
  acknowledgeOwnAssignment: (orderId: string) => void;
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
  const [interruptedOrder, setInterruptedOrder] = useState<Order | null>(null);

  /**
   * Due time to show in the non-blocking "more urgent order arrived"
   * toast - see poll() below. null both before anything's been found
   * and after the toast auto-dismisses.
   */
  const [urgentOrderDueTime, setUrgentOrderDueTime] = useState<string | null>(null);

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

    const poll = async (): Promise<void> => {
      const statusResult = await getShopperStatus(shopperId);
      if (!statusResult.success || !statusResult.data) {
        return;
      }

      const currentOrderId = statusResult.data.currentOrderId || null;

      if (!hasBaselineRef.current) {
        // First poll after mount just establishes the baseline - a
        // shopper who already has no order when they open the app
        // didn't just get interrupted, there's nothing to compare yet.
        lastKnownOrderIdRef.current = currentOrderId;
        hasBaselineRef.current = true;
        return;
      }

      const previousOrderId = lastKnownOrderIdRef.current;
      lastKnownOrderIdRef.current = currentOrderId;

      /**
       * NEW ASSIGNMENT WHILE IDLE
       *
       * Was idle (no order) last poll, has one now, and nothing's
       * already showing for it (the dashboard's own instant path calls
       * acknowledgeOwnAssignment to cover itself - see that function).
       * This is what catches a rush push or a normal auto-assigned order
       * landing on an already-Available shopper with no toggle involved.
       */
      if (!previousOrderId && currentOrderId && !pendingAssignmentRef.current) {
        const newOrderResult = await getOrderById(currentOrderId);
        if (newOrderResult.success && newOrderResult.data) {
          const newOrder = newOrderResult.data;
          const customerResult = await getUserProfileById(newOrder.customerID);
          const customerName = getCustomerDisplayName(customerResult.data);
          setPendingAssignment({ order: newOrder, taskData: buildTaskCardData(newOrder, customerName) });
        }
      }

      if (previousOrderId && previousOrderId !== currentOrderId) {
        // Their order changed underneath them - confirm it was actually
        // an interrupt (interruptedAt set) rather than assuming, since a
        // completed/cancelled order also clears currentOrderId.
        const orderResult = await getOrderById(previousOrderId);
        if (orderResult.success && orderResult.data?.interruptedAt) {
          setInterruptedOrder(orderResult.data);
        }
      }

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
      if (!currentOrderId) {
        lastUrgentCheckOrderIdRef.current = null;
        return;
      }

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

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [shopperId]);

  const dismissInterrupt = (): void => {
    setInterruptedOrder(null);
  };

  const dismissUrgentOrderToast = (): void => {
    setUrgentOrderDueTime(null);
  };

  const acknowledgeOwnAssignment = (orderId: string): void => {
    lastKnownOrderIdRef.current = orderId;
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
   * WHY CALL updateShopperAvailability AGAIN INSTEAD OF NEW LOGIC?
   * Same reasoning as ShopperDashboardScreen's handleDeclineAssignment:
   * the shopper's status doc already has currentOrderId set to this
   * order (the auto-assign already wrote it), so calling
   * updateShopperAvailability(shopperId, false) walks the existing
   * "going unavailable while working an order" release/reassign branch -
   * no new backend logic needed.
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
        acknowledgeOwnAssignment,
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
