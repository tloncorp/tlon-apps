import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  NavigationProvider,
  UserProfileScreenView,
} from '@tloncorp/ui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useConnectionStatus } from './useConnectionStatus';

export function UserProfileScreen({
  userId,
  onGoBack,
  onPressGoToDm,
}: {
  userId: string;
  onGoBack: () => void;
  onPressGoToDm: (participants: string[]) => void;
}) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  const connectionStatus = useConnectionStatus(userId);

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
    >
      <NavigationProvider onPressGoToDm={onPressGoToDm}>
        <UserProfileScreenView
          userId={userId}
          onBack={onGoBack}
          connectionStatus={connectionStatus}
        />
      </NavigationProvider>
    </AppDataContextProvider>
  );
}
