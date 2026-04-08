import type { PresenceEvent, PresenceStatus } from '@tloncorp/api';
import type { PresenceKey } from '@tloncorp/api/urbit';
import { useMemo, useSyncExternalStore } from 'react';

import { createDevLogger } from '../debug';

type PresenceStatusesByKey = Record<string, PresenceStatus>;
export type PresenceStatusesByContext = Record<string, PresenceStatusesByKey>;

const logger = createDevLogger('presenceStore', false);
// Missing conversations all reuse this frozen bucket so selectors can return a
// stable empty object until presence actually appears for that context.
const EMPTY_CONTEXT_STATUSES = Object.freeze({}) as PresenceStatusesByKey;
// Keep one external snapshot of normalized presence grouped by app context id,
// then by a stable per-status key. That makes conversation reads cheap and keeps
// incremental updates scoped to a single bucket.
let presenceStatusesByContext: PresenceStatusesByContext = {};
const presenceListeners: Array<() => void> = [];

// Reduce normalized presence init/set/clear events into the grouped store shape.
export const reducePresenceState = (
  currentPresenceStatusesByContext: PresenceStatusesByContext,
  event: PresenceEvent
): PresenceStatusesByContext => {
  if (event.type === 'init') {
    const nextStatusesByContext: PresenceStatusesByContext = {};

    // Init replaces the whole snapshot, regrouping the flat API statuses by the
    // context ids that the UI already uses elsewhere.
    event.states.forEach((state) => {
      if (!state.contextId) {
        logger.log('dropping init presence state without contextId', {
          key: state.key,
        });
        return;
      }

      const contextStatuses =
        nextStatusesByContext[state.contextId] ??
        (nextStatusesByContext[state.contextId] = {});

      contextStatuses[toPresenceStatusId(state)] = state;
    });

    logger.log('reduced init presence event', {
      event: summarizePresenceEvent(event),
      nextState: summarizePresenceState(nextStatusesByContext),
    });

    return nextStatusesByContext;
  }

  if (event.type === 'set') {
    if (!event.state.contextId) {
      logger.log('ignoring set presence event without contextId', {
        key: event.state.key,
      });
      return currentPresenceStatusesByContext;
    }

    const contextId = event.state.contextId;
    const statusId = toPresenceStatusId(event.state);
    const existingContextStatuses = currentPresenceStatusesByContext[contextId];
    const nextContextStatuses = {
      ...(existingContextStatuses ?? {}),
      [statusId]: event.state,
    };
    const nextState = {
      ...currentPresenceStatusesByContext,
      [contextId]: nextContextStatuses,
    };

    logger.log('reduced set presence event', {
      event: summarizePresenceEvent(event),
      replacedExistingStatus: Boolean(existingContextStatuses?.[statusId]),
      previousContextSize: Object.keys(existingContextStatuses ?? {}).length,
      nextContextSize: Object.keys(nextContextStatuses).length,
      nextState: summarizePresenceState(nextState),
    });

    return nextState;
  }

  if (!event.contextId) {
    logger.log('ignoring clear presence event without contextId', {
      key: event.key,
    });
    return currentPresenceStatusesByContext;
  }

  const contextId = event.contextId;
  const existingContextStatuses = currentPresenceStatusesByContext[contextId];

  if (!existingContextStatuses) {
    logger.log('ignoring clear presence event for unknown context', {
      event: summarizePresenceEvent(event),
      currentState: summarizePresenceState(currentPresenceStatusesByContext),
    });
    return currentPresenceStatusesByContext;
  }

  const statusId = toPresenceKeyId(event.key);

  if (!(statusId in existingContextStatuses)) {
    logger.log('ignoring clear presence event for unknown status', {
      event: summarizePresenceEvent(event),
      knownStatusIds: Object.keys(existingContextStatuses),
    });
    return currentPresenceStatusesByContext;
  }

  const { [statusId]: _removedStatus, ...remainingContextStatuses } =
    existingContextStatuses;

  if (Object.keys(remainingContextStatuses).length === 0) {
    // Once the last status in a context is cleared, drop the bucket entirely so we
    // fall back to the shared empty map for future reads.
    const { [contextId]: _removedContext, ...remainingContexts } =
      currentPresenceStatusesByContext;

    logger.log('reduced clear presence event and removed empty context', {
      event: summarizePresenceEvent(event),
      nextState: summarizePresenceState(remainingContexts),
    });

    return remainingContexts;
  }

  const nextState = {
    ...currentPresenceStatusesByContext,
    [contextId]: remainingContextStatuses,
  };

  logger.log('reduced clear presence event', {
    event: summarizePresenceEvent(event),
    nextContextSize: Object.keys(remainingContextStatuses).length,
    nextState: summarizePresenceState(nextState),
  });

  return nextState;
};

