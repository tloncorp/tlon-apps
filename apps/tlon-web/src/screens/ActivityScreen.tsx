import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { ActivityScreenView, AppDataContextProvider, View } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';

import useIsFocused from '@/hooks/useIsFocused';

// import ErrorBoundary from '../ErrorBoundary';
import NavBarView from '../navigation/NavBarView';

export function ActivityScreen() {
  const { data: contacts } = store.useContacts();
  const navigate = useNavigate();
  const isFocused = useIsFocused();

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
      navigate('/group/' + channel.groupId + '/channel/' + channel.id);
      if (selectedPostId) {
        navigate(
          '/group/' +
            channel.groupId +
            '/channel/' +
            channel.id +
            '/' +
            selectedPostId
        );
      }
    },
    [navigate]
  );

  // TODO: if diary or gallery, figure out a way to pop open the comment
  // sheet
  const handleGoToThread = useCallback(
    (post: db.Post) => {
      // TODO: we have no way to route to specific thread message rn
      navigate(
        '/group/' +
          post.groupId +
          '/channel/' +
          post.channelId +
          '/post/' +
          post.authorId +
          '/' +
          post.id
      );
    },
    [navigate]
  );

  return (
    <AppDataContextProvider contacts={contacts ?? []}>
      <View backgroundColor="$background" flex={1}>
        <ActivityScreenView
          bucketFetchers={bucketedActivity}
          isFocused={isFocused}
          goToChannel={handleGoToChannel}
          goToThread={handleGoToThread}
          refresh={handleRefreshActivity}
        />
        <NavBarView />
      </View>
    </AppDataContextProvider>
  );
}
