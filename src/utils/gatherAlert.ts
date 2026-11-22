import type { Order } from '../types';

// Older than this is a replayed event (reconnect, app foreground), not a customer about to arrive.
const FRESH_MS = 2 * 60 * 1000;

/**
 * Should this realtime order update raise the one-time "customer is about a minute away" toast
 * for this shopper? Only for their own ready order, only once per order, only while it's fresh.
 */
export function isFreshGatherAlert(
  order: Pick<Order, '$id' | 'shopperID' | 'status' | 'gatherAlertAt'>,
  shopperId: string,
  seen: Set<string>,
  now: number = Date.now()
): boolean {
  if (!order.gatherAlertAt || order.status !== 'ready_for_pickup') return false;
  if (order.shopperID !== shopperId || seen.has(order.$id)) return false;
  return now - Date.parse(order.gatherAlertAt) < FRESH_MS;
}
