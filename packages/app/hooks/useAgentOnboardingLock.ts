import * as db from '@tloncorp/shared/db';
import { groupHasConfiguredJob } from '@tloncorp/shared/domain';
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
 * One-way: the moment the config first carries a job, the durable marker is
 * cleared, so a later config edit (stopping the job, a bad rewrite) can never
 * trap the user back in setup chrome.
 *
 * One signal, many uses: callers decide what the lock hides — the channel
 * header today; anything else tomorrow.
 */
export function useAgentOnboardingLock(
  groupId?: string | null,
  groupDescription?: string | null
): boolean {
  const onboardingGroupId = db.agentOnboardingGroupId.useValue();
  const isOnboardingGroup = Boolean(
    groupId && onboardingGroupId && groupId === onboardingGroupId
  );
  const setupComplete = groupHasConfiguredJob(groupDescription);

  useEffect(() => {
    if (isOnboardingGroup && setupComplete) {
      db.agentOnboardingGroupId.resetValue().catch(() => {
        // Best effort: the lock is already released by the derivation below.
      });
    }
  }, [isOnboardingGroup, setupComplete]);

  return isOnboardingGroup && !setupComplete;
}
