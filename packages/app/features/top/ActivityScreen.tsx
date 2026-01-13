import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { useTheme } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useFeatureFlag } from '../../lib/featureFlags';
import { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import { ActivityScreenView, NavBarView, View } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

export function ActivityScreen(props: Props) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const currentUserId = useCurrentUserId();
  const [contactsTabEnabled] = useFeatureFlag('contactsTab');
  const { performGroupAction } = useGroupActions();
  const { navigateToChannel, navigateToPost } = useRootNavigation();

  const allFetcher = store.useInfiniteBucketedActivity('all');
  const mentionsFetcher = store.useInfiniteBucketedActivity('mentions');
  const repliesFetcher = store.useInfiniteBucketedActivity('replies');
  const bucketedActivity = useMemo(() => {
    return {
      all: allFetcher,
      replies: repliesFetcher,
      mentions: mentionsFetcher,
    };
  }, [allFetcher, mentionsFetcher, repliesFetcher]);

  const handleRefreshActivity = useCallback(async () => {
    return store.resetActivity();
  }, []);

  const handleGoToChannel = useCallback(
    (channel: db.Channel, selectedPostId?: string) => {
      navigateToChannel(channel, selectedPostId);
    },
    [navigateToChannel]
  );

  // TODO: if diary or gallery, figure out a way to pop open the comment
  // sheet
  const handleGoToThread = useCallback(
    (post: db.Post) => {
      // TODO: we have no way to route to specific thread message rn
      navigateToPost(post);
    },
    [navigateToPost]
  );

  const handleGoToGroup = useCallback(
    (group: db.Group) => {
      store.markGroupRead(group.id);
      props.navigation.navigate('GroupSettings', {
        screen: 'GroupMembers',
        params: { groupId: group.id },
      });
    },
    [props.navigation]
  );

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.navigate('UserProfile', { userId });
    },
    [props.navigation]
  );

  const handleNavigateToContacts = useCallback(() => {
    props.navigation.navigate('Contacts');
  }, [props.navigation]);

  const handleInviteFriends = useCallback(() => {
    props.navigation.navigate('InviteSystemContacts');
  }, [props.navigation]);

  return (
    <View backgroundColor={theme.background?.val} flex={1}>
      <View flex={1} width="100%" maxWidth={600} marginHorizontal="auto">
        <ActivityScreenView
          bucketFetchers={bucketedActivity}
          isFocused={isFocused}
          goToChannel={handleGoToChannel}
          goToThread={handleGoToThread}
          goToGroup={handleGoToGroup}
          goToUserProfile={handleGoToUserProfile}
          refresh={handleRefreshActivity}
          onGroupAction={performGroupAction}
          onNavigateToContacts={handleNavigateToContacts}
          onInviteFriends={handleInviteFriends}
        />
        <NavBarView
          navigateToContacts={() => props.navigation.navigate('Contacts')}
          navigateToHome={() => props.navigation.navigate('ChatList')}
          navigateToNotifications={() => props.navigation.navigate('Activity')}
          currentRoute="Activity"
          currentUserId={currentUserId}
          showContactsTab={contactsTabEnabled}
        />
      </View>
    </View>
  );
}
