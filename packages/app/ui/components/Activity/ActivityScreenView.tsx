import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { LoadingSpinner } from '@tloncorp/ui';
import { setBadgeCountAsync } from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleProp, ViewStyle } from 'react-native';
import { View, useStyle } from 'tamagui';

import { useConnectionStatus } from '../../../features/top/useConnectionStatus';
import { NavigationProvider, useStore } from '../../contexts';
import { GroupPreviewAction, GroupPreviewSheet } from '../GroupPreviewSheet';
import { ActivityHeader } from './ActivityHeader';
import { ActivityListItem } from './ActivityListItem';

const logger = createDevLogger('ActivityScreenView', false);

export function ActivityScreenView({
  isFocused,
  goToChannel,
  goToThread,
  goToGroup,
  goToUserProfile,
  onGroupAction,
  bucketFetchers,
  refresh,
  subtitle,
}: {
  isFocused: boolean;
  goToChannel: (channel: db.Channel, selectedPostId?: string) => void;
  goToThread: (post: db.Post) => void;
  goToGroup: (group: db.Group) => void;
  goToUserProfile: (userId: string) => void;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  bucketFetchers: store.BucketFetchers;
  refresh: () => Promise<void>;
  subtitle?: string;
}) {
  const store = useStore();
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
  }, [newestTimestamp, store]);

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
            logger.trackEvent(AnalyticsEvent.ActionSelectActivityEvent, {
              ...logic.getModelAnalytics({ channel: event.channel }),
              type: 'channelPost',
            });
            if (event.postId) {
              goToChannel(event.channel, event.postId);
            } else {
              goToChannel(event.channel);
            }
          } else if (event.channelId) {
            const channel = await db.getChannel({ id: event.channelId });
            if (channel) {
              logger.trackEvent(AnalyticsEvent.ActionSelectActivityEvent, {
                ...logic.getModelAnalytics({ channel }),
                type: 'channelPost',
              });
              goToChannel(channel, event.postId!);
            }
          } else {
            console.warn('No channel found for post', event);
          }
          break;
        case 'flag-reply':
        case 'reply':
          logger.trackEvent(AnalyticsEvent.ActionSelectActivityEvent, {
            type: 'channelThread',
          });
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
            logger.trackEvent(AnalyticsEvent.ActionSelectActivityEvent, {
              ...logic.getModelAnalytics({ group: event.group }),
              type: 'groupInvite',
            });
            goToGroup(event.group);
          } else {
            console.warn('No group found for group-ask', event);
          }
          break;
        case 'contact':
          if (event.contactUserId) {
            logger.trackEvent(AnalyticsEvent.ActionSelectActivityEvent, {
              type: 'profileUpdate',
            });
            goToUserProfile(event.contactUserId);
          }
          break;
        default:
          break;
      }
    },
    [goToChannel, goToThread, goToGroup, goToUserProfile]
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
      seenMarker={activitySeenMarker ?? Date.now()}
      onGroupAction={onGroupAction}
      subtitle={subtitle}
    />
  );
}

export function ActivityScreenContent({
  activeTab,
  events,
  isFetching,
  isRefreshing,
  onPressTab,
  onPressEvent,
  onEndReached,
  onRefreshTriggered,
  onGroupAction,
  seenMarker,
  subtitle,
}: {
  activeTab: db.ActivityBucket;
  onPressTab: (tab: db.ActivityBucket) => void;
  onPressEvent: (event: db.ActivityEvent) => void;
  onEndReached: () => void;
  events: logic.SourceActivityEvents[];
  isFetching: boolean;
  isRefreshing: boolean;
  onRefreshTriggered: () => void;
  seenMarker: number;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  subtitle?: string;
}) {
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const hostConnectionStatus = useConnectionStatus(
    selectedGroup?.hostUserId ?? ''
  );
  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      setSelectedGroup(null);
      setTimeout(() => {
        onGroupAction(action, group);
      }, 100);
    },
    [onGroupAction]
  );

  const markAllRead = useCallback(async () => {
    console.log('Marking all activity as read');
    await setBadgeCountAsync(0);
    await store.markAllRead();
  }, []);

  const keyExtractor = useCallback((item: logic.SourceActivityEvents) => {
    return `${item.newest.id}/${item.sourceId}/${item.newest.bucketId}/${item.all.length}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: logic.SourceActivityEvents }) => {
      return (
        <ActivityListItem
          sourceActivity={item}
          onPress={onPressEvent}
          seenMarker={seenMarker}
        />
      );
    },
    [onPressEvent, seenMarker]
  );

  const containerStyle = useStyle({
    padding: '$l',
    gap: '$l',
  }) as StyleProp<ViewStyle>;

  return (
    <NavigationProvider onPressGroupRef={setSelectedGroup}>
      <View flex={1}>
        <ActivityHeader
          activeTab={activeTab}
          onTabPress={onPressTab}
          markAllRead={markAllRead}
        />
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
        <GroupPreviewSheet
          open={!!selectedGroup}
          onOpenChange={() => setSelectedGroup(null)}
          group={selectedGroup ?? undefined}
          hostStatus={hostConnectionStatus}
          onActionComplete={handleGroupAction}
        />
      </View>
    </NavigationProvider>
  );
}
