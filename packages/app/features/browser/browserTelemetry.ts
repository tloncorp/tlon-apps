import {
  browserLifecycleEvent,
  type BrowserLifecycleInput,
} from '@tloncorp/api';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';

export function trackBrowserLifecycle(input: BrowserLifecycleInput) {
  try {
    const event = browserLifecycleEvent(input);
    if (event) trackEvent(AnalyticsEvent.BrowserLifecycle, event);
  } catch {
    // Telemetry is best effort and cannot interrupt credential handoff.
  }
}
