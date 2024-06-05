import { toPostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { FlatList } from 'react-native';

import { SizableText, View } from '../core';
import AuthorRow from './AuthorRow';
import ContentRenderer from './ContentRenderer';

export function ActivityScreenView({
  activityEvents,
}: {
  activityEvents: db.ActivityEvent[];
}) {
  const renderItem = useCallback(({ item }: { item: db.ActivityEvent }) => {
    return <ActivityEvent event={item} />;
  }, []);

  return (
    <View flex={1}>
      <FlatList
        data={activityEvents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}

function ActivityEvent({ event }: { event: db.ActivityEvent }) {
  if (event.type === 'post') {
    return <ActivityPost event={event} />;
  }

  return <SizableText> Event type {event.type} not supported</SizableText>;
}

function ActivityPost({ event }: { event: db.ActivityEvent }) {
  let postContent;
  if (event.content) {
    try {
      console.log(`trying to parsse ${event.id} content`, event.content);
      postContent = JSON.parse(event.content as any);
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
            type: 'chat' as 'chat' | 'gallery' | 'diary',
          }}
        />
      )}
      {/* <SizableText>{event.author}</SizableText> */}
    </View>
  );
}
