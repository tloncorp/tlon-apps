import { beforeEach, expect, test, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).__DEV__ = true;
});

const { scope, captureException, captureEvent, withScope } = vi.hoisted(() => {
  const scope = {
    addBreadcrumb: vi.fn(),
    setLevel: vi.fn(),
    setTags: vi.fn(),
    setExtras: vi.fn(),
    setFingerprint: vi.fn(),
  };
  return {
    scope,
    captureException: vi.fn(),
    captureEvent: vi.fn(),
    withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
  };
});

vi.mock('@sentry/react-native', () => ({
  withScope,
  captureException,
  captureEvent,
}));

const { getConfiguredShipUrl } = vi.hoisted(() => ({
  getConfiguredShipUrl: vi.fn<[], string | null>(() => null),
}));

// The real api barrel pulls in native modules; only the ship-url accessor is
// needed here, to classify where a hostless request failure happened.
vi.mock('@tloncorp/api', () => ({ getConfiguredShipUrl }));

// Load only the shared modules under test; the shared root index pulls in
// expo/native modules that cannot load in a node test environment.
vi.mock('@tloncorp/shared', async () => {
  const debug = await vi.importActual('@tloncorp/shared/debug');
  const errorReporting = await vi.importActual(
    '../../shared/src/errorReporting'
  );
  return { ...(debug as object), ...(errorReporting as object) };
});

import { useDebugStore } from '@tloncorp/shared';

import { createSentryErrorLogger } from './sentry';

beforeEach(() => {
  vi.clearAllMocks();
  useDebugStore.setState({ debugBreadcrumbs: [] });
});

test('exception path captures the Error instance with tags and extras', () => {
  const logger = createSentryErrorLogger();
  const error = new Error('boom');

  logger.capture('app_error', {
    logger: 'test-logger',
    errorTitle: 'boom',
    errorObject: error,
    customKey: 'custom-value',
  });

  expect(captureException).toHaveBeenCalledTimes(1);
  expect(captureException.mock.calls[0][0]).toBe(error);
  expect(captureEvent).not.toHaveBeenCalled();
  expect(scope.setTags).toHaveBeenCalledWith({ logger: 'test-logger' });
  const extras = scope.setExtras.mock.calls[0][0];
  expect(extras).not.toHaveProperty('errorObject');
  expect(extras.customKey).toBe('custom-value');
});

test('message path captures an event with message and fingerprint', () => {
  const logger = createSentryErrorLogger();

  logger.capture('app_error', {
    logger: 'test-logger',
    errorTitle: 'Something failed',
  });

  expect(captureException).not.toHaveBeenCalled();
  expect(captureEvent).toHaveBeenCalledWith({
    message: '[test-logger] Something failed',
    level: 'error',
    fingerprint: ['app_error', 'test-logger', 'Something failed'],
  });
});

test('breadcrumbs are added with URLs reduced', () => {
  const logger = createSentryErrorLogger();

  logger.capture('app_error', {
    logger: 'test-logger',
    breadcrumbs: ['[t] saw https://a.tlon.network/apps/groups/invite/tok'],
  });

  expect(scope.addBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining({
      category: 'app',
      message: '[t] saw https://tlon/invite',
      timestamp: expect.any(Number),
    })
  );
});

test('no breadcrumbs are added when data.breadcrumbs is absent', () => {
  const logger = createSentryErrorLogger();

  logger.capture('app_error', { logger: 'test-logger' });

  expect(scope.addBreadcrumb).not.toHaveBeenCalled();
});

test('hostless request failures are classified by the configured ship url', () => {
  getConfiguredShipUrl.mockReturnValue('https://malnev-pinlug.tlon.network');
  const logger = createSentryErrorLogger();
  const error = new Error('HTTP 502: [object Response]');
  error.name = 'BadResponseError';

  logger.capture('Sync Error', { logger: 'sync', errorObject: error });

  expect(scope.setTags).toHaveBeenCalledWith({
    logger: 'sync',
    http_status: '502',
    hosting: 'tlon',
  });
  expect(scope.setFingerprint).toHaveBeenCalledWith([
    '{{ default }}',
    'http',
    '502',
    'tlon',
  ]);
});

test('unrelated exceptions get no hosting tag or http fingerprint', () => {
  getConfiguredShipUrl.mockReturnValue('https://malnev-pinlug.tlon.network');
  const logger = createSentryErrorLogger();

  logger.capture('Boom', { logger: 'sync', errorObject: new Error('boom') });

  expect(scope.setTags).toHaveBeenCalledWith({ logger: 'sync' });
  expect(scope.setFingerprint).not.toHaveBeenCalled();
});
