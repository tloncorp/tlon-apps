import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { AppDataContextProvider, GroupChannelsScreenView } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import type { GroupSettingsStackParamList, RootStackParamList } from '../types';
import { useGroupContext } from './GroupSettings/useGroupContext';

type GroupChannelsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'GroupChannels'
>;

export function GroupChannelsScreen({
  route,
  navigation,
}: GroupChannelsScreenProps) {
  const groupParam = route.params.group;
  const groupQuery = store.useGroup({ id: groupParam.id });
  const currentUser = useCurrentUserId();
  const isFocused = useIsFocused();
  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });

  const pinnedItems = useMemo(() => {
    return chats?.pinned ?? [];
  }, [chats]);

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

  const { leaveGroup, togglePinned } = useGroupContext({
    groupId: groupParam.id,
  });

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

  const handleLeaveGroup = useCallback(async () => {
    leaveGroup();
    navigation.goBack();
  }, [leaveGroup, navigation]);

  const handleTogglePinned = useCallback(() => {
    togglePinned();
  }, [togglePinned]);

  return (
    <AppDataContextProvider contacts={contactsQuery.data ?? null}>
      <GroupChannelsScreenView
        onChannelPressed={handleChannelSelected}
        onBackPressed={handleGoBackPressed}
        group={groupQuery.data ?? route.params.group}
        channels={groupQuery.data?.channels ?? route.params.group.channels}
        currentUser={currentUser}
        pinned={pinnedItems ?? []}
        useGroup={store.useGroup}
        onPressGroupMeta={handleGoToGroupMeta}
        onPressGroupMembers={handleGoToGroupMembers}
        onPressManageChannels={handleGoToManageChannels}
        onPressInvitesAndPrivacy={handleGoToInvitesAndPrivacy}
        onPressRoles={handleGoToRoles}
        onPressLeave={handleLeaveGroup}
        onTogglePinned={handleTogglePinned}
      />
    </AppDataContextProvider>
  );
}
