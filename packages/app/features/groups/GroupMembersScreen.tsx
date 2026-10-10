import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';

import { useHandleGoBack } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { useGroupRosterPages } from '../../hooks/useGroupRosterPages';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import { GroupMembersScreenView, pagedMembers } from '../../ui';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMembers'
>;

export function GroupMembersScreen(props: Props) {
  const { groupId, fromChatDetails } = props.route.params;
  const { navigation } = props;
  const { navigation: rootNavigation } = useRootNavigation();
  const {
    group,
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
  const roster = useGroupRosterPages(group);
  const members = useMemo(
    () =>
      roster.paged
        ? pagedMembers(groupMembers, {
            loadedThrough: roster.loadedThrough,
            awaitingFirstPage: roster.awaitingFirstPage,
          })
        : groupMembers,
    [groupMembers, roster.paged, roster.loadedThrough, roster.awaitingFirstPage]
  );

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
      members={members}
      onEndReached={roster.loadMore}
      isLoadingMore={roster.isLoading}
      searchesLoadedOnly={roster.hasMore}
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
