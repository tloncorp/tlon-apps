import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser.native';
import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  EditProfileScreenView,
  GroupsProvider,
  View,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  const { data: groups } = store.useGroups({ includeUnjoined: true });

  const onGoBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const onSaveProfile = useCallback(
    (update: {
      profile: api.ProfileUpdate | null;
      pinnedGroups?: db.Group[] | null;
    }) => {
      if (update.profile) {
        store.updateCurrentUserProfile(update.profile);
      }
      if (update.pinnedGroups) {
        store.updateProfilePinnedGroups(update.pinnedGroups);
      }
      props.navigation.goBack();
    },
    [props.navigation]
  );

  const canUpload = store.useCanUpload();

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
    >
      <GroupsProvider groups={groups ?? []}>
        <View flex={1}>
          <EditProfileScreenView
            canUpload={canUpload}
            uploadAsset={store.uploadAsset}
            onGoBack={onGoBack}
            onSaveProfile={onSaveProfile}
          />
        </View>
      </GroupsProvider>
    </AppDataContextProvider>
  );
}
