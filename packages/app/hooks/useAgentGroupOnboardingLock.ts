import * as db from '@tloncorp/shared/db';

export function useAgentGroupOnboardingLock(groupId?: string | null) {
  const locks = db.agentGroupOnboardingLocks.useValue();
  const marker = groupId ? locks[groupId] : undefined;

  return {
    awaitingFirstEntry: Boolean(
      groupId && marker?.provision && marker.provisionAcknowledgedAt
    ),
    marker,
  };
}
