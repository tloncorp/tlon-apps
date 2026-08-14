import * as db from '@tloncorp/shared/db';

export function useAgentGroupOnboardingLock(groupId?: string | null) {
  const { value: locks, isLoading } =
    db.agentGroupOnboardingLocks.useStorageItem();
  const marker = groupId ? locks[groupId] : undefined;

  return {
    isLoading,
    locked: Boolean(groupId && marker && !marker.provisionAcknowledgedAt),
    awaitingFirstEntry: Boolean(
      groupId && marker?.provision && marker.provisionAcknowledgedAt
    ),
    marker,
  };
}
