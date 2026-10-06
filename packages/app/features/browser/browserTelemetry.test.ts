import { describe, expect, it, vi } from 'vitest';
import { trackBrowserLifecycle } from './browserTelemetry';
const capture = vi.hoisted(() => vi.fn());
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { BrowserLifecycle: 'Browser Lifecycle' },
  trackEvent: capture,
}));

describe('browser client telemetry', () => {
  it('emits the shared contract without capabilities, form values, or raw errors', () => {
    const input = {
      source: 'client' as const,
      phase: 'fill_accepted' as const,
      outcome: 'accepted' as const,
      viewerUrl: 'secret',
      values: { password: 'secret' },
    };
    trackBrowserLifecycle(input);
    expect(capture).toHaveBeenLastCalledWith('Browser Lifecycle', {
      schemaVersion: 1,
      source: 'client',
      phase: 'fill_accepted',
      outcome: 'accepted',
      taskOutcome: 'unknown',
    });
  });
  it('does not let an analytics failure block secure entry', () => {
    capture.mockImplementationOnce(() => {
      throw new Error('analytics failed');
    });
    expect(() =>
      trackBrowserLifecycle({
        source: 'client',
        phase: 'form_ready',
        outcome: 'accepted',
      })
    ).not.toThrow();
  });
});
