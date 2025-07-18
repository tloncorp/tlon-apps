import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { useHandleGoBack } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { GroupMembersScreenView } from '../../ui';
import { useRootNavigation } from '../../navigation/utils';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMembers'
>;

export function GroupMembersScreen(props: Props) {
  const { groupId, fromChatDetails } = props.route.params;
  const { navigation } = props;
  const { navigation: rootNavigation } = useRootNavigation();
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

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
  });

  const handleGoToProfile = useCallback(
    (contactId: string) => {
      return rootNavigation.navigate('UserProfile', { userId: contactId });
    },
    [rootNavigation]
  );

  return (
    <GroupMembersScreenView
      goBack={handleGoBack}
      onPressGoToProfile={handleGoToProfile}
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
