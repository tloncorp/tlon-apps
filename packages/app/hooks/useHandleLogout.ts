import {
  createDevLogger,
  updateInitializedClient,
} from '@tloncorp/shared/dist';
import * as api from '@tloncorp/shared/dist/api';
import { useCallback } from 'react';

import { useBranch } from '../contexts/branch';
import { clearShipInfo, useShip } from '../contexts/ship';
import {
  removeHostingAuthTracking,
  removeHostingToken,
  removeHostingUserId,
} from '../utils/hosting';

const logger = createDevLogger('logout', true);

export function useHandleLogout({ resetDb }: { resetDb?: () => void }) {
  const { clearShip } = useShip();
  const { clearLure, clearDeepLink } = useBranch();

  const handleLogout = useCallback(async () => {
    api.queryClient.clear();
    api.removeUrbitClient();
    clearShip();
    clearShipInfo();
    removeHostingToken();
    removeHostingUserId();
    removeHostingAuthTracking();
    clearLure();
    clearDeepLink();
    if (!resetDb) {
      logger.trackError('could not reset db on logout');
      return;
    }
    // delay DB reset to next tick to avoid race conditions
    setTimeout(() => resetDb());
  }, [clearDeepLink, clearLure, clearShip, resetDb]);

  return handleLogout;
}
