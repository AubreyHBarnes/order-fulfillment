import type { CustomerArrival } from '../types';

/**
 * Should this realtime arrival event open the hand-off modal? One notice per
 * (arrival, notifiedShopperAt): a reconnect replay or unrelated update of the same
 * waiting arrival is skipped, while a server-side reassignment (which resets
 * notifiedShopperAt) is a new notice and shows again.
 */
export function isNewArrivalNotice(
  arrival: Pick<CustomerArrival, '$id' | 'notifiedShopperAt'>,
  seen: Set<string>
): boolean {
  const key = `${arrival.$id}:${arrival.notifiedShopperAt}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
