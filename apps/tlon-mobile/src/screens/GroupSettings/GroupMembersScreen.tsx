import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GroupMembersScreenView } from '@tloncorp/ui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { GroupSettingsStackParamList } from '../../types';
import { useGroupContext } from './useGroupContext';

type GroupMembersScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMembers'
>;

export function GroupMembersScreen(props: GroupMembersScreenProps) {
  const { groupId } = props.route.params;

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

  return (
    <GroupMembersScreenView
      goBack={props.navigation.goBack}
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
