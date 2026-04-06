import { createDevLogger } from '../lib/logger';
import * as ub from '../urbit';
import {
  formatScryPath,
  isDmChannelId,
  isGroupChannelId,
  parseGroupChannelId,
  parseGroupId,
} from './apiUtils';
import { getCurrentUserId, poke, scry, subscribe } from './urbit';

const logger = createDevLogger('presenceApi', false);

export interface PresenceDisplayInput {
  icon?: string | null;
  text?: string | null;
  blob?: string | null;
}

export interface PresenceStatus {
  key: ub.PresenceKey;
  timing: ub.PresenceTiming;
  display: ub.PresenceDisplay;
  contextId: string | null;
}

export type PresenceEvent =
  | { type: 'init'; states: PresenceStatus[] }
  | { type: 'set'; state: PresenceStatus }
  | { type: 'clear'; key: ub.PresenceKey; contextId: string | null };

type ParsedPresenceContext =
  | { type: 'dm'; ship: string }
  | { type: 'channel'; kind: ub.Kind; host: string; name: string }
  | { type: 'group'; host: string; name: string };

export const conversationIdToPresenceContext = (conversationId: string) => {
  if (isDmChannelId(conversationId)) {
    return formatScryPath('dm', conversationId);
  }

  if (isGroupChannelId(conversationId)) {
    const { kind, host, name } = parseGroupChannelId(conversationId);
    return formatScryPath('channel', kind, host, name);
  }

  throw new Error(
    `Presence only supports one-to-one DMs and channels, got "${conversationId}"`
  );
};

export const groupIdToPresenceContext = (groupId: string) => {
  const { host, name } = parseGroupId(groupId);
  return formatScryPath('group', host, name);
};

export const getPresenceContextIdFromKey = (
  key: ub.PresenceKey,
  currentUserId = getCurrentUserId()
) => {
  const context = parsePresenceContext(key.context);

  if (!context) {
    return null;
  }

  if (context.type === 'dm') {
    if (key.ship === currentUserId) {
      return context.ship;
    }

    if (context.ship === currentUserId) {
      return key.ship;
    }

    return null;
  }

  if (context.type === 'channel') {
    return `${context.kind}/${context.host}/${context.name}`;
  }

  return `${context.host}/${context.name}`;
};

export const getPresence = async () => {
  const response = await scry<ub.PresenceResponse>({
    app: 'presence',
    path: '/v1/init',
  });

  if (!('init' in response)) {
    throw new Error('Unexpected presence init response');
  }

  return toPresenceStatuses(response.init);
};

export const getConversationPresence = async (conversationId: string) => {
  const states = await getPresence();
  return states.filter((state) => state.contextId === conversationId);
};

export const setPresence = async ({
  context,
  topic,
  display,
  disclose = [],
  timeout = null,
}: {
  context: string;
  topic: ub.PresenceTopic;
  display?: PresenceDisplayInput;
  disclose?: string[];
  timeout?: string | null;
}) => {
  return poke({
    app: 'presence',
    mark: 'presence-action-1',
    json: {
      set: {
        disclose,
        key: {
          context,
          ship: getCurrentUserId(),
          topic,
        },
        timeout,
        display: toWireDisplay(display),
      },
    } satisfies ub.PresenceAction,
  });
};

export const setConversationPresence = async ({
  conversationId,
  ...params
}: {
  conversationId: string;
  topic: ub.PresenceTopic;
  display?: PresenceDisplayInput;
  disclose?: string[];
  timeout?: string | null;
}) => {
  return setPresence({
    context: conversationIdToPresenceContext(conversationId),
    ...params,
  });
};

export const clearPresence = async ({
  context,
  topic,
}: {
  context: string;
  topic: ub.PresenceTopic;
}) => {
  return poke({
    app: 'presence',
    mark: 'presence-action-1',
    json: {
      clear: {
        context,
        ship: getCurrentUserId(),
        topic,
      },
    } satisfies ub.PresenceAction,
  });
};

