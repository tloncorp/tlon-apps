import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  NavigationProvider,
  UserProfileScreenView,
  View,
} from '@tloncorp/ui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';

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

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
    >
      <NavigationProvider onPressGoToDm={onPressGoToDm}>
        <View backgroundColor="$secondaryBackground" flex={1}>
          <UserProfileScreenView userId={userId} onBack={onGoBack} />
        </View>
      </NavigationProvider>
    </AppDataContextProvider>
  );
}
