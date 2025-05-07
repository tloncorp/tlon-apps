import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import { GroupMembersScreenView } from '../../ui';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMembers'
>;

export function GroupMembersScreen({ route }: Props) {
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
    addUserToRole,
    removeUserFromRole,
  } = useGroupContext({
    groupId,
  });

  const currentUserId = useCurrentUserId();

  const { resetToDm, navigateToChatDetails } = useRootNavigation();

  const handleGoBack = useCallback(() => {
    navigateToChatDetails({ type: 'group', id: groupId });
  }, [navigateToChatDetails, groupId]);

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      resetToDm(participants[0]);
    },
    [resetToDm]
  );

  return (
    <GroupMembersScreenView
      goBack={handleGoBack}
      onPressGoToDm={(contactId: string) => handleGoToDm([contactId])}
      members={groupMembers}
      roles={groupRoles}
      groupId={groupId}
      currentUserId={currentUserId}
      onPressBan={banUser}
      onPressUnban={unbanUser}
      onPressAcceptJoinRequest={acceptUserJoin}
      onPressRejectJoinRequest={rejectUserJoin}
      onPressAssignRole={addUserToRole}
      onPressRemoveRole={removeUserFromRole}
      onPressKick={kickUser}
      bannedUsers={bannedUsers}
      joinRequests={joinRequests}
      groupPrivacyType={groupPrivacyType}
    />
  );
}
