import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { ActivityScreenView, AppDataContextProvider, View } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import ErrorBoundary from '../ErrorBoundary';
import NavBarView from '../navigation/NavBarView';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

export function ActivityScreen(props: Props) {
  const { data: contacts } = store.useContacts();
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
      props.navigation.navigate('Channel', { channel, selectedPostId });
    },
    [props.navigation]
  );

  // TODO: if diary or gallery, figure out a way to pop open the comment
  // sheet
  const handleGoToThread = useCallback(
    (post: db.Post) => {
      // TODO: we have no way to route to specific thread message rn
      props.navigation.navigate('Post', { post });
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

  return (
    <AppDataContextProvider contacts={contacts ?? []}>
      <View backgroundColor="$background" flex={1}>
        <ErrorBoundary message="Try navigating away and coming back">
          <ActivityScreenView
            bucketFetchers={bucketedActivity}
            isFocused={isFocused}
            goToChannel={handleGoToChannel}
            goToThread={handleGoToThread}
            goToGroup={handleGoToGroup}
            refresh={handleRefreshActivity}
          />
        </ErrorBoundary>
        <NavBarView navigation={props.navigation} />
      </View>
    </AppDataContextProvider>
  );
}
