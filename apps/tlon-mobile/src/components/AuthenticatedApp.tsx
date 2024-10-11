import crashlytics from '@react-native-firebase/crashlytics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useAppStatusChange } from '@tloncorp/app/hooks/useAppStatusChange';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useNavigationLogging } from '@tloncorp/app/hooks/useNavigationLogger';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import { cancelFetch, configureClient } from '@tloncorp/app/lib/api';
import { getShipAccessCode } from '@tloncorp/app/lib/hostingApi';
import { PlatformState } from '@tloncorp/app/lib/platformHelpers';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { trackError } from '@tloncorp/app/utils/posthog';
import {
  createDevLogger,
  initializeCrashReporter,
  sync,
} from '@tloncorp/shared';
import * as store from '@tloncorp/shared/dist/store';
import { ZStack } from '@tloncorp/ui';
import { useCallback, useEffect } from 'react';
import { AppStateStatus } from 'react-native';

import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener, {
  type Props as NotificationListenerProps,
} from '../hooks/useNotificationListener';
import { OnboardingStackParamList } from '../types';

export interface AuthenticatedAppProps {
  notificationListenerProps: NotificationListenerProps;
}

const appLogger = createDevLogger('app', false);

function AuthenticatedApp({
  notificationListenerProps,
}: AuthenticatedAppProps) {
  const shipInfo = useShip();
  const { ship, shipUrl, authType } = shipInfo;
  const currentUserId = useCurrentUserId();
  const configureClient = useConfigureUrbitClient();
  useNotificationListener(notificationListenerProps);
  useDeepLinkListener();
  useNavigationLogging();
  useNetworkLogger();
  const resetDb = useResetDb();
  const logout = useHandleLogout({
    resetDb: () => {
      appLogger.log('Resetting db on logout');
      resetDb();
    },
  });
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        OnboardingStackParamList,
        'TlonLogin' | 'ShipLogin'
      >
    >();

  useEffect(() => {
    configureClient();

    initializeCrashReporter(crashlytics(), PlatformState);

    // TODO: remove, for use in Beta testing only
    if (currentUserId) {
      store.setErrorTrackingUserId(currentUserId);
    }

    sync.syncStart();
  }, [currentUserId, ship, shipUrl]);

  const handleAppStatusChange = useCallback((status: AppStateStatus) => {
    if (status === 'active') {
      sync.syncUnreads({ priority: sync.SyncPriority.High });
      sync.syncPinnedItems({ priority: sync.SyncPriority.High });
    } else if (status === 'background') {
      cancelFetch();
    }
  }, []);

  useAppStatusChange(handleAppStatusChange);

  return (
    <ZStack flex={1}>
      <RootStack />
    </ZStack>
  );
}

export default function ConnectedAuthenticatedApp(
  props: AuthenticatedAppProps
) {
  return (
    <AppDataProvider>
      <AuthenticatedApp {...props} />
    </AppDataProvider>
  );
}
