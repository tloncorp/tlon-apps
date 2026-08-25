import * as db from '@tloncorp/shared/db';

export function isAgentGroupNavigationLocked(
  marker?: Pick<
    db.AgentGroupOnboardingLock,
    'navigationLocked' | 'provisionAcknowledgedAt'
  >
) {
  return Boolean(
    marker &&
    marker.navigationLocked !== false &&
    !marker.provisionAcknowledgedAt
  );
}

export async function isAnyAgentGroupNavigationLockedDurably() {
  const locks = await db.agentGroupOnboardingLocks.getValue(true);
  return Object.values(locks).some(isAgentGroupNavigationLocked);
}

export function useAgentGroupOnboardingLock(groupId?: string | null) {
  const { value: locks, isLoading } =
    db.agentGroupOnboardingLocks.useStorageItem();
  const marker = groupId ? locks[groupId] : undefined;

  return {
    isLoading,
    locked: Boolean(groupId && isAgentGroupNavigationLocked(marker)),
    awaitingFirstEntry: Boolean(
      groupId && marker?.provision && marker.provisionAcknowledgedAt
    ),
    marker,
  };
}

export function useAnyAgentGroupOnboardingLock() {
  const { value: locks, isLoading } =
    db.agentGroupOnboardingLocks.useStorageItem();

  return {
    isLoading,
    locked: Object.values(locks).some(isAgentGroupNavigationLocked),
  };
}
