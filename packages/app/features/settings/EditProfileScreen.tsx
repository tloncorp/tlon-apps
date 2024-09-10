import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { EditProfileScreenView, GroupsProvider, View } from '@tloncorp/ui';
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
      <View flex={1}>
        <EditProfileScreenView
          canUpload={canUpload}
          uploadAsset={store.uploadAsset}
          onGoBack={onGoBack}
          onSaveProfile={onSaveProfile}
        />
      </View>
    </GroupsProvider>
  );
}
