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

import { useCurrentUserId } from '../../hooks/useCurrentUser';

export function EditProfileScreen({ onGoBack }: { onGoBack: () => void }) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
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
