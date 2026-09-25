import { useBranch, useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useAgentGroupOnboardingNavGate } from '@tloncorp/app/hooks/useAgentGroupOnboardingLock';
import {
  useNavigateRoot,
  useRootNavigatorMount,
} from '@tloncorp/app/navigation/navigateRoot';
import {
  getTopLevelTabRoute,
  useTypedReset,
} from '@tloncorp/app/navigation/utils';
import { isNativeSplitLayoutMounted } from '@tloncorp/app/ui';
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
  const navigateRoot = useNavigateRoot();
  const rootNavigator = useRootNavigatorMount();
  const {
    locked: agentOnboardingLocked,
    isLoading: agentOnboardingLockLoading,
    runWhenUnlocked,
  } = useAgentGroupOnboardingNavGate();
  // Hold the lure until the desk verdict is ok, as useNotificationListener
  // does for notification taps (TLON-6531).
  const deskOk = store.useDeskCompatibility()?.status === 'ok';

  useEffect(() => {
    if (
      deskOk &&
      ship &&
      lure &&
      !agentOnboardingLocked &&
      !agentOnboardingLockLoading &&
      !isHandlingLinkRef.current
    ) {
      const openWhenMounted = (open: () => void) => {
        if (rootNavigator.isMounted()) {
          open();
        } else {
          rootNavigator.whenMounted(open);
        }
      };
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
                openWhenMounted(() => {
                  if (isNativeSplitLayoutMounted()) {
                    navigateRoot({
                      name: 'Contacts',
                      params: {
                        screen: 'UserProfile',
                        params: { userId: inviter },
                      },
                    });
                    return;
                  }
                  // Contacts is a stack screen now, not a tab, so seat it over
                  // the Workspaces tab: back from the profile still lands on
                  // Contacts, and back from there on the list.
                  reset([
                    getTopLevelTabRoute('ChatList'),
                    { name: 'Contacts' },
                    {
                      name: 'UserProfile',
                      params: { userId: inviter },
                    },
                  ]);
                });
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
                openWhenMounted(() => {
                  if (isNativeSplitLayoutMounted()) {
                    navigateRoot({
                      name: 'Home',
                      params: {
                        screen: 'ChatList',
                        params: { previewGroupId },
                      },
                    });
                  } else {
                    reset([
                      getTopLevelTabRoute('ChatList', { previewGroupId }),
                    ]);
                  }
                });
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
    deskOk,
    agentOnboardingLocked,
    agentOnboardingLockLoading,
    runWhenUnlocked,
    ship,
    signupParams,
    clearLure,
    lure,
    reset,
    navigateRoot,
    rootNavigator,
  ]);
};
