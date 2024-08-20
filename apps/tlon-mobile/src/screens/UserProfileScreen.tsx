import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser.native';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  NavigationProvider,
  UserProfileScreenView,
  View,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      props.navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'ChatList' },
            { name: 'Channel', params: { channel: dmChannel } },
          ],
        })
      );
    },
    [props.navigation]
  );

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
    >
      <NavigationProvider onPressGoToDm={handleGoToDm}>
        <View backgroundColor="$secondaryBackground" flex={1}>
          <UserProfileScreenView
            userId={props.route.params.userId}
            onBack={() => props.navigation.goBack()}
          />
        </View>
      </NavigationProvider>
    </AppDataContextProvider>
  );
}
