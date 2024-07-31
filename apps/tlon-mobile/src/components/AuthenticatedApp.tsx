import crashlytics from '@react-native-firebase/crashlytics';
import { setCrashReporter, sync } from '@tloncorp/shared';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import { ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';

import { useShip } from '../contexts/ship';
import useAppForegrounded from '../hooks/useAppForegrounded';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener, {
  type Props as NotificationListenerProps,
} from '../hooks/useNotificationListener';
import { configureClient } from '../lib/api';
import { RootStack } from '../navigation/RootStack';

export interface AuthenticatedAppProps {
  notificationListenerProps: NotificationListenerProps;
}

function AuthenticatedApp({
  notificationListenerProps,
}: AuthenticatedAppProps) {
  const { ship, shipUrl } = useShip();
  const currentUserId = useCurrentUserId();
  useNotificationListener(notificationListenerProps);
  useDeepLinkListener();
  const session = store.useCurrentSession();

  useEffect(() => {
    configureClient({
      shipName: ship ?? '',
      shipUrl: shipUrl ?? '',
      onReset: () => sync.syncStart(),
      onChannelReset: () => sync.handleDiscontinuity(),
    });

    setCrashReporter(crashlytics());

    // TODO: remove, for use in Beta testing only
    if (currentUserId) {
      logic.setErrorTrackingUserId(currentUserId);
    }

    sync.syncStart();
  }, [currentUserId, ship, shipUrl]);

  useAppForegrounded(() => {
    // only run these updates if we've initialized the session
    // (i.e. first startSync has completed)
    if (session) {
      sync.syncUnreads({ priority: sync.SyncPriority.High });
      sync.syncPinnedItems({ priority: sync.SyncPriority.High });
    }
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
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp {...props} />
    </QueryClientProvider>
  );
}
