import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { ActivityScreenView, ContactsProvider, View } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import NavBarView from '../navigation/NavBarView';
import { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Activity'>;

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
    (channel: db.Channel) => {
      // @ts-expect-error it works
      props.navigation.navigate('Channel', { channel });
    },
    [props.navigation]
  );

  // TODO: if diary or gallery, figure out a way to pop open the comment
  // sheet
  const handleGoToThread = useCallback(
    (post: db.PseudoPost) => {
      // @ts-expect-error it works
      props.navigation.navigate('Post', { post });
    },
    [props.navigation]
  );

  return (
    <ContactsProvider contacts={contacts ?? []}>
      <View backgroundColor="$background" flex={1}>
        <ActivityScreenView
          bucketFetchers={bucketedActivity}
          isFocused={isFocused}
          goToChannel={handleGoToChannel}
          goToThread={handleGoToThread}
          refresh={handleRefreshActivity}
        />
        <NavBarView navigation={props.navigation} />
      </View>
    </ContactsProvider>
  );
}
