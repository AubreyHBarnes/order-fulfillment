/**
 * OnMyWayCard
 * File: src/components/customer/OnMyWayCard.tsx
 *
 * Lets a pickup customer share their location while the app is open. The
 * server decides when they're close enough to this store and creates the
 * arrival itself; "I've Arrived" stays as the manual fallback.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { beginTrip, TripHandle } from '../../services/tripReporter';
import { geolocationSource, requestLocationPermission } from '../../services/geolocationSource';

interface Props {
  orderId: string;
  /** Called when the server auto-checks the customer in. */
  onArrived: () => void;
}

type State = 'idle' | 'starting' | 'sharing' | 'error';

const OnMyWayCard: React.FC<Props> = ({ orderId, onArrived }) => {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const trip = useRef<TripHandle | null>(null);

  // Leaving the screen ends the trip so the server isn't left waiting on a customer who stopped reporting.
  useEffect(() => () => void trip.current?.stop(), []);

  const start = async () => {
    setState('starting');
    if (!(await requestLocationPermission())) {
      setMessage('Location permission is needed to share your location.');
      setState('error');
      return;
    }
    const res = await beginTrip(orderId, geolocationSource, () => {
      trip.current = null;
      setState('idle');
      onArrived();
    });
    if ('error' in res) {
      setMessage(res.error);
      setState('error');
      return;
    }
    trip.current = res;
    setState('sharing');
  };

  const stop = async () => {
    const t = trip.current;
    trip.current = null;
    setState('idle');
    await t?.stop();
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">On my way</Text>
        <Text variant="bodyMedium" style={styles.body}>
          {state === 'sharing'
            ? 'Sharing your location. Staff are notified automatically when you reach the pickup area. Keep the app open.'
            : 'Share your location and we will let staff know when you reach the pickup area.'}
        </Text>
        {state === 'error' && <Text style={styles.error}>{message}</Text>}
        {state === 'sharing' ? (
          <Button mode="outlined" onPress={stop}>Stop sharing</Button>
        ) : (
          <Button mode="contained" onPress={start} loading={state === 'starting'} disabled={state === 'starting'}>
            I'm on my way
          </Button>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16 },
  body: { marginVertical: 8 },
  error: { color: '#B00020', marginBottom: 8 },
});

export default OnMyWayCard;
