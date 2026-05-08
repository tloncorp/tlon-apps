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
  const { navigation: rootNavigation } = useRootNavigation();
  const {
    groupMembers,
    groupRoles,
    bannedUsers,
    acceptUserJoin,
    rejectUserJoin,
    joinRequests,
    groupPrivacyType,
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
      onPressAcceptJoinRequest={acceptUserJoin}
      onPressRejectJoinRequest={rejectUserJoin}
      bannedUsers={bannedUsers}
      joinRequests={joinRequests}
      groupPrivacyType={groupPrivacyType}
    />
  );
}
