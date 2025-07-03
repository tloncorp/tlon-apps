import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import {
  createDevLogger,
  getMetadataFromInviteToken,
  withRetry,
} from '@tloncorp/shared';
import { useEffect } from 'react';

import { ActualRootDrawerParamList } from '../navigation/types';
import { useStore } from '../ui';

const logger = createDevLogger('useInviteParam', true);

export function useInviteParam() {
  const store = useStore();
  const navigation =
    useNavigation<DrawerNavigationProp<ActualRootDrawerParamList>>();

  useEffect(() => {
    async function runEffect() {
      const urlParams = new URLSearchParams(window.location.search);
      const inviteToken = urlParams.get('inviteToken');

      if (!inviteToken) {
        return;
      }

      logger.trackEvent('detected web invite token', { inviteToken });
      const meta = await withRetry(
        () => getMetadataFromInviteToken(inviteToken),
        { numOfAttempts: 3, maxDelay: 500 }
      );
      if (!meta) {
        logger.trackEvent('did not find metadata for invite token');
        return;
      }
      logger.trackEvent('found metadata for invite token', { inviteToken });

      if (meta.invitedGroupId) {
        await withRetry(() => store.redeemInviteIfNeeded(meta), {
          numOfAttempts: 3,
          maxDelay: 500,
        });

        try {
          logger.log('attempting to navigate to group', meta.invitedGroupId);
          navigation.jumpTo('Home', {
            screen: 'ChatList',
            params: { previewGroupId: meta.invitedGroupId },
          });
        } catch (e) {
          logger.error('failed to navigate to group', e);
        }
      }
      if (meta.inviteType === 'user' && meta.inviterUserId) {
        store.addContact(meta.inviterUserId);
        try {
          logger.log('attempting to navigate to user', meta.inviterUserId);
          navigation.jumpTo('Contacts', {
            screen: 'UserProfile',
            params: { userId: meta.inviterUserId },
          });
        } catch (e) {
          logger.error('failed to navigate to group', e);
        }
      }
    }

    runEffect();
  }, [navigation, store]);
}
