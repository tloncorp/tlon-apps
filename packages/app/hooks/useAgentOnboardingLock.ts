import * as db from '@tloncorp/shared/db';
import { groupAgentOnboardingIsComplete } from '@tloncorp/shared/domain';
import { useEffect } from 'react';

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
  const isOnboardingGroup = Boolean(
    groupId && onboardingGroupId && groupId === onboardingGroupId
  );
  const setupComplete = groupAgentOnboardingIsComplete(groupDescription);

  useEffect(() => {
    if (isOnboardingGroup && setupComplete) {
      db.agentOnboardingGroupId.resetValue().catch(() => {
        // Best effort: the lock is already released by the derivation below.
      });
    }
  }, [isOnboardingGroup, setupComplete]);

  // Until the durable marker hydrates, its default (null) would read as
  // "not locked" — and a cold start can restore straight into the guided
  // channel, opening a window where the back button works and the chrome
  // shows before the lock engages. Treat an unhydrated marker as locked for
  // any group channel that isn't demonstrably finished; for the guided group
  // that's simply correct early, and for every other group it's a one-query
  // flicker on the rare cold start that lands directly in a channel.
  if (markerLoading || markerError) {
    return Boolean(groupId) && !setupComplete;
  }

  return isOnboardingGroup && !setupComplete;
}
