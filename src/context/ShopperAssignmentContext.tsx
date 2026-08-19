/**
 * Shopper Assignment Context
 * File: src/context/ShopperAssignmentContext.tsx
 *
 * PURPOSE:
 * Watches a shopper's own status while they're anywhere in the shopper
 * navigation stack (Dashboard, TaskDetail, AvailableTasks, etc.), and
 * surfaces it when their current order was interrupted for a rush order
 * - so they find out live instead of only the next time they happen to
 * revisit the Dashboard screen (the only place data refreshes today,
 * via useFocusEffect).
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
import { getShopperStatus } from '../services/shopperStatusService';
import { getOrderById, getNextOrderForAssignment } from '../services/orderService';
import OrderInterruptedModal from '../components/shopper/OrderInterruptedModal';
import UrgentOrderToast from '../components/shopper/UrgentOrderToast';
import type { Order } from '../types';

const POLL_INTERVAL_MS = 8000;

const formatDueTime = (scheduledReadyTime: string): string =>
  new Date(scheduledReadyTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

interface ShopperAssignmentContextType {
  interruptedOrder: Order | null;
  dismissInterrupt: () => void;
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
   * candidate fires again. Reset whenever the shopper's own current
   * order changes (new task = fresh comparison baseline).
   */
  const lastNotifiedUrgentOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    lastKnownOrderIdRef.current = null;
    hasBaselineRef.current = false;
    lastNotifiedUrgentOrderIdRef.current = null;

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

      if (previousOrderId && previousOrderId !== currentOrderId) {
        // Their order changed underneath them - confirm it was actually
        // an interrupt (interruptedAt set) rather than assuming, since a
        // completed/cancelled order also clears currentOrderId.
        const orderResult = await getOrderById(previousOrderId);
        if (orderResult.success && orderResult.data?.interruptedAt) {
          setInterruptedOrder(orderResult.data);
        }
        // New task (or no task) - previous "already notified" tracking
        // no longer applies.
        lastNotifiedUrgentOrderIdRef.current = null;
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
        return;
      }

      const currentOrderResult = await getOrderById(currentOrderId);
      const currentOrder = currentOrderResult.success ? currentOrderResult.data : null;
      if (!currentOrder || (currentOrder.status !== 'assigned' && currentOrder.status !== 'shopping')) {
        return;
      }

      const nextResult = await getNextOrderForAssignment();
      const candidate = nextResult.success ? nextResult.data : null;

      if (
        candidate &&
        candidate.scheduledReadyTime < currentOrder.scheduledReadyTime &&
        candidate.$id !== lastNotifiedUrgentOrderIdRef.current
      ) {
        lastNotifiedUrgentOrderIdRef.current = candidate.$id;
        setUrgentOrderDueTime(formatDueTime(candidate.scheduledReadyTime));
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

  return (
    <ShopperAssignmentContext.Provider value={{ interruptedOrder, dismissInterrupt }}>
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
