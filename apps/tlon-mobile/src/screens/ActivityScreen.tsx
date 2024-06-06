import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { ActivityScreenView, ContactsProvider, View } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import NavBarView from '../navigation/NavBarView';
import { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Activity'>;

export function ActivityScreen(props: Props) {
  const { data: contacts } = store.useContacts();
  const { data: bucketedActivity } = store.useActivityEvents();

  const rolledBuckets = useMemo(() => {
    if (!bucketedActivity) return { all: [], threads: [], mentions: [] };
    return {
      all: rollupActivityEvents(bucketedActivity?.all ?? []),
      threads: rollupActivityEvents(bucketedActivity?.threads ?? []),
      mentions: rollupActivityEvents(bucketedActivity?.mentions ?? []),
    };
  }, [bucketedActivity]);

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
          bucketedActivity={rolledBuckets}
          goToChannel={handleGoToChannel}
          goToThread={handleGoToThread}
        />
        <NavBarView navigation={props.navigation} />
      </View>
    </ContactsProvider>
  );
}

function rollupActivityEvents(
  events: db.ActivityEvent[]
): db.SourceActivityEvents[] {
  const eventMap = new Map<string, db.SourceActivityEvents>();
  const eventsList: db.SourceActivityEvents[] = [];

  events.forEach((event) => {
    const key = getEventKey(event);
    if (eventMap.has(key)) {
      const existing = eventMap.get(key);
      if (existing) {
        // Add the current event to the all array
        existing.all.push(event);
      }
    } else {
      // Create a new entry in the map
      const newRollup = { newest: event, all: [event], type: event.type };
      eventMap.set(key, newRollup);
      eventsList.push(newRollup);
    }
  });

  // Convert the map values to an array
  return eventsList;
}

function getEventKey(event: db.ActivityEvent): string {
  const timeBlock = Math.floor(event.timestamp / (6 * 60 * 60 * 1000)); // bundle unreads into 4 hour blocks

  if (event.type === 'post' && event.channelId) {
    return `${event.channelId}/${timeBlock}`;
  }

  if (event.type === 'reply' && event.channelId && event.parentId) {
    return `${event.channelId}/${event.parentId}/${timeBlock}`;
  }

  return `${event.id}}/${timeBlock}`;
}
