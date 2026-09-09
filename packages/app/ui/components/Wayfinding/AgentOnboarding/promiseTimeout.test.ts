import { afterEach, describe, expect, it, vi } from 'vitest';

import { PromiseTimeoutError, withTimeout } from './promiseTimeout';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a result that arrives before the deadline', async () => {
    await expect(
      withTimeout(Promise.resolve('ready'), 1_000, 'timed out')
    ).resolves.toBe('ready');
  });

  it('rejects a stalled operation at the deadline', async () => {
    vi.useFakeTimers();
    const result = withTimeout(
      new Promise<never>(() => {}),
      30_000,
      'Agent group furnishing attempt timed out'
    );
    const expectation =
      expect(result).rejects.toBeInstanceOf(PromiseTimeoutError);

    await vi.advanceTimersByTimeAsync(30_000);
    await expectation;
  });
});
