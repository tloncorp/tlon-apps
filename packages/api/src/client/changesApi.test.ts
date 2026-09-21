import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { SpinHintResult } from './urbit';

const mocks = vi.hoisted(() => ({
  scry: vi.fn(),
  startSpinHintCheck: vi.fn(),
}));

vi.mock('./urbit', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  scry: mocks.scry,
  startSpinHintCheck: mocks.startSpinHintCheck,
}));

import { fetchChangesSince } from './changesApi';

const emptyChanges = {
  groups: {},
  channels: {},
  chat: {},
  contacts: {},
  activity: {},
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  mocks.scry.mockReset();
  mocks.startSpinHintCheck.mockReset();
});

describe('fetchChangesSince spin orchestration', () => {
  test('starts the scry without awaiting spin and bounds the grace wait', async () => {
    const scryResult = deferred<typeof emptyChanges>();
    const spinResult = deferred<SpinHintResult>();
    const cancel = vi.fn();
    mocks.scry.mockReturnValue(scryResult.promise);
    mocks.startSpinHintCheck.mockReturnValue({
      settleWithin: vi.fn(() =>
        Promise.race([
          spinResult.promise,
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  outcome: 'grace_expired',
                  nodeBusyStatus: 'unknown',
                  durationMs: Date.now(),
                }),
              500
            )
          ),
        ])
      ),
      cancel,
    });

    const result = fetchChangesSince(0);
    expect(mocks.scry).toHaveBeenCalledTimes(1);
    scryResult.resolve(emptyChanges);
    await vi.advanceTimersByTimeAsync(499);
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({
      nodeBusyStatus: 'unknown',
      spinOutcome: 'grace_expired',
      spinDurationMs: 500,
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  test('returns a hint that settles during the grace period', async () => {
    const spinResult = deferred<SpinHintResult>();
    const cancel = vi.fn();
    mocks.scry.mockResolvedValue(emptyChanges);
    mocks.startSpinHintCheck.mockReturnValue({
      settleWithin: vi.fn(() => spinResult.promise),
      cancel,
    });
    const result = fetchChangesSince(0);

    await vi.advanceTimersByTimeAsync(400);
    spinResult.resolve({
      outcome: 'hint',
      nodeBusyStatus: 'busy',
      hints: '/ames',
      durationMs: 400,
    });

    await expect(result).resolves.toMatchObject({
      nodeBusyStatus: 'busy',
      hints: '/ames',
      spinOutcome: 'hint',
      spinDurationMs: 400,
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  test('keeps a spin failure advisory', async () => {
    const cancel = vi.fn();
    mocks.scry.mockResolvedValue(emptyChanges);
    mocks.startSpinHintCheck.mockReturnValue({
      settleWithin: vi.fn().mockResolvedValue({
        outcome: 'failed',
        nodeBusyStatus: 'unknown',
        errorClass: 'transport',
        durationMs: 10,
      }),
      cancel,
    });

    await expect(fetchChangesSince(0)).resolves.toMatchObject({
      nodeBusyStatus: 'unknown',
      spinOutcome: 'failed',
      spinErrorClass: 'transport',
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  test('preserves a changes error and cancels spin', async () => {
    const error = new Error('changes failed');
    const cancel = vi.fn();
    mocks.scry.mockRejectedValue(error);
    mocks.startSpinHintCheck.mockReturnValue({
      settleWithin: vi.fn(),
      cancel,
    });

    await expect(fetchChangesSince(0)).rejects.toBe(error);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
