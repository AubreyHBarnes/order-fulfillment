module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // These libraries ship untranspiled ES modules; let Babel transform them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-paper|react-native-vector-icons|@react-native-vector-icons|react-native-safe-area-context|react-native-screens|appwrite)/)',
  ],
};
