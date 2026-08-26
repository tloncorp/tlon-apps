import * as db from '@tloncorp/shared/db';
import { useMutableRef } from '@tloncorp/shared/logic';
import { useCallback, useEffect, useState } from 'react';

export const AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS =
  db.AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS;

type NavigationLockMarker = Pick<
  db.AgentGroupOnboardingLock,
  'navigationLockExpiresAt' | 'provisionAcknowledgedAt'
>;

export function isAgentGroupNavigationLocked(
  marker?: NavigationLockMarker,
  now = Date.now()
) {
  return Boolean(
    marker &&
    !marker.provisionAcknowledgedAt &&
    marker.navigationLockExpiresAt != null &&
    now < marker.navigationLockExpiresAt
  );
}

/**
 * Re-arm a full failsafe window when the setup chat is handed to navigation.
 * Furnishing may have outlived the window armed at lock creation; groups that
 * never armed a lock (later Tlonbot groups) stay unarmed.
 */
export async function startAgentGroupNavigationLockFailsafe(
  groupId: string,
  startedAt = Date.now()
) {
  await db.agentGroupOnboardingLocks.setValue((current) => {
    const marker = current[groupId];
    if (!marker || marker.navigationLockExpiresAt == null) return current;
    return {
      ...current,
      [groupId]: {
        ...marker,
        navigationLockExpiresAt:
          startedAt + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS,
      },
    };
  });
}

export function findAgentGroupOnboardingStartupRoute(
  locks: Record<string, db.AgentGroupOnboardingLock>,
  now = Date.now()
) {
  const entry = Object.entries(locks).find(
    ([, marker]) =>
      isAgentGroupNavigationLocked(marker, now) && Boolean(marker.chatChannelId)
  );
  return entry
    ? { groupId: entry[0], channelId: entry[1].chatChannelId! }
    : null;
}

export async function isAnyAgentGroupNavigationLockedDurably() {
  const locks = await db.agentGroupOnboardingLocks.getValue(true);
  return Object.values(locks).some((marker) =>
    isAgentGroupNavigationLocked(marker)
  );
}

/** Re-render lock consumers exactly when the next active failsafe expires. */
function useAgentGroupNavigationLockClock(
  locks: Record<string, db.AgentGroupOnboardingLock>
) {
  const [now, setNow] = useState(Date.now);
  const nextExpiry = Object.values(locks).reduce<number | null>(
    (soonest, marker) => {
      if (!isAgentGroupNavigationLocked(marker, now)) return soonest;
      const expiry = marker.navigationLockExpiresAt!;
      return soonest == null || expiry < soonest ? expiry : soonest;
    },
    null
  );

  useEffect(() => {
    if (nextExpiry == null) return;
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, nextExpiry - Date.now())
    );
    return () => clearTimeout(timeout);
  }, [nextExpiry]);

  return now;
}

export function useAgentGroupOnboardingLock(groupId?: string | null) {
  const { value: locks, isLoading } =
    db.agentGroupOnboardingLocks.useStorageItem();
  const marker = groupId ? locks[groupId] : undefined;
  const now = useAgentGroupNavigationLockClock(locks);

  return {
    isLoading,
    locked: Boolean(groupId && isAgentGroupNavigationLocked(marker, now)),
    awaitingFirstEntry: Boolean(
      groupId && marker?.provision && marker.provisionAcknowledgedAt
    ),
    marker,
  };
}

export function useAnyAgentGroupOnboardingLock() {
  const { value: locks, isLoading } =
    db.agentGroupOnboardingLocks.useStorageItem();
  const now = useAgentGroupNavigationLockClock(locks);

  return {
    isLoading,
    locked: Object.values(locks).some((marker) =>
      isAgentGroupNavigationLocked(marker, now)
    ),
  };
}

export function useAgentGroupOnboardingStartupRoute() {
  const { value: locks, isLoading } =
    db.agentGroupOnboardingLocks.useStorageItem();
  const now = useAgentGroupNavigationLockClock(locks);
  return {
    isLoading,
    route: findAgentGroupOnboardingStartupRoute(locks, now),
  };
}

/**
 * Gate for navigation triggered outside the onboarding flow (notification
 * taps, deep links). Live lock state can lag a just-written lock, so the gate
 * re-reads durable storage immediately before running the navigation, then
 * re-checks the live value after that await. When the gate reports it did not
 * run, callers leave their triggering intent in place (pending notification,
 * stored lure) and retry once `locked` clears.
 */
export function useAgentGroupOnboardingNavGate() {
  const { locked, isLoading } = useAnyAgentGroupOnboardingLock();
  const stateRef = useMutableRef({ locked, isLoading });
  const runWhenUnlocked = useCallback(
    async <T>(
      navigate: () => T | Promise<T>
    ): Promise<{ ran: boolean; result?: T }> => {
      const before = stateRef.current;
      if (
        before.isLoading ||
        before.locked ||
        (await isAnyAgentGroupNavigationLockedDurably())
      ) {
        return { ran: false };
      }
      const after = stateRef.current;
      if (after.isLoading || after.locked) {
        return { ran: false };
      }
      return { ran: true, result: await navigate() };
    },
    [stateRef]
  );
  return { locked, isLoading, runWhenUnlocked };
}
