import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/shared/api';
import * as store from '@tloncorp/shared/store';
import {
  AttachmentProvider,
  EditProfileScreenView,
  GroupsProvider,
} from '@tloncorp/ui';
import { useCurrentUserId } from 'packages/app/hooks/useCurrentUser';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ route, navigation }: Props) {
  const currentUserId = useCurrentUserId();
  const { data: groups } = store.useGroups({ includeUnjoined: true });

  const onSaveProfile = useCallback(
    (update: api.ProfileUpdate | null) => {
      if (update) {
        if (route.params.userId === currentUserId) {
          store.updateCurrentUserProfile(update);
        } else {
          store.updateContactMetadata(route.params.userId, {
            nickname: update.nickname,
            avatarImage: update.avatarImage,
          });
        }
      }
      navigation.goBack();
    },
    [currentUserId, navigation, route.params.userId]
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
          userId={route.params.userId}
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
