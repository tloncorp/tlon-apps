import * as api from '@tloncorp/shared/dist/api';
import { useCallback } from 'react';

import { clearShipInfo, useShip } from '../contexts/ship';
import { purgeDb } from '../lib/nativeDb';
import { removeHostingToken, removeHostingUserId } from '../utils/hosting';

export function useHandleLogout() {
  const { clearShip } = useShip();

  const handleLogout = useCallback(async () => {
    await purgeDb();
    api.queryClient.clear();
    api.removeUrbitClient();
    clearShip();
    clearShipInfo();
    removeHostingToken();
    removeHostingUserId();
  }, [clearShip]);

  return handleLogout;
}
