import _ from 'lodash';

import type * as db from '../db';
import type * as ub from '../urbit';

export const onEvents: ub.ExtendedEventType[] = [
  'dm-reply',
  'post-mention',
  'reply-mention',
  'dm-invite',
  'dm-post',
  'dm-post-mention',
  'dm-reply',
  'dm-reply-mention',
  'group-ask',
  'group-invite',
  'flag-post',
  'flag-reply',
];

export const notifyOffEvents: ub.ExtendedEventType[] = [
  'reply',
  'group-join',
  'group-kick',
  'group-role',
];

export function getLevelFromVolumeMap(
  vmap: ub.VolumeMap
): ub.NotificationLevel {
  const entries = Object.entries(vmap) as [ub.ExtendedEventType, ub.Volume][];
  if (_.every(entries, ([, v]) => v.notify)) {
    return 'loud';
  }

  if (_.every(entries, ([, v]) => !v.notify)) {
    return 'hush';
  }

  let isDefault = true;
  entries.forEach(([k, v]) => {
    if (onEvents.concat('post').includes(k) && !v.notify) {
      isDefault = false;
    }

    if (notifyOffEvents.includes(k) && v.notify) {
      isDefault = false;
    }
  });

  if (isDefault) {
    return 'medium';
  }

  return 'soft';
}

export function extractClientVolumes(
  volume: ub.VolumeSettings
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
      const level = getLevelFromVolumeMap(volumeMap);
      settings.push({ itemId: entityId, itemType: 'channel', level });
    }

    if (sourceType === 'thread' || sourceType === 'dm-thread') {
      const postId = rest[rest.length - 1];
      const level = getLevelFromVolumeMap(volumeMap);
      settings.push({ itemId: postId, itemType: 'thread', level });
    }
  });

  return settings;
}

export function isMuted(
  volume: ub.NotificationLevel | null | undefined,
  type: 'group' | 'channel' | 'thread'
) {
  if (!volume) return false;

  if (type === 'channel') {
    return volume === 'hush';
  }

  if (volume === 'soft' || volume === 'hush') {
    return true;
  }

  return false;
}

// Aggregates events from the same source into a shape that we can use
// to display
export interface SourceActivityEvents {
  sourceId: string;
  type: ub.ExtendedEventType;
  newest: db.ActivityEvent;
  all: db.ActivityEvent[];
}

export function toSourceActivityEvents(
  events: db.ActivityEvent[]
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
  listA: db.ActivityEvent[],
  listB: db.ActivityEvent[]
): db.ActivityEvent[] {
  const results: db.ActivityEvent[] = [];

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

  return results;
}

export function filterDupeEvents(
  events: db.ActivityEvent[]
): db.ActivityEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }
    seen.add(event.id);
    return true;
  });
}
