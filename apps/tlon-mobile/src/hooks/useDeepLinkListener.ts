import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useBranch, useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { RootStackParamList } from '@tloncorp/app/navigation/types';
import { useTypedReset } from '@tloncorp/app/navigation/utils';
import { createDevLogger } from '@tloncorp/shared';
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
        try {
          // if the lure was clicked prior to authenticating, trigger the automatic join & DM
          if (lure.shouldAutoJoin) {
            // no-op for now, hosting will handle
          } else {
            // otherwise, treat it as a deeplink and navigate to the group
            if (lure.invitedGroupId) {
              logger.log(
                `handling deep link to invited group`,
                lure.invitedGroupId
              );
              reset([
                {
                  name: 'ChatList',
                  params: { previewGroupId: lure.invitedGroupId },
                },
              ]);
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
