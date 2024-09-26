import crashlytics from '@react-native-firebase/crashlytics';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import useAppForegrounded from '@tloncorp/app/hooks/useAppForegrounded';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import { useNavigationLogging } from '@tloncorp/app/hooks/useNavigationLogger';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { usePostSignup } from '@tloncorp/app/hooks/usePostSignup';
import { configureClient } from '@tloncorp/app/lib/api';
import { PlatformState } from '@tloncorp/app/lib/platformHelpers';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { initializeCrashReporter, sync } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/dist/store';
import { ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';

import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener, {
  type Props as NotificationListenerProps,
} from '../hooks/useNotificationListener';
import { refreshHostingAuth } from '../lib/refreshHostingAuth';

export interface AuthenticatedAppProps {
  notificationListenerProps: NotificationListenerProps;
}

function AuthenticatedApp({
  notificationListenerProps,
}: AuthenticatedAppProps) {
  const { ship, shipUrl } = useShip();
  const currentUserId = useCurrentUserId();
  const session = store.useCurrentSession();
  const signupContext = useSignupContext();
  const handlePostSignup = usePostSignup();
  useNotificationListener(notificationListenerProps);
  useDeepLinkListener();
  useNavigationLogging();
  useNetworkLogger();

  useEffect(() => {
    configureClient({
      shipName: ship ?? '',
      shipUrl: shipUrl ?? '',
      onReset: () => sync.syncStart(),
      verbose: __DEV__,
      onChannelReset: () => sync.handleDiscontinuity(),
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

  useAppForegrounded(() => {
    // only run these updates if we've initialized the session
    // (i.e. first startSync has completed)
    if (session) {
      sync.syncUnreads({ priority: sync.SyncPriority.High });
      sync.syncPinnedItems({ priority: sync.SyncPriority.High });
    }

    refreshHostingAuth();
  });

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
