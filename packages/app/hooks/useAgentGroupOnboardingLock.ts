import * as db from '@tloncorp/shared/db';
import { useEffect, useState } from 'react';

export const AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS = 30_000;

type NavigationLockMarker = Pick<
  db.AgentGroupOnboardingLock,
  'createdAt' | 'navigationLocked' | 'provisionAcknowledgedAt'
>;

export function isAgentGroupNavigationLocked(
  marker?: NavigationLockMarker,
  now = Date.now()
) {
  return Boolean(
    marker &&
    marker.navigationLocked !== false &&
    !marker.provisionAcknowledgedAt &&
    now < marker.createdAt + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS
  );
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
      const expiry = marker.createdAt + AGENT_GROUP_NAVIGATION_LOCK_FAILSAFE_MS;
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
