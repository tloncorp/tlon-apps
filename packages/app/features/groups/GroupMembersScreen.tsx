import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { useHandleGoBack } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import { GroupMembersScreenView } from '../../ui';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMembers'
>;

export function GroupMembersScreen(props: Props) {
  const { groupId, fromChatDetails } = props.route.params;
  const { navigation } = props;
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

  const { resetToDm } = useRootNavigation();

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
  });

  const handleGoToDm = useCallback(
    (contactId: string) => {
      return resetToDm(contactId);
    },
    [resetToDm]
  );

  return (
    <GroupMembersScreenView
      goBack={handleGoBack}
      onPressGoToDm={handleGoToDm}
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
