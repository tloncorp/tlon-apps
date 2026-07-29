import { afterEach, describe, expect, it } from 'vitest';

import {
  AUTH_PLUGIN_ERROR_GRACE_MS,
  authRetryDelayMs,
  authRetryStateKey,
  clearAuthRetryState,
  recordAuthRetryFailure,
} from './auth-retry-state.js';

describe('auth retry state', () => {
  const key = authRetryStateKey({
    accountId: 'default',
    botShip: '~pinser-botter-zod',
  });

  afterEach(() => clearAuthRetryState(key));

  it('keeps cumulative attempts and downtime across retry batches', () => {
    expect(recordAuthRetryFailure(key, 1_000)).toEqual({
      attempt: 1,
      downMs: 0,
      shouldCapturePluginError: false,
    });
    expect(recordAuthRetryFailure(key, 61_000)).toEqual({
      attempt: 2,
      downMs: 60_000,
      shouldCapturePluginError: false,
    });
    expect(
      recordAuthRetryFailure(key, 1_000 + AUTH_PLUGIN_ERROR_GRACE_MS)
    ).toEqual({
      attempt: 3,
      downMs: AUTH_PLUGIN_ERROR_GRACE_MS,
      shouldCapturePluginError: true,
    });
  });

  it('starts a fresh outage after authentication succeeds', () => {
    recordAuthRetryFailure(key, 1_000);
    clearAuthRetryState(key);

    expect(recordAuthRetryFailure(key, 50_000)).toEqual({
      attempt: 1,
      downMs: 0,
      shouldCapturePluginError: false,
    });
  });

  it('keeps fast transient failures retrying until the grace window', () => {
    let nowMs = 1_000;

    for (let attempt = 1; attempt <= 10; attempt++) {
      expect(recordAuthRetryFailure(key, nowMs)).toMatchObject({
        attempt,
        shouldCapturePluginError: false,
      });
      nowMs += authRetryDelayMs(attempt);
    }

    expect(recordAuthRetryFailure(key, nowMs)).toEqual({
      attempt: 11,
      downMs: 181_000,
      shouldCapturePluginError: true,
    });
  });
});
