import { beforeEach, describe, expect, test, vi } from 'vitest';

import { SENTRY_DENY_URLS_WEB, SENTRY_IGNORE_ERRORS } from '@tloncorp/shared';

const { scope, init, withScope, captureException, captureEvent, setUser } =
  vi.hoisted(() => {
    const scope: {
      addBreadcrumb: ReturnType<typeof vi.fn>;
      setLevel: ReturnType<typeof vi.fn>;
      setTags: ReturnType<typeof vi.fn>;
      setExtras: ReturnType<typeof vi.fn>;
    } = {
      addBreadcrumb: vi.fn(),
      setLevel: vi.fn(),
      setTags: vi.fn(),
      setExtras: vi.fn(),
    };
    return {
      scope,
      init: vi.fn(),
      withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
      captureException: vi.fn(),
      captureEvent: vi.fn(),
      setUser: vi.fn(),
    };
  });

vi.mock('@sentry/react', () => ({
  init,
  withScope,
  captureException,
  captureEvent,
  setUser,
}));

vi.mock('@tloncorp/app/lib/envVars', () => ({
  SENTRY_DSN: 'dsn',
  SENTRY_ENVIRONMENT: 'canary',
}));

vi.mock('../../../packages/shared/src/transcription', () => ({}));
vi.mock('expo-file-system', () => ({ File: class {} }));
vi.mock('expo-image-manipulator', () => ({
  SaveFormat: {},
  manipulateAsync: vi.fn(),
}));

import { createSentryErrorLogger } from './sentry';
import {
  currentHosting,
  initSentry,
  resolveEnvironment,
} from './sentry-bootstrap';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveEnvironment', () => {
  test('dev builds report development', () => {
    expect(resolveEnvironment(true, 'canary')).toBe('development');
  });

  test('configured environment wins in non-dev builds', () => {
    expect(resolveEnvironment(false, 'canary')).toBe('canary');
  });

  test('falls back to production when unconfigured', () => {
    expect(resolveEnvironment(false, '')).toBe('production');
  });
});

test('currentHosting returns local when window is undefined', () => {
  expect(currentHosting()).toBe('local');
});

describe('initSentry', () => {
  test('initialises with scrubbing and filtering options', () => {
    initSentry();

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0];
    expect(options.environment).toBe('development');
    expect(options.initialScope.tags.platform).toBe('web');
    expect(options.ignoreErrors).toBe(SENTRY_IGNORE_ERRORS);
    expect(options.denyUrls).toBe(SENTRY_DENY_URLS_WEB);

    const event = options.beforeSend({
      request: {
        url: 'https://x.tlon.network/apps/groups/dm/~zod',
        headers: { a: '1' },
      },
    });
    expect(event.request.url).toBe('https://tlon/dm');
    expect('headers' in event.request).toBe(false);

    expect(
      options.beforeBreadcrumb({ category: 'console', message: 'x' })
    ).toBeNull();
  });
});

describe('createSentryErrorLogger', () => {
  test('captures exceptions with tags and scrubbed extras', () => {
    const err = new Error('boom');
    createSentryErrorLogger().capture('app_error', {
      errorObject: err,
      logger: 'sync',
      errorTitle: 'x',
      message: '[sync] x',
      channelId: 'c',
    });

    expect(captureException).toHaveBeenCalledWith(err);
    expect(scope.setTags).toHaveBeenCalledWith({ logger: 'sync' });
    const extras = scope.setExtras.mock.calls[0][0];
    expect(extras.channelId).toBe('c');
    expect('errorObject' in extras).toBe(false);
  });

  test('captures messages with a stable fingerprint', () => {
    createSentryErrorLogger().capture('app_error', {
      logger: 'urbit',
      errorTitle: 'y',
      message: '[urbit] y',
    });

    expect(captureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '[urbit] y',
        fingerprint: ['app_error', 'urbit', 'y'],
      })
    );
    expect(captureException).not.toHaveBeenCalled();
  });

  test('attaches reduced breadcrumbs from the error-time snapshot', () => {
    createSentryErrorLogger().capture('app_error', {
      logger: 'urbit',
      errorTitle: 'z',
      message: '[urbit] z',
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

  test('adds no breadcrumbs when data.breadcrumbs is absent', () => {
    createSentryErrorLogger().capture('app_error', {
      logger: 'urbit',
      errorTitle: 'z',
      message: '[urbit] z',
    });

    expect(scope.addBreadcrumb).not.toHaveBeenCalled();
  });
});
