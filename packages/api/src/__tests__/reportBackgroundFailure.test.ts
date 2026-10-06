import { describe, expect, test, vi } from 'vitest';

import { reportBackgroundFailure } from '../lib/logger';

// These reports have to reach Sentry as *messages*. Handing trackError an
// Error would break them twice over: SENTRY_IGNORE_ERRORS drops exceptions
// whose value is `Failed to fetch` (the dominant case), and toSentryCapture
// only attaches the ['app_error', logger, errorTitle] fingerprint to message
// captures, so they would not group per context either.
describe('reportBackgroundFailure', () => {
  test('reports the context as the title so Sentry groups per cause', () => {
    const trackError = vi.fn();
    reportBackgroundFailure(
      { trackError },
      'hosting heartbeat'
    )(new TypeError('Failed to fetch'));

    expect(trackError).toHaveBeenCalledWith(
      'background request failed: hosting heartbeat',
      { errorMessage: 'Failed to fetch' }
    );
  });

  test('never hands the Error object to trackError', () => {
    const trackError = vi.fn();
    reportBackgroundFailure(
      { trackError },
      'mark invites read'
    )(new TypeError('Failed to fetch'));

    const [, data] = trackError.mock.calls[0];
    expect(data).not.toHaveProperty('error');
    expect(data).not.toHaveProperty('stack');
    expect(Object.values(data as object).some((v) => v instanceof Error)).toBe(
      false
    );
  });

  test('stringifies a non-Error rejection', () => {
    const trackError = vi.fn();
    reportBackgroundFailure({ trackError }, 'vitals poke')('quit');

    expect(trackError).toHaveBeenCalledWith(
      'background request failed: vitals poke',
      { errorMessage: 'quit' }
    );
  });
});
