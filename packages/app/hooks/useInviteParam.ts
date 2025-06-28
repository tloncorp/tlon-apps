import {
  createDevLogger,
  getMetadataFromInviteToken,
  withRetry,
} from '@tloncorp/shared';
import { useEffect } from 'react';

import { useTypedReset } from '../navigation/utils';
import { useStore } from '../ui';

const logger = createDevLogger('useInviteParam', false);

export function useInviteParam() {
  const store = useStore();
  const reset = useTypedReset();

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
        withRetry(() => store.redeemInviteIfNeeded(meta), {
          numOfAttempts: 3,
          maxDelay: 500,
        });
      }
      if (meta.inviteType === 'user' && meta.inviterUserId) {
        store.addContact(meta.inviterUserId);
      }
    }

    runEffect();
  }, [store]);
}
