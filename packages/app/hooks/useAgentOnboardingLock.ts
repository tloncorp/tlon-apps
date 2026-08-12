import * as db from '@tloncorp/shared/db';
import { groupAgentOnboardingIsComplete } from '@tloncorp/shared/domain';
import { useEffect, useRef } from 'react';

export function shouldLockAgentOnboarding(params: {
  groupId?: string | null;
  markerLoading: boolean;
  markerError: boolean;
  isKnownGuidedGroup: boolean;
  isOnboardingGroup: boolean;
  setupComplete: boolean;
}): boolean {
  if (params.markerLoading) {
    return Boolean(params.groupId) && !params.setupComplete;
  }
  if (params.markerError) {
    return params.isKnownGuidedGroup && !params.setupComplete;
  }
  return params.isOnboardingGroup && !params.setupComplete;
}

/**
 * Whether the channel at `groupId` is the first-run onboarding group whose
 * setup hasn't finished — the window where the app holds the user in the
 * guided conversation.
 *
 * Takes the id and description separately rather than a loaded group row:
 * during the landing handoff the row can still be syncing, and treating
 * "not loaded yet" as "not locked" would leave the chrome up for exactly the
 * window the lock exists to cover. An unknown description reads as
 * unconfigured, so the matching group locks immediately.
 *
 * One-way: the moment the coordinator verifies the first note (or a legacy
 * config first carries a job), the durable marker is cleared, so a later
 * config edit can never trap the user back in setup chrome.
 *
 * One signal, many uses: callers decide what the lock hides — the channel
 * header today; anything else tomorrow.
 */
export function useAgentOnboardingLock(
  groupId?: string | null,
  groupDescription?: string | null
): boolean {
  const {
    value: onboardingGroupId,
    isLoading: markerLoading,
    isError: markerError,
  } = db.agentOnboardingGroupId.useStorageItem();
  const { value: onboardingLanding } =
    db.agentOnboardingLanding.useStorageItem();
  const isOnboardingGroup = Boolean(
    groupId && onboardingGroupId && groupId === onboardingGroupId
  );
  const knownGuidedGroupRef = useRef<string | null>(null);
  if (
    groupId &&
    (isOnboardingGroup || onboardingLanding?.groupId === groupId)
  ) {
    // The landing handoff is cleared immediately after navigation. Latch its
    // identity for this mounted route so a later marker read error remains
    // scoped to the guided channel instead of every group.
    knownGuidedGroupRef.current = groupId;
  }
  const isKnownGuidedGroup =
    Boolean(groupId) && knownGuidedGroupRef.current === groupId;
  const setupComplete = groupAgentOnboardingIsComplete(groupDescription);

  useEffect(() => {
    if (isOnboardingGroup && setupComplete) {
      db.agentOnboardingGroupId.resetValue().catch(() => {
        // Best effort: the lock is already released by the derivation below.
      });
    }
  }, [isOnboardingGroup, setupComplete]);

  // Until the durable marker hydrates, its default (null) would read as
  // "not locked", so retain the brief cold-start hold. A terminal read error
  // is different: only a route already proven guided by the marker or landing
  // handoff stays locked, never an unrelated group.
  return shouldLockAgentOnboarding({
    groupId,
    markerLoading,
    markerError,
    isKnownGuidedGroup,
    isOnboardingGroup,
    setupComplete,
  });
}
