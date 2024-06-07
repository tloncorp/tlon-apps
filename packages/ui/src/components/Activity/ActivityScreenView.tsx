import { toPostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as ub from '@tloncorp/shared/dist/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import React from 'react';
import { FlatList } from 'react-native';

import { SizableText, View } from '../../core';
import AuthorRow from '../AuthorRow';
import ContentRenderer from '../ContentRenderer';
import { ActivityHeader, ActivityTab } from './ActivityHeader';
import { ChannelActivitySummary } from './ChannelActivitySummary';

export function ActivityScreenView({
  bucketedActivity,
  isFocused,
  goToChannel,
  goToThread,
}: {
  bucketedActivity: db.BucketedSourceActivity;
  isFocused: boolean;
  goToChannel: (channel: db.Channel) => void;
  goToThread: (post: db.PseudoPost) => void;
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

  return (
    <View flex={1}>
      <ActivityHeader activeTab={activeTab} onTabPress={handleTabPress} />
      <FlatList
        data={events}
        renderItem={renderItem}
        keyExtractor={(item) => item.newest.id}
        contentContainerStyle={{ paddingTop: 16 }}
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
        />
      </View>
    );
  }

  return <SizableText> Event type {event.type} not supported</SizableText>;
}
const SourceActivityDisplay = React.memo(ActivityEventRaw);

function ActivityPost({ event }: { event: db.ActivityEvent }) {
  let postContent;
  if (event.content) {
    try {
      // console.log(`trying to parsse ${event.id} content`, event.content);
      const parsed = toPostContent(event.content as ub.Verse[]);
      postContent = parsed[0];
    } catch (e) {
      console.error('Failed to parse event content', e);
      postContent = null;
    }
  } else {
    postContent = null;
  }

  return (
    <View padding="$l" borderRadius="$l">
      {event.authorId && (
        <AuthorRow
          author={event.author}
          authorId={event.authorId}
          sent={event.timestamp}
          type="chat"
        />
      )}
      {event.content && (
        <ContentRenderer
          post={{
            id: event.id,
            content: postContent ?? [],
            type: 'diary' as 'chat' | 'gallery' | 'diary',
          }}
        />
      )}
      {/* <SizableText>{event.author}</SizableText> */}
    </View>
  );
}

function ActivityReply({ event }: { event: db.ActivityEvent }) {
  let postContent;
  if (event.content) {
    try {
      // console.log(`trying to parsse ${event.id} content`, event.content);
      const parsed = toPostContent(event.content as ub.Verse[]);
      postContent = parsed[0];
    } catch (e) {
      console.error('Failed to parse event content', e);
      postContent = null;
    }
  } else {
    postContent = null;
  }

  return (
    <View padding="$l" borderRadius="$l">
      {event.authorId && (
        <AuthorRow
          author={event.author}
          authorId={event.authorId}
          sent={event.timestamp}
          type="chat"
        />
      )}
      {event.content && (
        <ContentRenderer
          post={{
            id: event.id,
            content: postContent ?? [],
            type: 'diary' as 'chat' | 'gallery' | 'diary',
          }}
        />
      )}
      {/* <SizableText>{event.author}</SizableText> */}
    </View>
  );
}
