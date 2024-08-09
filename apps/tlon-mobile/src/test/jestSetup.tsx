import type { OPSQLiteConnection } from '@op-engineering/op-sqlite';
import mockClipboard from '@react-native-clipboard/clipboard/jest/clipboard-mock.js';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

import { OPSQLite$SQLiteConnection } from '../lib/__mocks__/opsqliteConnection';
import './mockDb';

jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
require('react-native-reanimated').setUpTests();

// TODO: probably don't need `doMock`, but we do need to import the mock(?)
jest.doMock('../lib/opsqliteConnection', () => ({ OPSQLite$SQLiteConnection }));

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('@react-native-clipboard/clipboard', () => mockClipboard);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// https://github.com/react-native-webview/react-native-webview/issues/2959#issuecomment-1695757917
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const WebView = (props: any) => <View {...props} />;

  return {
    WebView,
    default: WebView,
    __esModule: true,
  };
});

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

jest.mock('react-native-branch', () => ({
  __esModule: true,
  default: {
    subscribe: jest.fn(() => {
      // return an unsubscribe mock
      return jest.fn();
    }),
    disableTracking: jest.fn(),
  },
}));

// https://github.com/OP-Engineering/op-sqlite/issues/98#issuecomment-2122820151
jest.mock('@op-engineering/op-sqlite', () => {
  const mockedConnection: OPSQLiteConnection = {
    close: jest.fn(),
    delete: jest.fn(),
    attach: jest.fn(),
    detach: jest.fn(),
    transaction: jest.fn(),
    execute: jest.fn(),
    executeAsync: jest.fn(),
    executeBatch: jest.fn(),
    executeBatchAsync: jest.fn(),
    loadFile: jest.fn(),
    updateHook: jest.fn(),
    commitHook: jest.fn(),
    rollbackHook: jest.fn(),
    prepareStatement: jest.fn(),
    loadExtension: jest.fn(),
    executeRawAsync: jest.fn(),
    getDbPath: jest.fn(),
  };

  return {
    open: jest.fn(() => mockedConnection),
    isSQLCipher: jest.fn(),
    moveAssetsDatabase: jest.fn(),
  };
});

// jest.mock('react-native', () => {
//   const RN = jest.requireActual('react-native');

//   console.debug(
//     'mocking',
//     RN.NativeModules.SettingsManager,
//     typeof RN.NativeModules.SettingsManager,
//     RN,
//     typeof RN
//   );
//   const ProxiedSettingsManager = new Proxy(
//     RN.NativeModules.SettingsManager ?? {},
//     {
//       get(target, prop, receiver) {
//         if (prop === 'settings') {
//           return {
//             AppleLocale: 'en-US',
//             AppleLanguages: ['fr-FR', 'en-US'],
//           };
//         }
//         return Reflect.get(target, prop, receiver);
//       },
//     }
//   );
//   RN.NativeModules.SettingsManager = ProxiedSettingsManager;

//   const ProxiedRN = new Proxy(RN, {
//     get(target, prop, receiver) {
//       if (prop === 'Settings') {
//         return {
//           get: jest.fn(),
//           set: jest.fn(),
//           watchKeys: jest.fn(),
//         };
//       }
//       return Reflect.get(target, prop, receiver);
//     },
//   });

//   return ProxiedRN;
// });
