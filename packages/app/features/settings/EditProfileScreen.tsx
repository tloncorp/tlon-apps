import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import {
  AttachmentProvider,
  EditProfileScreenView,
  GroupsProvider,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { data: groups } = store.useGroups({ includeUnjoined: true });

  const onSaveProfile = useCallback(
    (update: api.ProfileUpdate | null) => {
      if (update) {
        store.updateCurrentUserProfile(update);
      }
      navigation.goBack();
    },
    [navigation]
  );

  const onUpdateCoverImage = useCallback((coverImage: string) => {
    store.updateCurrentUserProfile({ coverImage });
  }, []);

  const onUpdateAvatarImage = useCallback((avatarImage: string) => {
    store.updateCurrentUserProfile({ avatarImage });
  }, []);

  const canUpload = store.useCanUpload();

  return (
    <GroupsProvider groups={groups ?? []}>
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <EditProfileScreenView
          onGoBack={() => navigation.goBack()}
          onSaveProfile={onSaveProfile}
          onUpdatePinnedGroups={store.updateProfilePinnedGroups}
          onUpdateCoverImage={onUpdateCoverImage}
          onUpdateAvatarImage={onUpdateAvatarImage}
        />
      </AttachmentProvider>
    </GroupsProvider>
  );
}
