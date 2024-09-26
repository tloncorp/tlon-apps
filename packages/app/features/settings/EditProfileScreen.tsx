import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AttachmentProvider,
  EditProfileScreenView,
  GroupsProvider,
} from '@tloncorp/ui';
import { useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';


import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { data: groups } = store.useGroups({ includeUnjoined: true });

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
      navigation.goBack();
    },
    [navigation]
  );

  const canUpload = store.useCanUpload();

  return (
    <GroupsProvider groups={groups ?? []}>
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <EditProfileScreenView
          onGoBack={() => navigation.goBack()}
          onSaveProfile={onSaveProfile}
        />
      </AttachmentProvider>
    </GroupsProvider>
  );
}
