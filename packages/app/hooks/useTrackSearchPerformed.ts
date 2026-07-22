import {
  AnalyticsEvent,
  getSearchResultTelemetryBucket,
  trackProductEvent,
} from '@tloncorp/shared';
import { useEffect, useRef } from 'react';

export function useTrackSearchPerformed({
  query,
  resultCount,
  surface,
  settled = true,
  debounceMs = 500,
}: {
  query: string;
  resultCount: number;
  surface: 'home' | 'global' | 'channel';
  settled?: boolean;
  debounceMs?: number;
}) {
  const lastTrackedQueryRef = useRef('');

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery === '') {
      lastTrackedQueryRef.current = '';
      return;
    }
    if (!settled || normalizedQuery === lastTrackedQueryRef.current) return;

    const timeout = setTimeout(() => {
      lastTrackedQueryRef.current = normalizedQuery;
      trackProductEvent(AnalyticsEvent.SearchPerformed, {
        resultCountBucket: getSearchResultTelemetryBucket(resultCount),
        surface,
      });
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [debounceMs, query, resultCount, settled, surface]);
}
