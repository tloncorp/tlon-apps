import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { GroupChannelsScreenView } from '@tloncorp/ui';
import { useMemo } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
// Adjust the import path as needed
import type { RootStackParamList } from '../types';
import { useGroupContext } from './GroupSettings/useGroupContext';

type GroupChannelsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'GroupChannels'
>;

export function GroupChannelsScreen({ route }: GroupChannelsScreenProps) {
  const groupParam = route.params.group;
  const {
    group,
    groupChannels,
    handleChannelSelected,
    handleGoBackPressed,
    handleGoToGroupMeta,
    handleGoToGroupMembers,
    handleGoToManageChannels,
    handleGoToInvitesAndPrivacy,
    handleGoToRoles,
    leaveGroup,
    togglePinned,
  } = useGroupContext({ groupId: groupParam.id });

  const currentUser = useCurrentUserId();
  const isFocused = useIsFocused();
  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });
  const pinnedItems = useMemo(() => {
    return chats?.pinned ?? [];
  }, [chats]);

  return (
    <GroupChannelsScreenView
      onChannelPressed={handleChannelSelected}
      onBackPressed={handleGoBackPressed}
      group={group ?? route.params.group}
      channels={groupChannels}
      currentUser={currentUser}
      pinned={pinnedItems ?? []}
      useGroup={store.useGroup}
      onPressGroupMeta={handleGoToGroupMeta}
      onPressGroupMembers={handleGoToGroupMembers}
      onPressManageChannels={handleGoToManageChannels}
      onPressInvitesAndPrivacy={handleGoToInvitesAndPrivacy}
      onPressRoles={handleGoToRoles}
      onPressLeave={leaveGroup}
      onTogglePinned={togglePinned}
    />
  );
}
