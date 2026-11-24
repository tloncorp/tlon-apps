import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect } from 'react';

import { useNavigation } from '../../navigation/utils';

const logger = createDevLogger('useAgentOnboardingInviteConsumer', false);

const WAIT_MS = 500;
// A late setup can leave the workspace a little behind the chat; give it this
// long to sync before opening its invite screen anyway.
const MAX_WAITS = 60;

/**
 * Invite friends, at the end of the first run, opens the Tlonbot DM and then
 * the workspace's invite screen. The first run leaves a request behind its
 * cover; this opens the screen once, after the workspace is on the device.
 */
export function useAgentOnboardingInviteConsumer() {
  const navigation = useNavigation();
  const request = db.agentOnboardingInviteRequest.useValue();
  useEffect(() => {
    if (!request) return;
    let active = true;
    void (async () => {
      for (let attempt = 0; active && attempt < MAX_WAITS; attempt++) {
        const group = await db
          .getGroup({ id: request.groupId })
          .catch(() => null);
        if (group) break;
        await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
      }
      if (!active) return;
      try {
        await db.agentOnboardingInviteRequest.resetValue();
        navigation.navigate('InviteUsers', { groupId: request.groupId });
      } catch (error) {
        logger.trackError('Failed to open the onboarding invite screen', {
          error,
          groupId: request.groupId,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [navigation, request]);
}
