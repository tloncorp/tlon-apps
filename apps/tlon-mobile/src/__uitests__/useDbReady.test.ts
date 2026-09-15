import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { ensureDbReady } from '@tloncorp/app/lib/nativeDb';
import { createDevLogger } from '@tloncorp/shared';
import { act } from 'react-test-renderer';

import { DbInitTimeoutError, useDbReady } from '../hooks/useDbReady';

jest.mock('@tloncorp/app/lib/nativeDb', () => ({
  ensureDbReady: jest.fn(),
}));

jest.mock('@tloncorp/shared', () => {
  // The hook grabs its logger at module scope, so the factory has to hand back
  // the same instance every call.
  const logger = {
    crumb: jest.fn(),
    trackError: jest.fn(),
    trackEvent: jest.fn(),
  };

  return {
    AnalyticsEvent: {
      DbReadyRetrySucceeded: 'DB Ready Retry Succeeded',
    },
    createDevLogger: () => logger,
  };
});

const ensureDbReadyMock = jest.mocked(ensureDbReady);
const logger = createDevLogger('db-ready', false) as unknown as {
  crumb: ReturnType<typeof jest.fn>;
  trackError: ReturnType<typeof jest.fn>;
  trackEvent: ReturnType<typeof jest.fn>;
};

function crumbs() {
  return logger.crumb.mock.calls.map((call) => call.join(' '));
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function hangingCall() {
  let settle: {
    resolve: () => void;
    reject: (error: unknown) => void;
  };

  ensureDbReadyMock.mockImplementationOnce(
    () =>
      new Promise<void>((resolve, reject) => {
        settle = { resolve, reject };
      })
  );

  return {
    resolve: () => settle.resolve(),
    reject: (error: unknown) => settle.reject(error),
  };
}

describe('useDbReady', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    ensureDbReadyMock.mockReset();
    logger.crumb.mockClear();
    logger.trackError.mockClear();
    logger.trackEvent.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('reports ready on the first attempt and leaves no timers behind', async () => {
    ensureDbReadyMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDbReady());
    await advance(0);

    expect(result.current.isDbReady).toBe(true);
    expect(result.current.dbInitError).toBeNull();
    expect(ensureDbReadyMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    // This is the first mount of the module's lifetime, so the retry-success
    // event must not fire.
    expect(logger.trackEvent).not.toHaveBeenCalled();
  });

  it('retries with backoff and succeeds on the third attempt', async () => {
    ensureDbReadyMock
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDbReady());
    await advance(0);

    expect(result.current.isDbReady).toBe(false);
    expect(ensureDbReadyMock).toHaveBeenCalledTimes(1);

    await advance(499);
    expect(result.current.isDbReady).toBe(false);

    await advance(1);
    expect(result.current.isDbReady).toBe(false);
    expect(ensureDbReadyMock).toHaveBeenCalledTimes(2);

    await advance(1000);
    expect(result.current.isDbReady).toBe(true);
    expect(result.current.dbInitError).toBeNull();
    expect(ensureDbReadyMock).toHaveBeenCalledTimes(3);

    expect(crumbs()).toEqual(
      expect.arrayContaining([
        'attempt 1 started',
        'attempt 1 failed: Error: first',
        'waiting 500ms before retry',
        'attempt 2 started',
        'attempt 2 failed: Error: second',
        'waiting 1000ms before retry',
        'attempt 3 started',
      ])
    );
  });

  it('surfaces the last error after three failures', async () => {
    const third = new Error('third');
    ensureDbReadyMock
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValueOnce(third);

    const { result } = renderHook(() => useDbReady());
    await advance(0);
    await advance(500);
    await advance(1000);

    expect(result.current.dbInitError).toBe(third);
    expect(result.current.dbInitError).not.toBeInstanceOf(DbInitTimeoutError);
    expect(result.current.isDbReady).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('times out when the first attempt never settles', async () => {
    const pending = hangingCall();

    const { result } = renderHook(() => useDbReady());
    await advance(29_999);

    expect(result.current.dbInitError).toBeNull();

    await advance(1);

    const error = result.current.dbInitError as DbInitTimeoutError;
    expect(error).toBeInstanceOf(DbInitTimeoutError);
    expect(error.name).toBe('DbInitTimeoutError');
    expect(error.message).toContain('30000ms');
    expect(error.message).toContain('attempt 1');
    expect(error.message).toContain('last error: none');
    expect(error.details.lastError).toBeNull();
    expect(error.details.attempt).toBe(1);
    expect(error.cause).toBeUndefined();
    expect(crumbs()).toContain('deadline fired on attempt 1');

    pending.resolve();
    await advance(0);

    expect(result.current.isDbReady).toBe(false);
  });

  it('carries the last rejection into the timeout when a later attempt hangs', async () => {
    const longMessage = 'x'.repeat(500);
    const truncated = `Error: ${longMessage}`.slice(0, 200);
    ensureDbReadyMock.mockRejectedValueOnce(new Error(longMessage));

    const { result } = renderHook(() => useDbReady());
    await advance(0);

    hangingCall();
    await advance(500);
    expect(ensureDbReadyMock).toHaveBeenCalledTimes(2);

    await advance(29_500);

    const error = result.current.dbInitError as DbInitTimeoutError;
    expect(error).toBeInstanceOf(DbInitTimeoutError);
    // Capped once at the source, so the crumb, the message and `details` --
    // all of which reach the same report -- carry the same string.
    expect(error.details.lastError).toBe(truncated);
    expect(error.details.lastError).toHaveLength(200);
    expect(error.message).toContain(`last error: ${truncated}`);
    expect(error.details.attempt).toBe(2);
    expect(crumbs()).toEqual(
      expect.arrayContaining([
        `attempt 1 failed: ${truncated}`,
        'attempt 2 started',
      ])
    );
  });

  it('ignores a rejection that lands after the deadline', async () => {
    ensureDbReadyMock
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'));

    const { result } = renderHook(() => useDbReady());
    await advance(0);
    await advance(500);

    const pending = hangingCall();
    await advance(1000);
    expect(ensureDbReadyMock).toHaveBeenCalledTimes(3);

    await advance(28_500);

    const error = result.current.dbInitError;
    expect(error).toBeInstanceOf(DbInitTimeoutError);

    pending.reject(new Error('late'));
    await advance(0);

    expect(result.current.dbInitError).toBe(error);
    expect(result.current.isDbReady).toBe(false);
  });

  it('stops retrying when unmounted during the backoff wait', async () => {
    ensureDbReadyMock.mockRejectedValueOnce(new Error('first'));

    const { unmount } = renderHook(() => useDbReady());
    await advance(0);
    await advance(100);

    unmount();
    await advance(5_000);

    expect(ensureDbReadyMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports a retry that succeeds on a later mount', async () => {
    ensureDbReadyMock
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValueOnce(new Error('third'));

    const first = renderHook(() => useDbReady());
    await advance(0);
    await advance(500);
    await advance(1000);

    expect(first.result.current.dbInitError).toBeInstanceOf(Error);
    expect(logger.trackEvent).not.toHaveBeenCalled();
    first.unmount();

    ensureDbReadyMock.mockResolvedValueOnce(undefined);
    const second = renderHook(() => useDbReady());
    await advance(0);

    expect(second.result.current.isDbReady).toBe(true);
    expect(logger.trackEvent).toHaveBeenCalledTimes(1);

    const [event, payload] = logger.trackEvent.mock.calls[0] as [
      string,
      { mount: number; attempt: number; elapsedMs: number },
    ];
    expect(event).toBe('DB Ready Retry Succeeded');
    expect(payload.attempt).toBe(1);
    expect(payload.mount).toBeGreaterThan(1);
  });

  it('does not report a remount after a successful mount', async () => {
    ensureDbReadyMock.mockResolvedValueOnce(undefined);
    const first = renderHook(() => useDbReady());
    await advance(0);

    expect(first.result.current.isDbReady).toBe(true);
    first.unmount();

    // The previous mount succeeded, so this remount -- the root boundary also
    // remounts after unrelated render crashes -- is not a database recovery.
    logger.trackEvent.mockClear();

    ensureDbReadyMock.mockResolvedValueOnce(undefined);
    const second = renderHook(() => useDbReady());
    await advance(0);

    expect(second.result.current.isDbReady).toBe(true);
    expect(logger.trackEvent).not.toHaveBeenCalled();
  });
});
