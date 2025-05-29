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

/**
 * Determines if a channel should be considered muted,
 * checking both channel-level and group-level muting settings.
 *
 * @param volume - The volume level of the channel or group.
 * @param type - The type of the channel or group.
 * @returns True if the channel or group is muted, false otherwise.
 */

export function isMuted(
  volume: NotificationLevel | null | undefined,
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

/**
 * Returns the appropriate preview text for a post based on its status.
 *
 * @param post - The post to get the preview text for.
 * @returns The preview text for the post.
 */
export function getPostPreviewText(post: {
  isDeleted?: boolean | null;
  hidden?: boolean | null;
  textContent?: string | null;
}): string {
  if (post.isDeleted) return '(Deleted post)';
  if (post.hidden) return '(Hidden post)';
  return post.textContent ?? '';
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
    const key =
      event.type === 'contact'
        ? `/contact/${event.contactUserId}/${event.id}` // contact events should never be rolled up
        : event.sourceId;
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

  return results;
}

export function filterDupeEvents(events: ActivityEvent[]): ActivityEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }
    seen.add(event.id);
    return true;
  });
}
