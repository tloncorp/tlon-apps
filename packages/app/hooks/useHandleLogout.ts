import * as api from '@tloncorp/shared/dist/api';
import { useCallback } from 'react';

import { clearShipInfo, useShip } from '../contexts/ship';
import { resetDb } from '../lib/nativeDb';
import {
  removeHostingAuthTracking,
  removeHostingToken,
  removeHostingUserId,
} from '../utils/hosting';

export function useHandleLogout() {
  const { clearShip } = useShip();

  const handleLogout = useCallback(async () => {
    api.queryClient.clear();
    api.removeUrbitClient();
    clearShip();
    clearShipInfo();
    removeHostingToken();
    removeHostingUserId();
    removeHostingAuthTracking();
    // delay DB reset to next tick to avoid race conditions
    setTimeout(() => resetDb());
  }, []);

  return handleLogout;
}
