/**
 * Customer Order Context
 * File: src/context/CustomerOrderContext.tsx
 *
 * PURPOSE:
 * Watches a customer's own in-flight orders while they're anywhere in
 * the main (customer) navigation stack, and surfaces a non-blocking
 * toast the moment one of them becomes ready_for_pickup - so they find
 * out live instead of only the next time they happen to reopen that
 * order's detail screen. See docs/DECISIONS.md's "Customer
 * ready-for-pickup notification" entry for the full scope this was
 * built from.
 *
 * WHY REALTIME, NOT POLLING?
 * This used to be an 8s poll of getOrdersByCustomerId - see
 * docs/DECISIONS.md's realtime-migration entry for why that was
 * replaced with a live subscription (via subscribeToOrders in
 * realtimeService.ts) once Realtime was empirically verified safe in
 * this RN + Appwrite Cloud setup. The initial fetch-based baseline
 * below is unchanged - it's still needed to seed the diff and to catch
 * anything that happened before this session's socket connected.
 *
 * WHY A PROVIDER MOUNTED ABOVE THE WHOLE MainStack, NOT A PER-SCREEN HOOK?
 * Directly mirrors ShopperAssignmentContext's reasoning: the toast
 * needs to be visible no matter which customer screen is open, and a
 * hook copy-pasted into every screen would restart polling (losing the
 * "already notified" baseline) on every screen change.
 *
 * WHY A MAP OF ORDER ID -> STATUS INSTEAD OF ONE "CURRENT ORDER" REF?
 * Unlike a shopper (who only ever has a single currentOrderId), a
 * customer isn't limited to one order in flight - they could plausibly
 * have several pending/assigned/shopping orders at once. Tracking a
 * snapshot per order id, rather than a single id, lets the diff catch
 * a transition on any of them.
 *
 * WHY NO React Context/useContext HERE, UNLIKE ShopperAssignmentContext?
 * Nothing outside this file needs to read this state (mirrors that
 * file's own unused interruptedOrder/dismissInterrupt export, minus
 * the unused part) - this is a provider component only, not a context
 * value other components consume.
 */

import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getOrdersByCustomerId } from '../services/orderService';
import {
  subscribeToOrders,
  onRealtimeReconnect,
  onAppForeground,
  isUpdateEvent,
  type RealtimeEvent,
} from '../services/realtimeService';
import OrderReadyToast from '../components/customer/OrderReadyToast';
import type { MainStackParamList, Order, OrderStatus } from '../types';

/**
 * Only orders that could still transition matter for this poll -
 * fetching completed/cancelled orders every tick would be wasted work
 * (see getOrdersByCustomerId's new `statuses` param).
 */
const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'assigned', 'shopping', 'ready_for_pickup'];

const getShortOrderId = (orderId: string): string => orderId.slice(-8).toUpperCase();

interface CustomerOrderProviderProps {
  customerId: string;
  children: ReactNode;
}

export const CustomerOrderProvider: React.FC<CustomerOrderProviderProps> = ({
  customerId,
  children,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const [readyOrderId, setReadyOrderId] = useState<string | null>(null);

  /**
   * WHY REFS INSTEAD OF STATE FOR THE POLL LOOP'S OWN BOOKKEEPING?
   * Same reasoning as ShopperAssignmentContext - read/written inside
   * the interval's closure every tick; state here would tear down and
   * recreate the interval on every poll instead of once per customerId.
   */
  const lastKnownStatusesRef = useRef<Record<string, OrderStatus>>({});
  const hasBaselineRef = useRef(false);

  useEffect(() => {
    lastKnownStatusesRef.current = {};
    hasBaselineRef.current = false;

    if (!customerId) return;

    /**
     * Fetch-based baseline/reconcile - unchanged from the old poll()
     * body, just no longer run on a timer. Runs once on mount, and
     * again after any realtime reconnect or app-foreground event, since
     * Appwrite Realtime doesn't replay events missed while disconnected.
     */
    const fetchAndReconcile = async (): Promise<void> => {
      const result = await getOrdersByCustomerId(customerId, ACTIVE_STATUSES);
      if (!result.success) return;

      const previous = lastKnownStatusesRef.current;
      const next: Record<string, OrderStatus> = {};
      let newlyReadyOrderId: string | null = null;

      for (const order of result.data) {
        next[order.$id] = order.status;

        // Only a genuine transition counts - an order already sitting
        // at ready_for_pickup (previous status also ready_for_pickup,
        // or first ever seen at that status) isn't "new".
        if (
          hasBaselineRef.current &&
          order.status === 'ready_for_pickup' &&
          previous[order.$id] &&
          previous[order.$id] !== 'ready_for_pickup'
        ) {
          newlyReadyOrderId = order.$id;
        }
      }

      lastKnownStatusesRef.current = next;

      if (!hasBaselineRef.current) {
        // First fetch after mount just establishes the baseline - a
        // customer opening the app to an order that's already been
        // ready for a while didn't just have that happen, there's
        // nothing to compare yet.
        hasBaselineRef.current = true;
        return;
      }

      if (newlyReadyOrderId) {
        setReadyOrderId(newlyReadyOrderId);
      }
    };

    /**
     * Live path: one order's event at a time, applying the exact same
     * "was it a different status before, now ready_for_pickup" diff as
     * fetchAndReconcile above, just fed a single payload instead of a
     * full list snapshot.
     *
     * WHY FILTER TO event.payload.customerID HERE?
     * Realtime pushes every customer's order events on this channel -
     * see realtimeService.ts's "no server-side filtering" note. This
     * callback discards everyone else's orders before touching state.
     */
    const handleOrderEvent = (event: RealtimeEvent<Order>): void => {
      const order = event.payload;
      if (order.customerID !== customerId || !isUpdateEvent(event)) {
        return;
      }

      const previousStatus = lastKnownStatusesRef.current[order.$id];
      lastKnownStatusesRef.current = {
        ...lastKnownStatusesRef.current,
        [order.$id]: order.status,
      };

      if (
        hasBaselineRef.current &&
        order.status === 'ready_for_pickup' &&
        previousStatus &&
        previousStatus !== 'ready_for_pickup'
      ) {
        setReadyOrderId(order.$id);
      }
    };

    const unsubscribe = subscribeToOrders(handleOrderEvent);
    onRealtimeReconnect(fetchAndReconcile);
    const stopWatchingForeground = onAppForeground(fetchAndReconcile);

    fetchAndReconcile();

    return () => {
      unsubscribe();
      stopWatchingForeground();
    };
  }, [customerId]);

  const dismiss = (): void => {
    setReadyOrderId(null);
  };

  const handleView = (): void => {
    if (readyOrderId) {
      navigation.navigate('OrderDetail', { orderId: readyOrderId });
    }
    setReadyOrderId(null);
  };

  return (
    <>
      {children}
      <OrderReadyToast
        visible={!!readyOrderId}
        shortOrderId={readyOrderId ? getShortOrderId(readyOrderId) : null}
        onDismiss={dismiss}
        onView={handleView}
      />
    </>
  );
};
