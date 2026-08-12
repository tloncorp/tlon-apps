import { useIsFocused } from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { FlatList } from 'react-native';
import { useTheme } from 'tamagui';

import { useGroupActions } from '../../hooks/useGroupActions';
import { useScrollToTabTop } from '../../hooks/useScrollToTabTop';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { getTopLevelTabRoute } from '../../navigation/topLevelTabs';
import { useRootNavigation } from '../../navigation/utils';
import { ActivityScreenView, View } from '../../ui';

export function ActivityScreen() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const scrollRef = useScrollToTabTop<FlatList>();
  const { performGroupAction } = useGroupActions();
  const { navigation, navigateToChannel, navigateToPost } = useRootNavigation();
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
      navigation.navigate('GroupSettings', {
        state: {
          routes: [{ name: 'GroupMembers', params: { groupId: group.id } }],
          index: 0,
        },
      });
    },
    [navigation]
  );

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation]
  );

  const handleNavigateToContacts = useCallback(() => {
    const route = getTopLevelTabRoute('Contacts');
    navigation.navigate(route.name, route.params, { pop: true });
  }, [navigation]);

  const handleInviteFriends = useCallback(() => {
    navigation.navigate('InviteSystemContacts');
  }, [navigation]);

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
          scrollRef={scrollRef}
        />
      </View>
    </View>
  );
}
