import { createDevLogger } from '@tloncorp/shared/dist';
import * as api from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';

import { useBranch } from '../contexts/branch';
import { clearShipInfo, useShip } from '../contexts/ship';
import { useSignupContext } from '../contexts/signup';
import {
  removeHostingAuthTracking,
  removeHostingToken,
  removeHostingUserId,
} from '../utils/hosting';
import { clearSplashDismissed } from '../utils/splash';

const logger = createDevLogger('logout', true);

export function useHandleLogout({ resetDb }: { resetDb?: () => void }) {
  const { clearShip } = useShip();
  const { clearLure, clearDeepLink } = useBranch();
  const signupContext = useSignupContext();

  const handleLogout = useCallback(async () => {
    api.queryClient.clear();
    store.removeClient();
    clearShip();
    clearShipInfo();
    removeHostingToken();
    removeHostingUserId();
    removeHostingAuthTracking();
    clearLure();
    clearDeepLink();
    clearSplashDismissed();
    signupContext.clear();
    if (!resetDb) {
      logger.trackError('could not reset db on logout');
      return;
    }
    // delay DB reset to next tick to avoid race conditions
    setTimeout(() => resetDb());
  }, [clearDeepLink, clearLure, clearShip, resetDb, signupContext]);

  return handleLogout;
}
