import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { useTheme } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useSyncStatus } from '../../hooks/useSyncStatus';
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
  const { subtitle: syncSubtitle, loadingSubtitle: syncLoadingSubtitle } =
    useSyncStatus();

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

  const isLoading = useMemo(() => {
    // if still loading the initial activity data, show loading
    return allFetcher.isFetching && !allFetcher.activity.length;
  }, [allFetcher.isFetching, allFetcher.activity.length]);

  const loadingSubtitle = useMemo(() => {
    if (isLoading) {
      return 'Loading...';
    }
    return syncLoadingSubtitle;
  }, [isLoading, syncLoadingSubtitle]);

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
        state: {
          routes: [{ name: 'GroupMembers', params: { groupId: group.id } }],
          index: 0,
        },
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
    props.navigation.navigate('Contacts', undefined, { pop: true });
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
          subtitle={syncSubtitle}
          loadingSubtitle={loadingSubtitle}
          onNavigateToContacts={handleNavigateToContacts}
          onInviteFriends={handleInviteFriends}
        />
        <NavBarView
          navigateToContacts={() =>
            props.navigation.navigate('Contacts', undefined, { pop: true })
          }
          navigateToHome={() =>
            props.navigation.navigate('ChatList', undefined, { pop: true })
          }
          navigateToNotifications={() =>
            props.navigation.navigate('Activity', undefined, { pop: true })
          }
          navigateToApps={() =>
            props.navigation.navigate('AppLauncher', undefined, { pop: true })
          }
          currentRoute="Activity"
          currentUserId={currentUserId}
          showContactsTab={contactsTabEnabled}
        />
      </View>
    </View>
  );
}
