import * as db from '@tloncorp/shared/db';
import { groupHasConfiguredJob } from '@tloncorp/shared/domain';

/**
 * Whether `group` is the first-run onboarding group whose setup hasn't
 * finished — the window where the app holds the user in the guided
 * conversation.
 *
 * True only for the group the first-run flow landed the user in (a group
 * they created themselves never locks), and only until the agent writes the
 * job into the group's config — the setup's final artifact. Both inputs are
 * live queries, so the lock releases on its own the moment the config
 * syncs; nothing needs to clear it.
 *
 * One signal, many uses: callers decide what the lock hides — the channel
 * back button today; search or other exits tomorrow.
 */
export function useAgentOnboardingLock(
  group?: { id: string; description?: string | null } | null
): boolean {
  const onboardingGroupId = db.agentOnboardingGroupId.useValue();
  return Boolean(
    group &&
      onboardingGroupId &&
      group.id === onboardingGroupId &&
      !groupHasConfiguredJob(group.description)
  );
}
