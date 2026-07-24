import { useDebugStore } from './debug';
import { AnalyticsEvent } from './domain';

export function trackEvent(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {}
) {
  useDebugStore.getState().errorLogger?.capture(event, properties);
}
