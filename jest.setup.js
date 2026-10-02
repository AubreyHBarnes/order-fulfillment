/* eslint-env jest */
// AsyncStorage is a native module, which doesn't exist under Jest (plain
// Node, no Android/iOS runtime) - swap in the JS mock the library ships.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
