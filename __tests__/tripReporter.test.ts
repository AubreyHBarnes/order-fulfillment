jest.mock('../src/services/functionActionService', () => ({
  startTrip: jest.fn(),
  reportLocation: jest.fn(),
  endTrip: jest.fn(),
}));
import { beginTrip, LocationSource } from '../src/services/tripReporter';
import * as api from '../src/services/functionActionService';

const mocked = api as jest.Mocked<typeof api>;
const reading = { lat: 1, lng: 2, accuracy: 10 };

function fakeSource() {
  let cb: (r: typeof reading) => void = () => {};
  const unsubscribe = jest.fn();
  const source: LocationSource = { subscribe: (fn) => ((cb = fn), unsubscribe) };
  return { source, emit: (r = reading) => cb(r), unsubscribe };
}
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.resetAllMocks();
  mocked.startTrip.mockResolvedValue({ success: true, data: { ok: true, tripId: 't1' } });
  mocked.reportLocation.mockResolvedValue({ success: true, data: { ok: true, arrived: false } });
  mocked.endTrip.mockResolvedValue({ success: true });
});

test('throttles readings to the report interval', async () => {
  let t = 100000;
  const { source, emit } = fakeSource();
  await beginTrip('o1', source, jest.fn(), () => t);
  emit(); await flush();
  t += 5000; emit(); await flush(); // too soon
  t += 11000; emit(); await flush(); // 16s after the first
  expect(mocked.reportLocation).toHaveBeenCalledTimes(2);
});

test('stops listening and calls onArrived once the server reports arrival', async () => {
  mocked.reportLocation.mockResolvedValue({ success: true, data: { ok: true, arrived: true } });
  const { source, emit, unsubscribe } = fakeSource();
  const onArrived = jest.fn();
  await beginTrip('o1', source, onArrived, () => 100000);
  emit(); await flush();
  expect(onArrived).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalled();
});

test('stop() unsubscribes and ends the trip; a failed start returns the error', async () => {
  const { source, unsubscribe } = fakeSource();
  const handle = await beginTrip('o1', source, jest.fn());
  if ('error' in handle) throw new Error('expected a handle');
  await handle.stop();
  expect(unsubscribe).toHaveBeenCalled();
  expect(mocked.endTrip).toHaveBeenCalledWith('t1');

  mocked.startTrip.mockResolvedValue({ success: false, error: 'A trip is already active for this order' });
  expect(await beginTrip('o1', source, jest.fn())).toEqual({ error: 'A trip is already active for this order' });
});
