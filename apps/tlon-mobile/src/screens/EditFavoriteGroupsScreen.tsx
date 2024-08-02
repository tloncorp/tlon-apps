import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  EditFavoriteGroupsScreenView,
  GroupsProvider,
  View,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditFavoriteGroups'>;

export function EditFavoriteGroupsScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  const { data: groups } = store.useGroups({ includeUnjoined: true });

  const onGoBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
    >
      <GroupsProvider groups={groups ?? []}>
        <View flex={1}>
          <EditFavoriteGroupsScreenView onGoBack={onGoBack} />
        </View>
      </GroupsProvider>
    </AppDataContextProvider>
  );
}
