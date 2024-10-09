import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { GroupMembersScreenView } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMembers'
>;

export function GroupMembersScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const {
    groupMembers,
    groupRoles,
    banUser,
    unbanUser,
    kickUser,
    bannedUsers,
    acceptUserJoin,
    rejectUserJoin,
    joinRequests,
    groupPrivacyType,
  } = useGroupContext({
    groupId,
  });

  const currentUserId = useCurrentUserId();

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

  return (
    <GroupMembersScreenView
      goBack={() => navigation.goBack()}
      onPressGoToDm={(contactId: string) => handleGoToDm([contactId])}
      members={groupMembers}
      roles={groupRoles}
      currentUserId={currentUserId}
      onPressBan={banUser}
      onPressUnban={unbanUser}
      onPressAcceptJoinRequest={acceptUserJoin}
      onPressRejectJoinRequest={rejectUserJoin}
      onPressKick={kickUser}
      bannedUsers={bannedUsers}
      joinRequests={joinRequests}
      groupPrivacyType={groupPrivacyType}
    />
  );
}
