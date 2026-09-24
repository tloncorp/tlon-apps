import { AnalyticsEvent, createDevLogger, trackEvent } from '@tloncorp/shared';
import { queryClient } from '@tloncorp/shared';
import { clearSessionStorageItems } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { clearLastNotificationResponseAsync } from 'expo-notifications';
import { useCallback } from 'react';

import { useBranch } from '../contexts/branch';
import { useShip } from '../contexts/ship';
import { resetBotSettingsDraft } from '../features/settings/bot/useBotSettingsDraft';
import { cancelNodeResumeNudge } from '../lib/notifications';
import { resetNavigationRestored } from '../navigation/navigationRestore';
import { useClearTelemetryConfig } from './useTelemetry';

const logger = createDevLogger('logout', true);

export function useHandleLogout({ resetDb }: { resetDb: () => void }) {
  const { clearShip } = useShip();
  const { clearLure, clearDeepLink } = useBranch();
  const clearTelemetry = useClearTelemetryConfig();

  const handleLogout = useCallback(async () => {
    // A target held while the desk notice was up must not be consumed by the
    // next login (TLON-6531).
    try {
      await clearLastNotificationResponseAsync();
    } catch (error) {
      logger.trackError(AnalyticsEvent.ErrorNotificationService, {
        context: 'Failed to clear last notification response on logout',
        error,
      });
    }
    queryClient.clear();
    store.removeClient();
    clearShip();
    clearLure();
    clearDeepLink();
    trackEvent(AnalyticsEvent.LogoutCompleted);
    clearTelemetry();
    clearSessionStorageItems();
    store.updateSession(null);
    store.clearSyncStartLock();
    cancelNodeResumeNudge();
    resetBotSettingsDraft();
    resetNavigationRestored();
    if (!resetDb) {
      logger.trackError('could not reset db on logout');
      return;
    }
    // delay DB reset to next tick to avoid race conditions
    setTimeout(() => resetDb());
  }, [clearDeepLink, clearLure, clearShip, resetDb, clearTelemetry]);

  return handleLogout;
}
