import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useState } from 'react';

import {
  hasAgentOnboardingFirstEntry,
  hasAgentOnboardingFirstEntryFailed,
  hasAgentOnboardingProvisionAcknowledgement,
} from './agentOnboardingFirstEntry';

const REFRESH_INTERVAL_MS = 5_000;
const REFRESH_TIMEOUT_MS = 5 * 60_000;

export function useAgentOnboardingFirstEntry({
  agentShipId,
  awaitingFirstEntry,
  groupId,
  isFocused,
  posts,
  provisionAcknowledgedAt,
  provisionId,
}: {
  agentShipId: string | null | undefined;
  awaitingFirstEntry: boolean;
  groupId: string | null | undefined;
  isFocused: boolean;
  posts: db.Post[] | null | undefined;
  provisionAcknowledgedAt: number | null | undefined;
  provisionId: string | null | undefined;
}) {
  const provisionAcknowledged = useMemo(
    () =>
      hasAgentOnboardingProvisionAcknowledgement(
        posts,
        agentShipId,
        provisionId
      ),
    [agentShipId, posts, provisionId]
  );

  useEffect(() => {
    if (!groupId || !provisionAcknowledged || provisionAcknowledgedAt) return;
    void db.agentGroupOnboardingLocks.setValue((current) => {
      const lock = current[groupId];
      if (!lock || lock.provisionAcknowledgedAt) return current;
      return {
        ...current,
        [groupId]: { ...lock, provisionAcknowledgedAt: Date.now() },
      };
    });
  }, [groupId, provisionAcknowledged, provisionAcknowledgedAt]);

  const settled = useMemo(
    () =>
      hasAgentOnboardingFirstEntry(posts, agentShipId) ||
      hasAgentOnboardingFirstEntryFailed(posts, agentShipId),
    [agentShipId, posts]
  );
  const [indicatorExpired, setIndicatorExpired] = useState(false);

  useEffect(() => {
    setIndicatorExpired(false);
    if (!awaitingFirstEntry || settled || !provisionAcknowledgedAt) return;
    const remainingMs =
      REFRESH_TIMEOUT_MS - (Date.now() - provisionAcknowledgedAt);
    if (remainingMs <= 0) {
      setIndicatorExpired(true);
      return;
    }
    const timeout = setTimeout(() => setIndicatorExpired(true), remainingMs);
    return () => clearTimeout(timeout);
  }, [awaitingFirstEntry, provisionAcknowledgedAt, groupId, settled]);

  useEffect(() => {
    if (!groupId || !settled) return;
    void db.agentGroupOnboardingLocks.setValue((current) => {
      if (!current[groupId]) return current;
      const { [groupId]: _completed, ...remaining } = current;
      return remaining;
    });
  }, [groupId, settled]);

  useEffect(() => {
    if (!isFocused || !awaitingFirstEntry || settled) return;
    const acknowledgedAt = provisionAcknowledgedAt ?? Date.now();
    if (Date.now() - acknowledgedAt >= REFRESH_TIMEOUT_MS) return;

    let cancelled = false;
    let refreshInFlight = false;
    const refresh = async () => {
      if (
        cancelled ||
        refreshInFlight ||
        Date.now() - acknowledgedAt >= REFRESH_TIMEOUT_MS
      ) {
        return;
      }
      refreshInFlight = true;
      try {
        await store.syncSince({
          callCtx: { cause: 'agent-onboarding-first-entry' },
        });
      } catch {
        // The interval retries transient sync failures until the timeout.
      } finally {
        refreshInFlight = false;
      }
    };

    void refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [awaitingFirstEntry, isFocused, provisionAcknowledgedAt, settled]);

  const withinTimeout = Boolean(
    provisionAcknowledgedAt &&
    Date.now() - provisionAcknowledgedAt < REFRESH_TIMEOUT_MS &&
    !indicatorExpired
  );
  return awaitingFirstEntry && !settled && withinTimeout
    ? 'Writing your first entry…'
    : undefined;
}
