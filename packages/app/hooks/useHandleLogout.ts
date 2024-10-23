// TODO: Seems like we need something totally different for web than this.
// Branch context and methods removed here because a) it's not used and
// b) it breaks the web build because it relies on react-native-branch,
// which isn't made for web.
import { createDevLogger } from '@tloncorp/shared/dist';
import * as api from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';

import { clearShipInfo, useShip } from '../contexts/ship';
// Can't signup via the webapp, so this is commented out.
// We might allow this in a desktop app in the future.
// import { useSignupContext } from '../contexts/signup';
import {
  removeHostingAuthTracking,
  removeHostingToken,
  removeHostingUserId,
} from '../utils/hosting';
import { clearSplashDismissed } from '../utils/splash';

const logger = createDevLogger('logout', true);

export function useHandleLogout({ resetDb }: { resetDb?: () => void }) {
  const { clearShip } = useShip();
  // const signupContext = useSignupContext();

  const handleLogout = useCallback(async () => {
    api.queryClient.clear();
    store.removeClient();
    clearShip();
    clearShipInfo();
    removeHostingToken();
    removeHostingUserId();
    removeHostingAuthTracking();
    clearSplashDismissed();
    // signupContext.clear();
    if (!resetDb) {
      logger.trackError('could not reset db on logout');
      return;
    }
    // delay DB reset to next tick to avoid race conditions
    setTimeout(() => resetDb());
  }, [clearShip, resetDb]);

  return handleLogout;
}
