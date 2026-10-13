/**
 * Trip Reporter
 * File: src/services/tripReporter.ts
 *
 * Feeds a location source's readings to the server's reportLocation action
 * at a fixed minimum interval, and stops once the server says the customer
 * has arrived (or the trip is no longer active). The source is injected so
 * the location library is a separate choice (foreground watcher now, a
 * background service later) and this logic is testable without a device.
 */
import { endTrip, reportLocation, startTrip, LocationReading } from './functionActionService';

/** subscribe() starts delivering readings and returns the function that stops them. */
export interface LocationSource {
  subscribe(onReading: (reading: LocationReading) => void): () => void;
}

export interface TripHandle {
  tripId: string;
  /** Stop sharing and tell the server ("I'm not coming now"). */
  stop(): Promise<void>;
}

// ~60 executions per 15-minute drive; the dial between responsiveness and quota (see DECISIONS.md).
const REPORT_INTERVAL_MS = 15000;

export async function beginTrip(
  orderId: string,
  source: LocationSource,
  onArrived: () => void,
  now: () => number = Date.now
): Promise<TripHandle | { error: string }> {
  const started = await startTrip(orderId);
  const tripId = started.data?.tripId;
  if (!started.success || typeof tripId !== 'string') {
    return { error: started.error ?? 'Could not start sharing' };
  }

  let lastSentAt = 0;
  let inFlight = false;
  let done = false;
  const unsubscribe = source.subscribe(async (reading) => {
    // Drop readings that arrive faster than the interval or while a report is still pending.
    if (done || inFlight || now() - lastSentAt < REPORT_INTERVAL_MS) return;
    inFlight = true;
    lastSentAt = now();
    const res = await reportLocation(tripId, reading);
    inFlight = false;
    if (done) return;
    if (!res.success) {
      // A 409 means the trip ended or expired server-side; anything else is retried next interval.
      if (res.error?.includes('no longer active')) finish();
      return;
    }
    if (res.data?.arrived === true) {
      finish();
      onArrived();
    }
  });

  function finish() {
    done = true;
    unsubscribe();
  }

  return {
    tripId,
    stop: async () => {
      finish();
      await endTrip(tripId);
    },
  };
}
