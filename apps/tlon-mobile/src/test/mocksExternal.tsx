// Mocks for third-party dependencies which do not work as __mocks__/* files
import { jest } from '@jest/globals';
import 'react-native-gesture-handler/jestSetup';
import RNSafeAreaContextMock from 'react-native-safe-area-context/jest/mock';

require('react-native-reanimated').setUpTests();

// TODO: Why is `doMock` necessary? Why doesn't `require`ing inline work?
jest.doMock('react-native-safe-area-context', () => RNSafeAreaContextMock);

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...require('@gorhom/bottom-sheet/mock'),
}));

// Silence the warning: Animated: `useNativeDriver` is not supported because the native animated module is missing
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('@react-native-clipboard/clipboard', () =>
  require('@react-native-clipboard/clipboard/jest/clipboard-mock.js')
);

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
