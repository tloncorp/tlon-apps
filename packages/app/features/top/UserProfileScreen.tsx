import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  GroupPreviewSheet,
  NavigationProvider,
  UserProfileScreenView,
} from '@tloncorp/ui';
import { useState } from 'react';
import { useCallback } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootStackParamList } from '../../navigation/types';
import { useConnectionStatus } from './useConnectionStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export function UserProfileScreen({ route: { params }, navigation }: Props) {
  const userId = params.userId;
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  const connectionStatus = useConnectionStatus(userId);
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'ChatList' },
            { name: 'Channel', params: { channel: dmChannel } },
          ],
        })
      );
    },
    [navigation]
  );

  const handleGroupPreviewSheetOpenChange = useCallback(
    (open: boolean) => {
      setSelectedGroup(open ? selectedGroup : null);
    },
    [selectedGroup]
  );

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
    >
      <NavigationProvider onPressGoToDm={handleGoToDm}>
        <UserProfileScreenView
          userId={userId}
          onBack={() => navigation.goBack()}
          connectionStatus={connectionStatus}
          onPressGroup={setSelectedGroup}
        />
        <GroupPreviewSheet
          open={selectedGroup !== null}
          onOpenChange={handleGroupPreviewSheetOpenChange}
          group={selectedGroup ?? undefined}
        />
      </NavigationProvider>
    </AppDataContextProvider>
  );
}
