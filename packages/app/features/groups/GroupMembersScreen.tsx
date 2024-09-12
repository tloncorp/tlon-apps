import { GroupMembersScreenView } from '@tloncorp/ui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';

export function GroupMembersScreen({
  groupId,
  onGoBack,
}: {
  groupId: string;
  onGoBack: () => void;
}) {
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
      goBack={onGoBack}
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
