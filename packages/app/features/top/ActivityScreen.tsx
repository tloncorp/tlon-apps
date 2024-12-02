import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ActivityScreenView, NavBarView, View } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

// import ErrorBoundary from '../../ErrorBoundary';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useFeatureFlag } from '../../lib/featureFlags';
import { RootStackParamList } from '../../navigation/types';
import { screenNameFromChannelId } from '../../navigation/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

export function ActivityScreen(props: Props) {
  const isFocused = useIsFocused();
  const currentUserId = useCurrentUserId();
  const [contactsTabEnabled] = useFeatureFlag('contactsTab');
  const { performGroupAction } = useGroupActions();

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
      const screenName = screenNameFromChannelId(channel.id);
      props.navigation.navigate(screenName, {
        channelId: channel.id,
        selectedPostId,
      });
    },
    [props.navigation]
  );

  // TODO: if diary or gallery, figure out a way to pop open the comment
  // sheet
  const handleGoToThread = useCallback(
    (post: db.Post) => {
      // TODO: we have no way to route to specific thread message rn
      props.navigation.navigate('Post', {
        postId: post.id,
        authorId: post.authorId,
        channelId: post.channelId,
      });
    },
    [props.navigation]
  );

  const handleGoToGroup = useCallback(
    (group: db.Group) => {
      store.markGroupRead(group);
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

  return (
    <View backgroundColor="$background" flex={1}>
      <ActivityScreenView
        bucketFetchers={bucketedActivity}
        isFocused={isFocused}
        goToChannel={handleGoToChannel}
        goToThread={handleGoToThread}
        goToGroup={handleGoToGroup}
        goToUserProfile={handleGoToUserProfile}
        refresh={handleRefreshActivity}
        onGroupAction={performGroupAction}
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
  );
}
