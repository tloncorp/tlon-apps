import type { PresenceEvent, PresenceStatus } from '@tloncorp/api';
import type { PresenceKey } from '@tloncorp/api/urbit';
import { useMemo, useSyncExternalStore } from 'react';

import { createDevLogger } from '../debug';

type PresenceStatusesByKey = Record<string, PresenceStatus>;
export type PresenceStatusesByContext = Record<string, PresenceStatusesByKey>;

const logger = createDevLogger('presenceStore', false);
const EMPTY_CONTEXT_STATUSES = Object.freeze({}) as PresenceStatusesByKey;
let statusesByContext: PresenceStatusesByContext = {};
const presenceListeners: Array<() => void> = [];

export const reducePresenceState = (
  statusesByContext: PresenceStatusesByContext,
  event: PresenceEvent
): PresenceStatusesByContext => {
  if (event.type === 'init') {
    const nextStatusesByContext: PresenceStatusesByContext = {};

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
      return statusesByContext;
    }

    const contextId = event.state.contextId;
    const statusId = toPresenceStatusId(event.state);
    const existingContextStatuses = statusesByContext[contextId];
    const nextContextStatuses = {
      ...(existingContextStatuses ?? {}),
      [statusId]: event.state,
    };
    const nextState = {
      ...statusesByContext,
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
    return statusesByContext;
  }

  const contextId = event.contextId;
  const existingContextStatuses = statusesByContext[contextId];

  if (!existingContextStatuses) {
    logger.log('ignoring clear presence event for unknown context', {
      event: summarizePresenceEvent(event),
      currentState: summarizePresenceState(statusesByContext),
    });
    return statusesByContext;
  }

  const statusId = toPresenceKeyId(event.key);

  if (!(statusId in existingContextStatuses)) {
    logger.log('ignoring clear presence event for unknown status', {
      event: summarizePresenceEvent(event),
      knownStatusIds: Object.keys(existingContextStatuses),
    });
    return statusesByContext;
  }

  const { [statusId]: _removedStatus, ...remainingContextStatuses } =
    existingContextStatuses;

  if (Object.keys(remainingContextStatuses).length === 0) {
    const { [contextId]: _removedContext, ...remainingContexts } =
      statusesByContext;

    logger.log('reduced clear presence event and removed empty context', {
      event: summarizePresenceEvent(event),
      nextState: summarizePresenceState(remainingContexts),
    });

    return remainingContexts;
  }

  const nextState = {
    ...statusesByContext,
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
  return statusesByContext;
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
  if (nextState === statusesByContext) {
    logger.log('presence state unchanged, skipping notify', {
      state: summarizePresenceState(statusesByContext),
    });
    return;
  }

  const previousState = statusesByContext;
  statusesByContext = nextState;
  logger.log('presence state updated', {
    previousState: summarizePresenceState(previousState),
    nextState: summarizePresenceState(nextState),
    listenerCount: presenceListeners.length,
  });
  presenceListeners.forEach((listener) => listener());
}

export function handlePresenceEvent(event: PresenceEvent) {
  logger.log('handling presence event', summarizePresenceEvent(event));
  setPresenceState(reducePresenceState(statusesByContext, event));
}

export function clearPresenceState() {
  logger.log('clearing presence state', {
    previousState: summarizePresenceState(statusesByContext),
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
