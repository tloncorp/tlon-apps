import * as db from '../db';
import { ActivityEvent } from '../db';
import {
  ExtendedEventType,
  VolumeMap,
  VolumeSettings,
  getLevelFromVolumeMap,
} from '../urbit';

export function extractClientVolumes(
  volume: VolumeSettings
): db.VolumeSettings[] {
  const settings: db.VolumeSettings[] = [];

  Object.entries(volume).forEach(([sourceId, volumeMap]) => {
    if (!volumeMap) return;
    const [sourceType, ...rest] = sourceId.split('/');
    const entityId = rest.join('/');

    if (sourceType === 'group') {
      const clientVolume = getClientVolume(volumeMap);
      settings.push({ itemId: entityId, itemType: 'group', ...clientVolume });
    }

    if (sourceType === 'channel' || sourceType === 'dm') {
      const clientVolume = getClientVolume(volumeMap, sourceType === 'channel');
      settings.push({ itemId: entityId, itemType: 'channel', ...clientVolume });
    }

    if (sourceType === 'thread' || sourceType === 'dm-thread') {
      const postId = rest[rest.length - 1];
      const clientVolume = getClientVolume(volumeMap);
      settings.push({ itemId: postId, itemType: 'thread', ...clientVolume });
    }
  });

  return settings;
}

export function extractClientVolume(
  volume: VolumeMap | null,
  isGroupChannel?: boolean
): {
  isMuted: boolean;
  isNoisy: boolean;
} {
  if (!volume) return { isMuted: false, isNoisy: false };

  const clientVolume = getClientVolume(volume, isGroupChannel);
  return clientVolume;
}

function getClientVolume(volumeMap: VolumeMap, isGroupChannel?: boolean) {
  const level = getLevelFromVolumeMap(volumeMap);
  return {
    // NOTE: channels are muted (in mobile app terms) by default — only mentions & replies. But we don't
    // want them to all show up as muted visually. Do we want a way to support "muting" a channel in the App
    // to hide it's count from the UI?
    isMuted: isGroupChannel
      ? level === 'hush'
      : level === 'soft' || level === 'hush',
    isNoisy: level === 'loud' || level === 'medium',
  };
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
