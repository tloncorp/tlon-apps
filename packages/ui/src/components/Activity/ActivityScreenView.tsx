import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleProp, ViewStyle } from 'react-native';
import { View, useStyle } from 'tamagui';

import { LoadingSpinner } from '../LoadingSpinner';
import { ActivityHeader } from './ActivityHeader';
import { ActivityListItem } from './ActivityListItem';

export function ActivityScreenView({
  isFocused,
  goToChannel,
  goToThread,
  goToGroup,
  bucketFetchers,
  refresh,
}: {
  isFocused: boolean;
  goToChannel: (channel: db.Channel, selectedPostId?: string) => void;
  goToThread: (post: db.Post) => void;
  goToGroup: (group: db.Group) => void;
  bucketFetchers: store.BucketFetchers;
  refresh: () => Promise<void>;
}) {
  const { data: activitySeenMarker } = store.useActivitySeenMarker();
  const [activeTab, setActiveTab] = useState<db.ActivityBucket>('all');
  const currentFetcher = bucketFetchers[activeTab];

  // keep track of the newest timestamp. If focused and newest timestamp is
  // greater than the seen marker, advance the seen marker
  const newestTimestamp = useMemo(() => {
    return (
      bucketFetchers.all.activity[0]?.newest.timestamp ?? activitySeenMarker
    );
  }, [activitySeenMarker, bucketFetchers.all.activity]);

  const moveSeenMarker = useCallback(() => {
    setTimeout(() => {
      store.advanceActivitySeenMarker(newestTimestamp);
    }, 1000);
  }, [newestTimestamp]);

  useEffect(() => {
    if (
      isFocused &&
      activitySeenMarker !== null &&
      activitySeenMarker !== undefined &&
      newestTimestamp > activitySeenMarker
    ) {
      moveSeenMarker();
    }
  }, [moveSeenMarker, newestTimestamp, isFocused, activitySeenMarker]);

  const handlePressEvent = useCallback(
    async (event: db.ActivityEvent) => {
      switch (event.type) {
        case 'flag-post':
        case 'post':
          if (event.channel) {
            goToChannel(event.channel);
          } else if (event.channelId) {
            const channel = await db.getChannel({ id: event.channelId });
            if (channel) {
              goToChannel(channel, event.postId!);
            }
          } else {
            console.warn('No channel found for post', event);
          }
          break;
        case 'flag-reply':
        case 'reply':
          if (event.parent) {
            goToThread(event.parent);
          } else if (event.parentId) {
            const parentPost = db.assembleParentPostFromActivityEvent(event);
            goToThread(parentPost);
          } else {
            console.warn('No parent found for reply', event);
          }
          break;
        case 'group-ask':
          if (event.group) {
            goToGroup(event.group);
          } else {
            console.warn('No group found for group-ask', event);
          }
          break;
        default:
          break;
      }
    },
    [goToChannel, goToThread, goToGroup]
  );

  const events = useMemo(
    () => currentFetcher.activity,
    [currentFetcher.activity]
  );

  const handleTabPress = useCallback(
    (tab: db.ActivityBucket) => {
      if (tab !== activeTab) {
        setActiveTab(tab);
      }
    },
    [activeTab]
  );

  const handleEndReached = useCallback(() => {
    if (currentFetcher.canFetchMoreActivity) {
      currentFetcher.fetchMoreActivity();
    }
  }, [currentFetcher]);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <ActivityScreenContent
      activeTab={activeTab}
      onPressTab={handleTabPress}
      onPressEvent={handlePressEvent}
      onEndReached={handleEndReached}
      events={events}
      isFetching={currentFetcher.isFetching}
      isRefreshing={refreshing}
      onRefreshTriggered={onRefresh}
    />
  );
}

export function ActivityScreenContent({
  activeTab,
  onPressTab,
  onPressEvent,
  onEndReached,
  events,
  isFetching,
  isRefreshing,
  onRefreshTriggered,
}: {
  activeTab: db.ActivityBucket;
  onPressTab: (tab: db.ActivityBucket) => void;
  onPressEvent: (event: db.ActivityEvent) => void;
  onEndReached: () => void;
  events: logic.SourceActivityEvents[];
  isFetching: boolean;
  isRefreshing: boolean;
  onRefreshTriggered: () => void;
}) {
  const keyExtractor = useCallback((item: logic.SourceActivityEvents) => {
    return `${item.newest.id}/${item.sourceId}/${item.newest.bucketId}/${item.all.length}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: logic.SourceActivityEvents }) => {
      return <ActivityListItem sourceActivity={item} onPress={onPressEvent} />;
    },
    [onPressEvent]
  );

  const containerStyle = useStyle({
    padding: '$l',
    gap: '$l',
  }) as StyleProp<ViewStyle>;

  return (
    <View flex={1}>
      <ActivityHeader activeTab={activeTab} onTabPress={onPressTab} />
      {events.length > 0 && (
        <FlatList
          data={events}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={containerStyle}
          onEndReached={onEndReached}
          ListFooterComponent={isFetching ? <LoadingSpinner /> : null}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefreshTriggered}
            />
          }
        />
      )}
    </View>
  );
}
