import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import { clearSessionStorageItems } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useBranch } from '../contexts/branch';
import { useShip } from '../contexts/ship';
import { cancelNodeResumeNudge } from '../lib/notifications';
import { useClearTelemetryConfig } from './useTelemetry';

const logger = createDevLogger('logout', true);

export function useHandleLogout({ resetDb }: { resetDb: () => void }) {
  const { clearShip } = useShip();
  const { clearLure, clearDeepLink } = useBranch();
  const clearTelemetry = useClearTelemetryConfig();

  const handleLogout = useCallback(async () => {
    api.queryClient.clear();
    store.removeClient();
    clearShip();
    clearLure();
    clearDeepLink();
    clearTelemetry();
    clearSessionStorageItems();
    cancelNodeResumeNudge();
    if (!resetDb) {
      logger.trackError('could not reset db on logout');
      return;
    }
    // delay DB reset to next tick to avoid race conditions
    setTimeout(() => resetDb());
  }, [clearDeepLink, clearLure, clearShip, resetDb, clearTelemetry]);

  return handleLogout;
}
