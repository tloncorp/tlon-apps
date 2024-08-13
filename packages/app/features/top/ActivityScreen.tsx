import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  ActivityScreenView,
  AppDataContextProvider,
  NavBarView,
  View,
} from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

// import ErrorBoundary from '../../ErrorBoundary';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useIsFocused } from '../../hooks/useIsFocused';

export function ActivityScreen({
  navigateToChannel,
  navigateToThread,
  navigateToGroup,
  navigateToChatList,
  navigateToActivity,
  navigateToProfile,
}: {
  navigateToChannel: (channel: db.Channel, selectedPostId?: string) => void;
  navigateToThread: (post: db.Post) => void;
  navigateToGroup: (group: db.Group) => void;
  navigateToChatList: () => void;
  navigateToActivity: () => void;
  navigateToProfile: () => void;
}) {
  const { data: contacts } = store.useContacts();
  const isFocused = useIsFocused();
  const currentUserId = useCurrentUserId();

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
      navigateToThread(post);
    },
    [navigateToThread]
  );

  const handleGoToGroup = useCallback(
    (group: db.Group) => {
      store.markGroupRead(group);
      navigateToGroup(group);
    },
    [navigateToGroup]
  );

  return (
    <AppDataContextProvider contacts={contacts ?? []}>
      <View backgroundColor="$background" flex={1}>
        <ActivityScreenView
          bucketFetchers={bucketedActivity}
          isFocused={isFocused}
          goToChannel={handleGoToChannel}
          goToThread={handleGoToThread}
          goToGroup={handleGoToGroup}
          refresh={handleRefreshActivity}
        />
        <NavBarView
          navigateToHome={() => {
            navigateToChatList();
          }}
          navigateToNotifications={() => {
            navigateToActivity();
          }}
          navigateToProfile={() => {
            navigateToProfile();
          }}
          currentRoute="Activity"
          currentUserId={currentUserId}
        />
      </View>
    </AppDataContextProvider>
  );
}
