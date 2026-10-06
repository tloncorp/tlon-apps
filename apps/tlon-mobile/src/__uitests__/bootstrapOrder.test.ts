import { describe, expect, it, jest } from '@jest/globals';

// Prefixed with `mock` so jest's hoisting allows the factories below to close
// over it.
const mockOrder: string[] = [];

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(() => {
    mockOrder.push('sentry.init');
  }),
  withScope: jest.fn(),
  captureException: jest.fn(),
  captureEvent: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock('../App', () => {
  mockOrder.push('app-module');
  return { __esModule: true, default: () => null };
});

// The rest are entry-point side effects that either need native modules or do
// real work; none of them participate in the ordering under test.
jest.mock('expo', () => ({ registerRootComponent: jest.fn() }));
jest.mock('expo-dev-client', () => ({}));
jest.mock('@tamagui/native/setup-teleport', () => ({}));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('react-native-screens', () => ({
  featureFlags: { experiment: {} },
}));
jest.mock('react-native-reanimated', () => ({
  ReanimatedLogLevel: { warn: 'warn' },
  configureReanimatedLogger: jest.fn(),
}));
jest.mock('../lib/backgroundSync', () => ({
  initializeBackgroundSync: jest.fn(),
}));
jest.mock('../lib/notificationPresentation', () => ({
  shouldSuppressForegroundNotification: jest.fn(),
}));
jest.mock('../hooks/useDbReady', () => ({
  useDbReady: () => ({ dbInitError: null, isDbReady: false }),
}));
jest.mock('@tloncorp/app', () => ({ __esModule: true, default: {} }));
jest.mock('@tloncorp/app/RootErrorBoundary', () => ({
  RootErrorBoundary: ({ children }: { children: unknown }) => children,
}));
jest.mock('@tloncorp/app/lib/devMenuItems', () => ({}));
jest.mock('@tloncorp/app/lib/notifications', () => ({
  initializeNotifications: jest.fn(),
}));
jest.mock('@tloncorp/app/utils/posthog', () => ({}));
jest.mock('@tloncorp/app/ui', () => ({ setStorage: jest.fn() }));
jest.mock('@tloncorp/ui/config', () => ({ themes: { light: {} } }));
jest.mock('@tloncorp/shared', () => ({
  ...(jest.requireActual('@tloncorp/shared/debug') as object),
}));
jest.mock('@tloncorp/shared/db', () => ({
  appInfo: { getValue: jest.fn() },
}));

describe('entry bootstrap order', () => {
  it('installs telemetry before ./src/App evaluates', () => {
    jest.isolateModules(() => {
      require('../../index');
    });

    expect(mockOrder).toEqual(['sentry.init', 'app-module']);
  });
});
