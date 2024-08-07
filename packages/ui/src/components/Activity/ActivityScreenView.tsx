import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { SizableText, View } from 'tamagui';

import { LoadingSpinner } from '../LoadingSpinner';
import { ActivityHeader } from './ActivityHeader';
import { ChannelActivitySummary } from './ChannelActivitySummary';
import { GroupActivitySummary } from './GroupActivitySummary';

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

  const keyExtractor = useCallback((item: logic.SourceActivityEvents) => {
    return `${item.sourceId}/${item.newest.bucketId}/${item.all.length}`;
  }, []);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <View flex={1}>
      <ActivityHeader activeTab={activeTab} onTabPress={handleTabPress} />
      {events.length > 0 && (
        <FlatList
          data={events}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingTop: 16 }}
          onEndReached={handleEndReached}
          ListFooterComponent={
            currentFetcher.isFetching ? <LoadingSpinner /> : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  const handlePress = useCallback(() => onPress(event), [event, onPress]);

  if (db.isGroupEvent(event)) {
    return (
      <View onPress={handlePress}>
        <GroupActivitySummary
          summary={sourceActivity}
          seenMarker={seenMarker}
          pressHandler={handlePress}
        />
      </View>
    );
  }

  if (
    event.type === 'post' ||
    event.type === 'reply' ||
    event.type === 'flag-post' ||
    event.type === 'flag-reply'
  ) {
    return (
      <View onPress={handlePress}>
        <ChannelActivitySummary
          summary={sourceActivity}
          seenMarker={seenMarker}
          pressHandler={handlePress}
        />
      </View>
    );
  }

  return <SizableText> Event type {event.type} not supported</SizableText>;
}
const SourceActivityDisplay = React.memo(ActivityEventRaw);
