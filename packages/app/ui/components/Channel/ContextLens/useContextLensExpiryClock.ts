import { useEffect, useMemo, useState } from 'react';

import { type ContextLensEvent, FINAL_STATUSES } from './types';

/**
 * Return the next active run expiry after `now`. Terminal snapshots never need
 * a clock tick, even when their retention window later expires.
 */
export function nextContextLensExpiry(
  events: readonly ContextLensEvent[],
  now: number
) {
  let next: number | null = null;
  for (const event of events) {
    const expiresAt = event.lens.expiresAt;
    if (
      typeof expiresAt !== 'number' ||
      expiresAt <= now ||
      FINAL_STATUSES.has(event.lens.status)
    ) {
      continue;
    }
    next = next === null ? expiresAt : Math.min(next, expiresAt);
  }
  return next;
}

/**
 * React data changes normally drive Lens projection. This clock supplies the
 * missing render at a run's expiry boundary when no further gateway or Steward
 * event arrives.
 */
export function useContextLensExpiryClock(events: readonly ContextLensEvent[]) {
  const [now, setNow] = useState(() => Date.now());
  const nextExpiry = useMemo(
    () => nextContextLensExpiry(events, now),
    [events, now]
  );

  useEffect(() => {
    if (nextExpiry === null) return;
    const delay = nextExpiry - Date.now();
    if (delay <= 0) {
      setNow(Date.now());
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), delay + 1);
    return () => clearTimeout(timer);
  }, [nextExpiry]);

  return now;
}
