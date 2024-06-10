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
  // const { data: bucketedActivity } = store.useActivityEvents();
  const { data: bucketedActivity } = store.useYourActivity();

  const rolledBuckets = useMemo(() => {
    if (!bucketedActivity) return { all: [], threads: [], mentions: [] };
    return {
      all: toSourceActivity(bucketedActivity?.all ?? []),
      threads: toSourceActivity(bucketedActivity?.threads ?? []),
      mentions: toSourceActivity(bucketedActivity?.mentions ?? [], true),
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
          isFocused={isFocused}
          goToChannel={handleGoToChannel}
          goToThread={handleGoToThread}
        />
        <NavBarView navigation={props.navigation} />
      </View>
    </ContactsProvider>
  );
}

function toSourceActivity(
  events: db.ActivityEvent[],
  noRollup?: boolean
): db.SourceActivityEvents[] {
  const eventMap = new Map<string, db.SourceActivityEvents>();
  const eventsList: db.SourceActivityEvents[] = [];

  events.forEach((event) => {
    const key = noRollup ? event.id : getRollupKey(event);
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

  console.log(`bl: event list`, eventsList);

  // Convert the map values to an array
  return eventsList;
}

function getRollupKey(event: db.ActivityEvent): string {
  // const timeBlock = Math.floor(event.timestamp / (6 * 60 * 60 * 1000)); // bundle unreads into 6 hour blocks
  const timeBlock = '';

  if (event.type === 'post' && event.channelId) {
    return `${event.channelId}/${timeBlock}`;
  }

  if (event.type === 'reply' && event.channelId && event.parentId) {
    return `${event.channelId}/${event.parentId}/${timeBlock}`;
  }

  return `${event.id}}/${timeBlock}`;
}
