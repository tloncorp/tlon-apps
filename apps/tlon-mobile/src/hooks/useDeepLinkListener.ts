import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useBranch, useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { RootStackParamList } from '@tloncorp/app/navigation/types';
import { useTypedReset } from '@tloncorp/app/navigation/utils';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useEffect, useRef } from 'react';

const logger = createDevLogger('deeplinkHandler', true);

export const useDeepLinkListener = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isHandlingLinkRef = useRef(false);
  const { ship } = useShip();
  const signupParams = useSignupParams();
  const { clearLure, lure } = useBranch();
  const reset = useTypedReset();

  useEffect(() => {
    if (ship && lure && !isHandlingLinkRef.current) {
      (async () => {
        isHandlingLinkRef.current = true;
        logger.log(`handling deep link`, lure, signupParams);
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: 'Handling deeplink click',
          lure: lure.id,
        });
        try {
          if (!ship) {
            // if the lure was clicked prior to authenticating, no-op for now.
            // Hosting will handle once the user signs up.
          } else {
            // otherwise, treat it as a deeplink and navigate
            if (lure.inviteType === 'user') {
              const inviter = lure.inviterUserId;
              if (inviter) {
                logger.log(`handling deep link to user`, inviter);
                reset([
                  {
                    name: 'Contacts',
                  },
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

              store.redeemInviteIfNeeded(lure);
              const previewGroupId = lure.invitedGroupId || lure.group;
              if (previewGroupId) {
                reset([
                  {
                    name: 'ChatList',
                    params: { previewGroupId },
                  },
                ]);
              }
            }
          }
        } catch (e) {
          logger.error('Failed to handle deep link', lure, e);
        } finally {
          clearLure();
          isHandlingLinkRef.current = false;
        }
      })();
    }
  }, [ship, signupParams, clearLure, lure, navigation, reset]);
};
