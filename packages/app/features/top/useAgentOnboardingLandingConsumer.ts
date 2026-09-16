import { isBotDmChannel } from '@tloncorp/api/client/utils';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect, useRef } from 'react';

import { startAgentGroupNavigationLockFailsafe } from '../../hooks/useAgentGroupOnboardingLock';
import { getTopLevelTabRoute } from '../../navigation/topLevelTabs';
import { useRootNavigation, useTypedReset } from '../../navigation/utils';
import {
  canClaimAgentOnboardingLanding,
  claimAgentOnboardingLanding,
} from './agentOnboardingLanding';

const logger = createDevLogger('useAgentOnboardingLandingConsumer', false);

/**
 * ChatListScreen's half of the onboarding handoff: wait for the furnished
 * setup chat to exist locally, claim the durable landing exactly once, then
 * reset navigation into it with the failsafe clock started at the handoff.
 */
export function useAgentOnboardingLandingConsumer() {
  const { resetToChannel } = useRootNavigation();
  const reset = useTypedReset();
  const onboardingLanding = db.agentOnboardingLanding.useValue();
  const consumedOnboardingLanding = useRef(false);
  const resetToChannelRef = useRef(resetToChannel);
  resetToChannelRef.current = resetToChannel;
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    if (
      !canClaimAgentOnboardingLanding(onboardingLanding) ||
      consumedOnboardingLanding.current
    ) {
      return;
    }
    let active = true;

    void (async () => {
      while (active && !consumedOnboardingLanding.current) {
        try {
          const channel = await db.getChannel({
            id: onboardingLanding.channelId,
          });
          if (channel) {
            // Furnishing may have taken much longer than the lock failsafe.
            // Start its clock at the actual handoff so the setup chat gets the
            // full bounded lock window once it becomes visible.
            await startAgentGroupNavigationLockFailsafe(
              onboardingLanding.groupId
            );
            // Claim this handoff durably before resetting navigation. The reset
            // remounts ChatListScreen, so component-local state alone cannot
            // prevent the new instance from consuming the same handoff again.
            await db.agentOnboardingLanding.setValue(
              claimAgentOnboardingLanding(onboardingLanding)
            );
            consumedOnboardingLanding.current = true;
            if (isBotDmChannel({ channel })) {
              // The bot DM is a tab, not a pushed screen. Landing on the tab
              // leaves the user where onboarding continues, rather than one
              // back-press above Workspaces.
              resetRef.current([getTopLevelTabRoute('BotChat')]);
            } else {
              resetToChannelRef.current(onboardingLanding.channelId, {
                backToGroupIndex: true,
                disableTransition: true,
                groupId: onboardingLanding.groupId,
              });
            }
            return;
          }
        } catch (error) {
          logger.trackError('Failed to consume agent onboarding landing', {
            error,
            ...onboardingLanding,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    })();

    return () => {
      active = false;
    };
  }, [onboardingLanding]);
}
