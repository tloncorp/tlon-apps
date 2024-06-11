import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as ub from '@tloncorp/shared/dist/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import React from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { SizableText, View } from '../../core';
import { LoadingSpinner } from '../LoadingSpinner';
import { ActivityHeader, ActivityTab } from './ActivityHeader';
import { ChannelActivitySummary } from './ChannelActivitySummary';

export function ActivityScreenView({
  bucketedActivity,
  isFocused,
  goToChannel,
  goToThread,
  activityFetcher,
}: {
  bucketedActivity: db.BucketedSourceActivity;
  isFocused: boolean;
  goToChannel: (channel: db.Channel) => void;
  goToThread: (post: db.PseudoPost) => void;
  activityFetcher: store.ActivityFetcher;
}) {
  const { data: activitySeenMarker } = store.useActivitySeenMarker();
  const [activeTab, setActiveTab] = useState<ActivityTab>('all');

  // keep track of the newest timestamp. If focused and newest timestamp is
  // greater than the seen marker, advance the seen marker
  const newestTimestamp = useMemo(() => {
    return bucketedActivity.all[0]?.newest.timestamp ?? activitySeenMarker;
  }, [activitySeenMarker, bucketedActivity.all]);
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
            console.log(`bl: go to`, {
              id: event.parentId,
              channelId: event.channelId,
              authorId: event.authorId,
            });
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
    ({ item }: { item: db.SourceActivityEvents }) => {
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
    () => bucketedActivity[activeTab],
    [activeTab, bucketedActivity]
  );

  const handleTabPress = useCallback(
    (tab: ActivityTab) => {
      if (tab !== activeTab) {
        setActiveTab(tab);
      }
    },
    [activeTab]
  );

  const handleEndReached = useCallback(() => {
    if (activityFetcher.canFetchMoreActivity) {
      activityFetcher.fetchMoreActivity();
    }
  }, [activityFetcher]);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  return (
    <View flex={1}>
      <ActivityHeader activeTab={activeTab} onTabPress={handleTabPress} />
      <FlatList
        data={events}
        renderItem={renderItem}
        keyExtractor={(item) => item.newest.id}
        contentContainerStyle={{ paddingTop: 16 }}
        onEndReached={handleEndReached}
        ListFooterComponent={
          activityFetcher.isFetching ? <LoadingSpinner /> : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            size={5}
          />
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
  sourceActivity: db.SourceActivityEvents;
  onPress: (event: db.ActivityEvent) => void;
}) {
  const event = sourceActivity.newest;
  if (event.type === 'post') {
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

  if (event.type === 'reply') {
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
