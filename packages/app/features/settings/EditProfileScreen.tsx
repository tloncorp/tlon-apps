import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AttachmentProvider,
  EditProfileScreenView,
  GroupsProvider,
} from '@tloncorp/ui';
import { useCallback } from 'react';

export function EditProfileScreen({ onGoBack }: { onGoBack: () => void }) {
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
      onGoBack();
    },
    [onGoBack]
  );

  const canUpload = store.useCanUpload();

  return (
    <GroupsProvider groups={groups ?? []}>
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <EditProfileScreenView
          onGoBack={onGoBack}
          onSaveProfile={onSaveProfile}
        />
      </AttachmentProvider>
    </GroupsProvider>
  );
}