function getPresenceState() {
  return presenceStatusesByContext;
}

function subscribeToPresence(listener: () => void) {
  presenceListeners.push(listener);
  logger.log('presence listener subscribed', {
    listenerCount: presenceListeners.length,
  });
  return () => {
    const index = presenceListeners.indexOf(listener);
    if (index >= 0) {
      presenceListeners.splice(index, 1);
    }
    logger.log('presence listener unsubscribed', {
      listenerCount: presenceListeners.length,
    });
  };
}

function setPresenceState(nextState: PresenceStatusesByContext) {
  // `useSyncExternalStore` only needs a notification when the snapshot reference
  // actually changes, so preserve no-op reducer results.
  if (nextState === presenceStatusesByContext) {
    logger.log('presence state unchanged, skipping notify', {
      state: summarizePresenceState(presenceStatusesByContext),
    });
    return;
  }

  const previousState = presenceStatusesByContext;
  presenceStatusesByContext = nextState;
  logger.log('presence state updated', {
    previousState: summarizePresenceState(previousState),
    nextState: summarizePresenceState(nextState),
    listenerCount: presenceListeners.length,
  });
  presenceListeners.forEach((listener) => listener());
}

export function handlePresenceEvent(event: PresenceEvent) {
  logger.log('handling presence event', summarizePresenceEvent(event));
  setPresenceState(reducePresenceState(presenceStatusesByContext, event));
}

export function clearPresenceState() {
  logger.log('clearing presence state', {
    previousState: summarizePresenceState(presenceStatusesByContext),
  });
  setPresenceState({});
}

export function getConversationPresence(conversationId: string) {
  const presence = Object.values(getConversationPresenceMap(conversationId));
  logger.log('reading conversation presence', {
    conversationId,
    count: presence.length,
  });
  return presence;
}

export function useConversationPresence(conversationId: string) {
  const conversationPresence = useSyncExternalStore(
    subscribeToPresence,
    () => getConversationPresenceMap(conversationId)
  );

  // The store keeps a keyed map for updates; components usually want the values.
  return useMemo(
    () => Object.values(conversationPresence),
    [conversationPresence]
  );
}

function getConversationPresenceMap(conversationId: string) {
  return getPresenceState()[conversationId] ?? EMPTY_CONTEXT_STATUSES;
}

function toPresenceStatusId(state: PresenceStatus) {
  return toPresenceKeyId(state.key);
}

function toPresenceKeyId(key: PresenceKey) {
  // The same ship can publish multiple presence topics in one context, so the
  // full wire key is the stable identity for a status entry.
  return `${key.context}|${key.ship}|${key.topic}`;
}

function summarizePresenceEvent(event: PresenceEvent) {
  if (event.type === 'init') {
    return {
      type: event.type,
      stateCount: event.states.length,
      contextIds: [
        ...new Set(event.states.map((state) => state.contextId).filter(Boolean)),
      ],
    };
  }

  if (event.type === 'set') {
    return {
      type: event.type,
      contextId: event.state.contextId,
      key: event.state.key,
    };
  }

  return {
    type: event.type,
    contextId: event.contextId,
    key: event.key,
  };
}

function summarizePresenceState(state: PresenceStatusesByContext) {
  const contextIds = Object.keys(state);

  return {
    contextCount: contextIds.length,
    statusCount: contextIds.reduce(
      (count, contextId) => count + Object.keys(state[contextId]).length,
      0
    ),
    byContext: Object.fromEntries(
      contextIds.map((contextId) => [
        contextId,
        Object.keys(state[contextId]).length,
      ])
    ),
  };
}
