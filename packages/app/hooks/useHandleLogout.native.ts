import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import { finishingSelfHostedLogin } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useBranch } from '../contexts/branch';
import { clearShipInfo, useShip } from '../contexts/ship';
import { removeHostingToken, removeHostingUserId } from '../utils/hosting';
import { clearSplashDismissed } from '../utils/splash';
import { useClearTelemetryConfig } from './useTelemetryHelpers';

const logger = createDevLogger('logout', true);

export function useHandleLogout({ resetDb }: { resetDb: () => void }) {
  const { clearShip } = useShip();
  const { clearLure, clearDeepLink } = useBranch();
  const resetTelemetry = useClearTelemetryConfig();

  const handleLogout = useCallback(async () => {
    api.queryClient.clear();
    store.removeClient();
    clearShip();
    clearShipInfo();
    removeHostingToken();
    removeHostingUserId();
    clearLure();
    clearDeepLink();
    clearSplashDismissed();
    resetTelemetry();
    finishingSelfHostedLogin.resetValue();
    if (!resetDb) {
      logger.trackError('could not reset db on logout');
      return;
    }
    // delay DB reset to next tick to avoid race conditions
    setTimeout(() => resetDb());
  }, [clearDeepLink, clearLure, clearShip, resetDb, resetTelemetry]);

  return handleLogout;
}
