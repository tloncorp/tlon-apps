import { beforeEach, expect, test, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).__DEV__ = true;
});

vi.mock('@sentry/react-native', () => ({ captureException: vi.fn() }));

vi.mock('@react-native-firebase/crashlytics', () => ({
  default: () => ({ recordError: vi.fn(), log: vi.fn() }),
}));

vi.mock('./ui', () => ({ SizableText: () => null, View: () => null }));

// Load only the shared debug module; the shared root index pulls in
// expo/native modules that cannot load in a node test environment.
vi.mock('@tloncorp/shared', async () => {
  const debug = await vi.importActual('@tloncorp/shared/debug');
  return debug;
});

import * as Sentry from '@sentry/react-native';
import { useDebugStore } from '@tloncorp/shared';

import ErrorBoundary from './ErrorBoundary';

beforeEach(() => {
  vi.clearAllMocks();
  useDebugStore.setState({ debugBreadcrumbs: [] });
});

test('componentDidCatch reports through the error logger, not Sentry directly', async () => {
  const capture = vi.fn();
  useDebugStore.getState().initializeErrorLogger({ capture });

  const error = new Error('render failed');
  const boundary = new ErrorBoundary({ children: null });
  boundary.componentDidCatch(error, { componentStack: 'in X' } as any);

  await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
  const [event, payload] = capture.mock.calls[0];
  expect(event).toBe('app_error');
  expect(payload.errorObject).toBe(error);
  expect(payload.componentStack).toBe('in X');
  expect(Sentry.captureException).not.toHaveBeenCalled();
});
