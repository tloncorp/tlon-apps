import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser.native';
import { useGroupContext } from '@tloncorp/app/hooks/useGroupContext';
import { GroupMembersScreenView } from '@tloncorp/ui';

import { GroupSettingsStackParamList } from '../../types';

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