export const clearConversationPresence = async ({
  conversationId,
  topic,
}: {
  conversationId: string;
  topic: ub.PresenceTopic;
}) => {
  return clearPresence({
    context: conversationIdToPresenceContext(conversationId),
    topic,
  });
};

export const clearPresenceContext = async (context: string) => {
  return poke({
    app: 'presence',
    mark: 'presence-action-1',
    json: {
      nuke: context,
    } satisfies ub.PresenceAction,
  });
};

export const subscribeToPresenceUpdates = async (
  handler: (event: PresenceEvent) => void
) => {
  return subscribe<ub.PresenceResponse>(
    {
      app: 'presence',
      path: '/v1',
    },
    (event) => {
      logger.log('raw presence event', event);
      handler(toPresenceEvent(event));
    }
  );
};

export const subscribeToConversationPresenceUpdates = async (
  conversationId: string,
  handler: (event: PresenceEvent) => void
) => {
  return subscribeToPresenceUpdates((event) => {
    if (event.type === 'init') {
      handler({
        type: 'init',
        states: event.states.filter(
          (state) => state.contextId === conversationId
        ),
      });
      return;
    }

    if (event.type === 'set') {
      if (event.state.contextId === conversationId) {
        handler(event);
      }
      return;
    }

    if (event.contextId === conversationId) {
      handler(event);
    }
  });
};

export const toPresenceStatuses = (
  places: ub.PresencePlaces,
  currentUserId = getCurrentUserId()
) => {
  return Object.entries(places).flatMap(([context, topics]) =>
    Object.entries(topics).flatMap(([topic, people]) =>
      Object.entries(people ?? {}).map(([ship, entry]) =>
        toPresenceStatus(
          {
            key: {
              context,
              ship,
              topic: topic as ub.PresenceTopic,
            },
            timing: entry.timing,
            display: entry.display,
          },
          currentUserId
        )
      )
    )
  );
};

export const toPresenceStatus = (
  state: {
    key: ub.PresenceKey;
    timing: ub.PresenceTiming;
    display: ub.PresenceDisplay;
  },
  currentUserId = getCurrentUserId()
): PresenceStatus => {
  return {
    ...state,
    contextId: getPresenceContextIdFromKey(state.key, currentUserId),
  };
};

export const toPresenceEvent = (
  event: ub.PresenceResponse,
  currentUserId = getCurrentUserId()
): PresenceEvent => {
  if ('init' in event) {
    return {
      type: 'init',
      states: toPresenceStatuses(event.init, currentUserId),
    };
  }

  if ('here' in event) {
    return {
      type: 'set',
      state: toPresenceStatus(event.here, currentUserId),
    };
  }

  return {
    type: 'clear',
    key: event.gone,
    contextId: getPresenceContextIdFromKey(event.gone, currentUserId),
  };
};

function toWireDisplay(
  display?: PresenceDisplayInput
): ub.PresenceActionDisplay {
  return {
    symbol: display?.icon ?? null,
    text: display?.text ?? null,
    blob: display?.blob ?? null,
  };
}

function parsePresenceContext(context: string): ParsedPresenceContext | null {
  const parts = context.split('/').filter(Boolean);

  if (parts[0] === 'dm' && parts.length === 2) {
    return {
      type: 'dm',
      ship: normalizeShip(parts[1]),
    };
  }

  if (parts[0] === 'channel' && parts.length === 4) {
    return {
      type: 'channel',
      kind: parts[1] as ub.Kind,
      host: normalizeShip(parts[2]),
      name: parts[3],
    };
  }

  if (parts[0] === 'group' && parts.length === 3) {
    return {
      type: 'group',
      host: normalizeShip(parts[1]),
      name: parts[2],
    };
  }

  return null;
}

function normalizeShip(ship: string) {
  return ship.startsWith('~') ? ship : `~${ship}`;
}
