// TODO: Seems like we need something totally different for web than this.
// Branch context and methods removed here because a) it's not used and
// b) it breaks the web build because it relies on react-native-branch,
// which isn't made for web.
import { createDevLogger } from '@tloncorp/shared';
import { clearAuthInfo, isElectronEnv } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import { clearSessionStorageItems } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useShip } from '../contexts/ship';
import { cancelNodeResumeNudge } from '../lib/notifications';

// Can't signup via the webapp, so this is commented out.
// We might allow this in a desktop app in the future.
// import { useSignupContext } from '../contexts/signup';

const logger = createDevLogger('logout', true);

export function useHandleLogout({ resetDb }: { resetDb?: () => void }) {
  const { clearShip } = useShip();
  // const signupContext = useSignupContext();

  const handleLogout = useCallback(async () => {
    logger.info('Logging out');
    api.queryClient.clear();
    store.removeClient();
    clearShip();
    clearSessionStorageItems();
    cancelNodeResumeNudge();

    // Clear Electron stored credentials if in Electron environment
    if (isElectronEnv()) {
      logger.log('Clearing stored auth credentials');
      try {
        await clearAuthInfo();
        logger.log('Cleared stored auth credentials');
      } catch (error) {
        logger.trackError('Failed to clear stored auth info', { error });
      }
    }

    if (!resetDb) {
      logger.trackError('could not reset db on logout');
      return;
    }
    // delay DB reset to next tick to avoid race conditions
    setTimeout(() => resetDb());

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [clearShip, resetDb]);

  return handleLogout;
}
