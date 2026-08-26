import { useBranch, useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useAgentGroupOnboardingNavGate } from '@tloncorp/app/hooks/useAgentGroupOnboardingLock';
import {
  getTopLevelTabRoute,
  useTypedReset,
} from '@tloncorp/app/navigation/utils';
import { AnalyticsEvent, createDevLogger, trackEvent } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useEffect, useRef } from 'react';

const logger = createDevLogger('deeplinkHandler', true);

export const useDeepLinkListener = () => {
  const isHandlingLinkRef = useRef(false);
  const { ship } = useShip();
  const signupParams = useSignupParams();
  const { clearLure, lure } = useBranch();
  const reset = useTypedReset();
  const {
    locked: agentOnboardingLocked,
    isLoading: agentOnboardingLockLoading,
    runWhenUnlocked,
  } = useAgentGroupOnboardingNavGate();

  useEffect(() => {
    if (
      ship &&
      lure &&
      !agentOnboardingLocked &&
      !agentOnboardingLockLoading &&
      !isHandlingLinkRef.current
    ) {
      (async () => {
        isHandlingLinkRef.current = true;
        logger.log(`handling deep link`, lure, signupParams);
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: 'Handling deeplink click',
          lure: lure.id,
        });
        if (!lure.inviteOpenedTracked) {
          trackEvent(AnalyticsEvent.InviteOpened);
        }
        let deferredForOnboarding = false;
        try {
          const { ran } = await runWhenUnlocked(async () => {
            if (lure.shouldAutoJoin || !ship) {
              // if the lure was clicked prior to authenticating, no-op for now.
              // Hosting will handle once the user signs up.
              return;
            }
            // otherwise, treat it as a deeplink and navigate
            if (lure.inviteType === 'user') {
              const inviter = lure.inviterUserId;
              if (inviter) {
                logger.log(`handling deep link to user`, inviter);
                reset([
                  getTopLevelTabRoute('Contacts'),
                  {
                    name: 'UserProfile',
                    params: { userId: inviter },
                  },
                ]);
              }
              return;
            }

            if (lure.invitedGroupId) {
              logger.log(
                `handling deep link to invited group`,
                lure.invitedGroupId
              );

              store.redeemInviteIfNeeded(lure).catch((e) => {
                logger.error('Failed to redeem invite', lure, e);
              });
              const previewGroupId = lure.invitedGroupId || lure.group;
              if (previewGroupId) {
                reset([getTopLevelTabRoute('ChatList', { previewGroupId })]);
              }
            }
          });
          deferredForOnboarding = !ran;
        } catch (e) {
          logger.error('Failed to handle deep link', lure, e);
        } finally {
          if (!deferredForOnboarding) {
            clearLure({ preserveFetching: true });
          }
          isHandlingLinkRef.current = false;
        }
      })();
    }
  }, [
    agentOnboardingLocked,
    agentOnboardingLockLoading,
    runWhenUnlocked,
    ship,
    signupParams,
    clearLure,
    lure,
    reset,
  ]);
};
