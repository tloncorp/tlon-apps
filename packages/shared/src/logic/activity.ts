import * as db from '../db';
import { ActivityEvent } from '../db';
import {
  ExtendedEventType,
  NotificationLevel,
  VolumeSettings,
  getLevelFromVolumeMap,
} from '../urbit';

export function extractClientVolumes(
  volume: VolumeSettings
): db.VolumeSettings[] {
  const settings: db.VolumeSettings[] = [];

  Object.entries(volume).forEach(([sourceId, volumeMap]) => {
    if (!volumeMap) return;
    const isBase = sourceId === 'base';
    const [sourceType, ...rest] = sourceId.split('/');
    const entityId = rest.join('/');

    if (isBase) {
      const level = getLevelFromVolumeMap(volumeMap);
      settings.push({ itemId: 'base', itemType: 'base', level });
    }

    if (sourceType === 'group') {
      const level = getLevelFromVolumeMap(volumeMap);
      settings.push({ itemId: entityId, itemType: 'group', level });
    }

    if (sourceType === 'channel' || sourceType === 'dm') {
      // TODO: recursive bologna
      const level = getLevelFromVolumeMap(volumeMap);
      settings.push({ itemId: entityId, itemType: 'channel', level });
    }

    if (sourceType === 'thread' || sourceType === 'dm-thread') {
      const postId = rest[rest.length - 1];
      // TODO: recursive bologna
      const level = getLevelFromVolumeMap(volumeMap);
      settings.push({ itemId: postId, itemType: 'thread', level });
    }
  });

  return settings;
}

export function isMuted(volume: NotificationLevel | null | undefined) {
  if (!volume) return false;

  if (volume === 'soft' || volume === 'hush') {
    return true;
  }

  return false;
}

// Aggregates events from the same source into a shape that we can use
// to display
export interface SourceActivityEvents {
  sourceId: string;
  type: ExtendedEventType;
  newest: ActivityEvent;
  all: ActivityEvent[];
}

export function toSourceActivityEvents(
  events: ActivityEvent[]
): SourceActivityEvents[] {
  const eventMap = new Map<string, SourceActivityEvents>();
  const eventsList: SourceActivityEvents[] = [];

  events.forEach((event) => {
    const key = event.sourceId;
    // If we already have an entry for this channel/thread
    if (eventMap.has(key)) {
      const existing = eventMap.get(key);
      if (existing) {
        const existingNewestEvent = existing.newest;
        // If a mention is already included as the latest event of its source,
        // we don't need to add it again
        if (
          event.isMention &&
          existingNewestEvent.id !== event.id &&
          existingNewestEvent.postId !== event.postId
        ) {
          // If it's not included as the latest of its source, add it as it's own
          // "source" if it hasn't already been added
          const individualMentionKey = `${key}/${event.postId}`;
          if (!eventMap.has(individualMentionKey)) {
            const mentionSource = {
              newest: event,
              all: [event],
              type: event.type,
              sourceId: `${event.sourceId}/${event.postId}`,
            };
            eventMap.set(individualMentionKey, mentionSource);
            eventsList.push(mentionSource);
          }
        } else {
          // Otherwise, add the current event to the all array
          existing.all.push(event);
        }
      }
    } else {
      // Create a new entry in the map
      const newRollup = {
        newest: event,
        all: [event],
        type: event.type,
        sourceId: event.sourceId,
      };
      eventMap.set(key, newRollup);
      eventsList.push(newRollup);
    }
  });

  return eventsList;
}

export function interleaveActivityEvents(
  listA: ActivityEvent[],
  listB: ActivityEvent[]
): ActivityEvent[] {
  const results: ActivityEvent[] = [];

  let aIndex = 0;
  let bIndex = 0;

  while (aIndex < listA.length && bIndex < listB.length) {
    if (listA[aIndex].timestamp >= listB[bIndex].timestamp) {
      results.push(listA[aIndex]);
      aIndex++;
    } else {
      results.push(listB[bIndex]);
      bIndex++;
    }
  }

  // If there are remaining elements in listA, add them to the results
  while (aIndex < listA.length) {
    results.push(listA[aIndex]);
    aIndex++;
  }

  // If there are remaining elements in listB, add them to the results
  while (bIndex < listB.length) {
    results.push(listB[bIndex]);
    bIndex++;
  }

  return filterDupeEvents(results);
}

export function filterDupeEvents(events: ActivityEvent[]): ActivityEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (!event.postId) return false; // shouldn't happen
    if (seen.has(event.postId)) {
      return false;
    }
    seen.add(event.id);
    return true;
  });
}
