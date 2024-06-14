import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import React from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { SizableText, View } from '../../core';
import { LoadingSpinner } from '../LoadingSpinner';
import { ActivityHeader } from './ActivityHeader';
import { ChannelActivitySummary } from './ChannelActivitySummary';

export function ActivityScreenView({
  isFocused,
  goToChannel,
  goToThread,
  bucketFetchers,
  refresh,
}: {
  isFocused: boolean;
  goToChannel: (channel: db.Channel) => void;
  goToThread: (post: db.PseudoPost) => void;
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
    (event: db.ActivityEvent) => {
      switch (event.type) {
        case 'post':
          if (event.channel) {
            goToChannel(event.channel);
          }
          break;
        case 'reply':
          if (event.parentId && event.channelId && event.authorId) {
            goToThread({
              id: event.parentId,
              channelId: event.channelId,
              authorId: event.authorId,
            });
          }
          break;
        default:
          break;
      }
    },
    [goToChannel, goToThread]
  );

  const renderItem = useCallback(
    ({ item }: { item: logic.SourceActivityEvents }) => {
      return (
        <View marginHorizontal="$l">
          <SourceActivityDisplay
            sourceActivity={item}
            onPress={handlePressEvent}
            seenMarker={activitySeenMarker ?? Date.now()}
          />
        </View>
      );
    },
    [activitySeenMarker, handlePressEvent]
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
    <View flex={1}>
      <ActivityHeader activeTab={activeTab} onTabPress={handleTabPress} />
      <FlatList
        data={events}
        renderItem={renderItem}
        keyExtractor={(item) =>
          item.newest.id ?? item.newest.timestamp.toString()
        }
        contentContainerStyle={{ paddingTop: 16 }}
        onEndReached={handleEndReached}
        ListFooterComponent={
          currentFetcher.isFetching ? <LoadingSpinner /> : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

function ActivityEventRaw({
  sourceActivity,
  seenMarker,
  onPress,
}: {
  seenMarker: number;
  sourceActivity: logic.SourceActivityEvents;
  onPress: (event: db.ActivityEvent) => void;
}) {
  const event = sourceActivity.newest;
  if (event.type === 'post' || event.type === 'reply') {
    return (
      <View onPress={() => onPress(event)}>
        <ChannelActivitySummary
          summary={sourceActivity}
          seenMarker={seenMarker}
          pressHandler={() => onPress(event)}
        />
      </View>
    );
  }

  return <SizableText> Event type {event.type} not supported</SizableText>;
}
const SourceActivityDisplay = React.memo(ActivityEventRaw);
