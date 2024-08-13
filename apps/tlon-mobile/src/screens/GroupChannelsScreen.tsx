import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  GroupChannelsScreenView,
  GroupOptionsProvider,
} from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import type { GroupSettingsStackParamList, RootStackParamList } from '../types';

type GroupChannelsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'GroupChannels'
>;

export function GroupChannelsScreen({
  route,
  navigation,
}: GroupChannelsScreenProps) {
  const groupParam = route.params.group;
  const currentUser = useCurrentUserId();
  const isFocused = useIsFocused();
  const { data: pins } = store.usePins({
    enabled: isFocused,
  });

  const pinnedItems = useMemo(() => {
    return pins ?? [];
  }, [pins]);

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      navigation.navigate('Channel', {
        channel: channel,
      });
    },
    [navigation]
  );

  const handleGoBackPressed = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const contactsQuery = store.useContacts();

  const navigateToGroupSettings = useCallback(
    <T extends keyof GroupSettingsStackParamList>(
      screen: T,
      params: GroupSettingsStackParamList[T]
    ) => {
      navigation.navigate('GroupSettings', {
        screen,
        params,
      } as any);
    },
    [navigation]
  );

  const handleGoToGroupMeta = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupMeta', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToGroupMembers = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupMembers', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToManageChannels = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('ManageChannels', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToInvitesAndPrivacy = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('InvitesAndPrivacy', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToRoles = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupRoles', { groupId });
    },
    [navigateToGroupSettings]
  );

  return (
    <AppDataContextProvider contacts={contactsQuery.data ?? null}>
      <GroupOptionsProvider
        groupId={groupParam.id}
        pinned={pinnedItems}
        useGroup={store.useGroup}
        onPressGroupMeta={handleGoToGroupMeta}
        onPressGroupMembers={handleGoToGroupMembers}
        onPressManageChannels={handleGoToManageChannels}
        onPressInvitesAndPrivacy={handleGoToInvitesAndPrivacy}
        onPressRoles={handleGoToRoles}
      >
        <GroupChannelsScreenView
          onChannelPressed={handleChannelSelected}
          onBackPressed={handleGoBackPressed}
          currentUser={currentUser}
        />
      </GroupOptionsProvider>
    </AppDataContextProvider>
  );
}
