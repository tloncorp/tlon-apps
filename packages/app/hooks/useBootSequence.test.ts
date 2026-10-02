import { expect, test, vi } from 'vitest';

// The hook module reaches expo/native modules through its imports, none of
// which load in a node test environment. Only `withRetry` matters here — it is
// what decides whether a returned outcome comes back for another attempt — so
// it comes from the package that actually defines it and the rest are stubs.
vi.hoisted(() => {
  (globalThis as any).__DEV__ = true;
});

vi.mock('@tloncorp/shared', async () => {
  const { withRetry } = await vi.importActual<
    typeof import('@tloncorp/api/lib/utils')
  >('@tloncorp/api/lib/utils');
  return {
    withRetry,
    AnalyticsEvent: {},
    createDevLogger: () => ({
      crumb: vi.fn(),
      log: vi.fn(),
      trackEvent: vi.fn(),
      trackError: vi.fn(),
    }),
  };
});
vi.mock('@tloncorp/shared/store', () => ({ syncStart: vi.fn() }));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/api', () => ({}));
vi.mock('../contexts/branch', () => ({ useLureMetadata: vi.fn() }));
vi.mock('../contexts/ship', () => ({ useShip: vi.fn() }));
vi.mock('../lib/bootHelpers', () => ({ default: {} }));
vi.mock('./useConfigureUrbitClient', () => ({
  useConfigureUrbitClient: vi.fn(),
}));
vi.mock('./usePosthog', () => ({ usePosthog: vi.fn() }));

import type * as store from '@tloncorp/shared/store';

import { retryUntilSyncStarts } from './useBootSequence';

// The real config waits 30s between attempts; what's under test is which
// outcomes come back for another go, not how long it waits for one.
const fastRetry = { numOfAttempts: 3, startingDelay: 1 };

const outcomes = (...values: store.SyncStartOutcome[]) => {
  const runSyncStart = vi.fn<[], Promise<store.SyncStartOutcome>>();
  values.forEach((value) => runSyncStart.mockResolvedValueOnce(value));
  return runSyncStart;
};

test('comes back for another attempt while the desk gate is up', async () => {
  const runSyncStart = outcomes('gated', 'ok');

  await expect(retryUntilSyncStarts(runSyncStart, fastRetry)).resolves.toBe(
    'ok'
  );
  expect(runSyncStart).toHaveBeenCalledTimes(2);
});

test('stops as soon as a start actually runs', async () => {
  const runSyncStart = outcomes('ok');

  await expect(retryUntilSyncStarts(runSyncStart, fastRetry)).resolves.toBe(
    'ok'
  );
  expect(runSyncStart).toHaveBeenCalledTimes(1);
});

test.each(['busy', 'abandoned'] as const)(
  'does not retry a %s start',
  async (outcome) => {
    // Another start owns the work, or the login is already gone: neither is
    // something a second attempt half a minute later can fix.
    const runSyncStart = outcomes(outcome);

    await expect(retryUntilSyncStarts(runSyncStart, fastRetry)).resolves.toBe(
      outcome
    );
    expect(runSyncStart).toHaveBeenCalledTimes(1);
  }
);

test('gives up once the attempts are used, naming the outcome', async () => {
  const runSyncStart = outcomes('gated', 'gated', 'gated');

  await expect(
    retryUntilSyncStarts(runSyncStart, fastRetry)
  ).rejects.toThrowError('sync start did not run: gated');
  expect(runSyncStart).toHaveBeenCalledTimes(3);
});
