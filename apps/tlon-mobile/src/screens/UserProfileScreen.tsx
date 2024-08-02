import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  UserProfileScreenView,
  View,
} from '@tloncorp/ui';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
    >
      <View backgroundColor="$secondaryBackground" flex={1}>
        <UserProfileScreenView
          userId={props.route.params.userId}
          onBack={() => props.navigation.goBack()}
        />
      </View>
    </AppDataContextProvider>
  );
}
