/* eslint-env jest */
// AsyncStorage is a native module, which doesn't exist under Jest (plain
// Node, no Android/iOS runtime) - swap in the JS mock the library ships.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The geolocation native module isn't linked under Jest.
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: { watchPosition: jest.fn(() => 1), clearWatch: jest.fn() },
}));
