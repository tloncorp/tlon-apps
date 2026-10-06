import { describe, expect, it } from 'vitest';
import {
  browserLifecycleEvent,
  browserTelemetryContextSchema,
} from './browserTelemetry';

describe('browser telemetry privacy contract', () => {
  it('strips unknown data instead of passing through browser or form payloads', () => {
    expect(
      browserLifecycleEvent({
        source: 'client',
        phase: 'fill_accepted',
        outcome: 'accepted',
        formKind: 'login',
        submitted: true,
        viewerUrl: 'secret',
        values: { password: 'secret' },
        error: 'private URL',
      })
    ).toEqual({
      schemaVersion: 1,
      source: 'client',
      phase: 'fill_accepted',
      outcome: 'accepted',
      taskOutcome: 'unknown',
      formKind: 'login',
      submitted: true,
    });
  });
  it('rejects bearer ids and unverified task success', () => {
    const base = {
      source: 'agent',
      phase: 'session_released',
      outcome: 'accepted',
    };
    expect(
      browserLifecycleEvent({ ...base, browserSessionId: 'sess_secret' })
    ).toBeUndefined();
    expect(
      browserLifecycleEvent({ ...base, browserHandoffId: 'https://secret' })
    ).toBeUndefined();
    expect(
      browserLifecycleEvent({ ...base, taskOutcome: 'succeeded' })
    ).toBeUndefined();
    expect(browserLifecycleEvent({ ...base, durationMs: NaN })).toBeUndefined();
    expect(
      browserTelemetryContextSchema.safeParse({
        browserSessionId: 'a'.repeat(64),
        browserHandoffId: 'not-an-id',
      }).success
    ).toBe(false);
  });
});
