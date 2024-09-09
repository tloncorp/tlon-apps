import * as api from '@tloncorp/shared/dist/api';
import { useCallback } from 'react';

import { clearShipInfo, useShip } from '../contexts/ship';
import { removeHostingToken, removeHostingUserId } from '../utils/hosting';

export function useHandleLogout({ resetDb }: { resetDb?: () => void }) {
  const { clearShip } = useShip();

  const handleLogout = useCallback(async () => {
    api.queryClient.clear();
    api.removeUrbitClient();
    clearShip();
    clearShipInfo();
    removeHostingToken();
    removeHostingUserId();
    // delay DB reset to next tick to avoid race conditions
    if (!resetDb) return;
    setTimeout(() => resetDb());
  }, [clearShip, resetDb]);

  return handleLogout;
}
