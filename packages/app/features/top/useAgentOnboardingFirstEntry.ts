import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useState } from 'react';

import {
  getAgentOnboardingFirstEntryPendingAt,
  hasAgentOnboardingFirstEntry,
  hasAgentOnboardingFirstEntryFailed,
} from './agentOnboardingFirstEntry';

const REFRESH_INTERVAL_MS = 5_000;
const REFRESH_TIMEOUT_MS = 5 * 60_000;

export function useAgentOnboardingFirstEntry({
  agentShipId,
  awaitingFirstEntry,
  channelId,
  groupId,
  isFocused,
  posts,
  provisionId,
  provisionAcknowledgedAt,
}: {
  agentShipId: string | null | undefined;
  awaitingFirstEntry: boolean;
  channelId: string;
  groupId: string | null | undefined;
  isFocused: boolean;
  posts: db.Post[] | null | undefined;
  provisionId: string | null | undefined;
  provisionAcknowledgedAt: number | null | undefined;
}) {
  const renderedSettled = useMemo(
    () =>
      hasAgentOnboardingFirstEntry(posts, agentShipId) ||
      hasAgentOnboardingFirstEntryFailed(posts, agentShipId),
    [agentShipId, posts]
  );
  const [durableSettlement, setDurableSettlement] = useState<{
    agentShipId: string | null | undefined;
    channelId: string;
  } | null>(null);
  const settled =
    renderedSettled ||
    (durableSettlement !== null &&
      durableSettlement.agentShipId === agentShipId &&
      durableSettlement.channelId === channelId);
  const renderedPendingAt = useMemo(
    () => getAgentOnboardingFirstEntryPendingAt(posts, agentShipId),
    [agentShipId, posts]
  );
  const firstEntryStartedAt = provisionAcknowledgedAt ?? renderedPendingAt;
  const firstEntryActive = awaitingFirstEntry || renderedPendingAt != null;
  const [indicatorExpired, setIndicatorExpired] = useState(false);

  useEffect(() => {
    setIndicatorExpired(false);
    if (!firstEntryActive || settled || !firstEntryStartedAt) return;
    const remainingMs = REFRESH_TIMEOUT_MS - (Date.now() - firstEntryStartedAt);
    if (remainingMs <= 0) {
      setIndicatorExpired(true);
      return;
    }
    const timeout = setTimeout(() => setIndicatorExpired(true), remainingMs);
    return () => clearTimeout(timeout);
  }, [firstEntryActive, firstEntryStartedAt, groupId, settled]);

  useEffect(() => {
    if (!groupId || !settled) return;
    void db.agentGroupOnboardingLocks.setValue((current) => {
      const lock = current[groupId];
      if (!lock || lock.provision?.provisionId !== provisionId) return current;
      const { [groupId]: _completed, ...remaining } = current;
      return remaining;
    });
  }, [groupId, provisionId, settled]);

  useEffect(() => {
    if (!isFocused || !firstEntryActive || settled) return;
    const refreshDeadline =
      (firstEntryStartedAt ?? Date.now()) + REFRESH_TIMEOUT_MS;

    let cancelled = false;
    let refreshInFlight = false;
    const refresh = async () => {
      if (cancelled || refreshInFlight) return;
      refreshInFlight = true;
      try {
        await store.syncSince({
          callCtx: { cause: 'agent-onboarding-first-entry' },
        });
      } catch {
        // The interval retries transient sync failures until the timeout.
      }
      try {
        const channelPosts = await db.getChanPosts({ channelId });
        if (
          !cancelled &&
          (hasAgentOnboardingFirstEntry(channelPosts, agentShipId) ||
            hasAgentOnboardingFirstEntryFailed(channelPosts, agentShipId))
        ) {
          setDurableSettlement({ agentShipId, channelId });
        }
      } catch {
        // Retry the durable read alongside the next sync attempt.
      } finally {
        refreshInFlight = false;
      }
    };

    // The five-minute deadline only bounds active polling and the visible
    // indicator. Re-check once on every later focus so a delayed result can
    // still release the durable onboarding lock.
    void refresh();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (Date.now() < refreshDeadline) {
      interval = setInterval(() => {
        if (Date.now() >= refreshDeadline) {
          clearInterval(interval);
          interval = undefined;
          return;
        }
        void refresh();
      }, REFRESH_INTERVAL_MS);
    }
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [
    agentShipId,
    channelId,
    firstEntryActive,
    firstEntryStartedAt,
    isFocused,
    settled,
  ]);

  const withinTimeout = Boolean(
    firstEntryStartedAt &&
    Date.now() - firstEntryStartedAt < REFRESH_TIMEOUT_MS &&
    !indicatorExpired
  );
  return firstEntryActive && !settled && withinTimeout
    ? 'Writing your first entry…'
    : undefined;
}
