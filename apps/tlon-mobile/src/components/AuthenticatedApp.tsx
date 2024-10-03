import crashlytics from '@react-native-firebase/crashlytics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import { useAppStatusChange } from '@tloncorp/app/hooks/useAppStatusChange';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import { useNavigationLogging } from '@tloncorp/app/hooks/useNavigationLogger';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { usePostSignup } from '@tloncorp/app/hooks/usePostSignup';
import { cancelFetch, configureClient } from '@tloncorp/app/lib/api';
import { getShipAccessCode } from '@tloncorp/app/lib/hostingApi';
import { PlatformState } from '@tloncorp/app/lib/platformHelpers';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
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

const appLogger = createDevLogger('app', false);

export interface AuthenticatedAppProps {
  notificationListenerProps: NotificationListenerProps;
}

function AuthenticatedApp({
  notificationListenerProps,
}: AuthenticatedAppProps) {
  const { ship, shipUrl, authType, setShip } = useShip();
  const currentUserId = useCurrentUserId();
  const signupContext = useSignupContext();
  const handlePostSignup = usePostSignup();
  useNotificationListener(notificationListenerProps);
  useDeepLinkListener();
  useNavigationLogging();
  useNetworkLogger();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        OnboardingStackParamList,
        'TlonLogin' | 'ShipLogin'
      >
    >();

  useEffect(() => {
    configureClient({
      shipName: ship ?? '',
      shipUrl: shipUrl ?? '',
      verbose: __DEV__,
      getCode:
        authType === 'self'
          ? undefined
          : async () => {
              appLogger.log('Getting ship access code', { ship, authType });
              if (!ship) {
                throw new Error('Trying to retrieve +code, no ship set');
              }

              const { code } = await getShipAccessCode(ship);
              return code;
            },
      handleAuthFailure: () => {
        setShip({
          ship: undefined,
          shipUrl,
          authType,
          authCookie: undefined,
        });
        if (authType === 'self') {
          navigation.navigate('ShipLogin');
          return;
        }

        navigation.navigate('TlonLogin');
      },
      onReset: () => sync.syncStart(),
      onChannelReset: () => sync.handleDiscontinuity(),
      onChannelStatusChange: sync.handleChannelStatusChange,
    });

    initializeCrashReporter(crashlytics(), PlatformState);

    // TODO: remove, for use in Beta testing only
    if (currentUserId) {
      store.setErrorTrackingUserId(currentUserId);
    }

    if (signupContext.didSignup) {
      handlePostSignup();
    }

    sync.syncStart();
  }, [currentUserId, handlePostSignup, ship, shipUrl, signupContext.didSignup]);

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
