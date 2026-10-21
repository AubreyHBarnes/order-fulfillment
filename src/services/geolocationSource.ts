/**
 * Foreground LocationSource backed by @react-native-community/geolocation.
 * File: src/services/geolocationSource.ts
 *
 * Only delivers readings while the app is open (no background service);
 * swap this for a background source later without touching tripReporter.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { LocationSource } from './tripReporter';

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false; // ponytail: Android only, iOS out of scope
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export const geolocationSource: LocationSource = {
  subscribe(onReading) {
    const id = Geolocation.watchPosition(
      (pos) =>
        onReading({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed : undefined,
          isMock: (pos as { mocked?: boolean }).mocked,
        }),
      (err) => console.warn('Location error:', err.message),
      { enableHighAccuracy: true, distanceFilter: 0 }
    );
    return () => Geolocation.clearWatch(id);
  },
};
