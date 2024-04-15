import { removeUrbitClient } from '@tloncorp/shared/dist/api';
import { useCallback } from 'react';

import { useShip } from '../contexts/ship';
import { removeHostingToken, removeHostingUserId } from '../utils/hosting';

export function useLogout() {
  const { clearShip } = useShip();
  const handleLogout = useCallback(() => {
    clearShip();
    removeUrbitClient();
    removeHostingToken();
    removeHostingUserId();
  }, [clearShip]);

  return { handleLogout };
}
