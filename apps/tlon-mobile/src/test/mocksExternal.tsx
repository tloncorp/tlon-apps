// Mocks for third-party dependencies which do not work as __mocks__/* files
import { jest } from '@jest/globals';
import 'react-native-gesture-handler/jestSetup';
import RNSafeAreaContextMock from 'react-native-safe-area-context/jest/mock';

// react-native-reanimated v4 removed `setUpTests`; use the bundled jest mock instead.
// Loads as `react-native-reanimated/mock` (no JSI-bound modules) so tests run under Node.
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

// Gesture handler passes worklets' UI runtime to its native module as it loads.
// Under jest, worklets resolves to its web build, where that call throws.
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual<object>('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
}));

// TODO: Why is `doMock` necessary? Why doesn't `require`ing inline work?
jest.doMock('react-native-safe-area-context', () => RNSafeAreaContextMock);

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(async () => ''),
  setStringAsync: jest.fn(async () => {}),
  hasStringAsync: jest.fn(async () => false),
  getImageAsync: jest.fn(async () => null),
  hasImageAsync: jest.fn(async () => false),
  setImageAsync: jest.fn(async () => {}),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-firebase/crashlytics', () => {
  return () => ({
    isCrashlyticsCollectionEnabled: false,
    checkForUnsentReports: jest.fn(),
    deleteUnsentReports: jest.fn(),
    didCrashOnPreviousExecution: jest.fn(),
    crash: jest.fn(),
    log: jest.fn(),
    recordError: jest.fn(),
    sendUnsentReports: jest.fn(),
    setUserId: jest.fn(),
    setAttribute: jest.fn(),
    setAttributes: jest.fn(),
    setCrashlyticsCollectionEnabled: jest.fn(),
  });
});
