import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useBranch, useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { inviteShipWithLure } from '@tloncorp/app/lib/hostingApi';
import { trackError } from '@tloncorp/app/utils/posthog';
import { createDevLogger } from '@tloncorp/shared/dist';
import * as store from '@tloncorp/shared/dist/store';
import { useEffect, useRef } from 'react';

import { RootStackParamList } from '../types';

const logger = createDevLogger('deeplinkHandler', true);

export const useDeepLinkListener = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isHandlingLinkRef = useRef(false);
  const { ship } = useShip();
  const signupParams = useSignupParams();
  const { clearLure, lure } = useBranch();

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
              const [group] = await store.syncGroupPreviews([
                lure.invitedGroupId,
              ]);
              if (group) {
                navigation.reset({
                  index: 1,
                  routes: [
                    { name: 'ChatList', params: { previewGroup: group } },
                  ],
                });
              } else {
                logger.error(
                  'Failed to navigate to group deeplink',
                  lure.invitedGroupId
                );
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
  }, [ship, signupParams, clearLure, lure, navigation]);
};
