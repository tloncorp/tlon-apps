import { da, parse } from '@urbit/aura';

import { createDevLogger } from '../lib/logger';
import { preSig } from '../lib/urbit';
import * as ub from '../urbit';
import {
  formatScryPath,
  isDmChannelId,
  isGroupChannelId,
  parseGroupChannelId,
  parseGroupId,
} from './apiUtils';
import {
  BadResponseError,
  getCurrentUserId,
  poke,
  scry,
  subscribe,
} from './urbit';

const logger = createDevLogger('presenceApi', false);

export interface PresenceDisplayInput {
  icon?: string | null;
  text?: string | null;
  blob?: string | null;
}

export interface PresenceTiming {
  since: number;
  timeout: string | null;
}

// Client-facing presence entries keep the original wire fields but add a
// normalized app context id so consumers can work with conversation/group ids
// instead of Urbit-specific paths.
export interface PresenceStatus {
  key: ub.PresenceKey;
  timing: PresenceTiming;
  display: ub.PresenceDisplay;
  contextId: string | null;
}

// The store consumes a small normalized event union rather than the raw wire
// shapes so init/set/clear all share the same context-id semantics.
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

// Wrap a DM presence context so the moon's host relays it on the moon's
// behalf: /dm/<who> -> /vouched/<moon>/dm/<who>. The host is the moon's
// sponsor. See the +presence agent's vouched handling.
export const toVouchedPresenceContext = (as: string, context: string) =>
  `/vouched/${preSig(as)}${context}`;

// Presence keys are scoped to wire contexts like `/dm/~nec`; convert them back to
// the app's stable ids so store consumers can join presence against existing data.
export const getPresenceContextIdFromKey = (key: ub.PresenceKey) => {
  const context = parsePresenceContext(key.context);

  if (!context) {
    return null;
  }

  if (context.type === 'dm') {
    return context.ship;
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
  as = null,
}: {
  context: string;
  topic: ub.PresenceTopic;
  display?: PresenceDisplayInput;
  disclose?: string[];
  timeout?: string | null;
  // When set, publish this presence as a bot moon we host: the context is
  // wrapped as /vouched/<moon>/… and the presence is keyed by the moon, so the
  // host relays it to the human on the moon's behalf. See +presence agent.
  as?: string | null;
}) => {
  return poke({
    app: 'presence',
    mark: 'presence-action-1',
    json: {
      set: {
        disclose,
        key: {
          context: as ? toVouchedPresenceContext(as, context) : context,
          ship: as ? preSig(as) : getCurrentUserId(),
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
  as?: string | null;
}) => {
  return setPresence({
    context: conversationIdToPresenceContext(conversationId),
    ...params,
  });
};

export const clearPresence = async ({
  context,
  topic,
  as = null,
}: {
  context: string;
  topic: ub.PresenceTopic;
  as?: string | null;
}) => {
  return poke({
    app: 'presence',
    mark: 'presence-action-1',
    json: {
      clear: {
        context: as ? toVouchedPresenceContext(as, context) : context,
        ship: as ? preSig(as) : getCurrentUserId(),
        topic,
      },
    } satisfies ub.PresenceAction,
  });
};

export const clearConversationPresence = async ({
  conversationId,
  topic,
  as = null,
}: {
  conversationId: string;
  topic: ub.PresenceTopic;
  as?: string | null;
}) => {
  return clearPresence({
    context: conversationIdToPresenceContext(conversationId),
    topic,
    as,
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
  try {
    await scry<ub.PresenceResponse>({
      app: 'presence',
      path: '/v1/init',
    });
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      logger.trackEvent('%presence agent missing');
      logger.warn('presence agent unavailable, skipping presence subscription');
      return null;
    }

    throw error;
  }

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

// The init response arrives as a nested context -> topic -> ship tree. Flatten it
// into the same one-status-per-entry shape that incremental events use.
export const toPresenceStatuses = (places: ub.PresencePlaces) => {
  return Object.entries(places).flatMap(([context, topics]) =>
    Object.entries(topics).flatMap(([topic, people]) =>
      Object.entries(people ?? {}).map(([ship, entry]) =>
        toPresenceStatus({
          key: {
            context,
            ship,
            topic: topic as ub.PresenceTopic,
          },
          timing: entry.timing,
          display: entry.display,
        })
      )
    )
  );
};

export const toPresenceStatus = (state: {
  key: ub.PresenceKey;
  timing: ub.PresenceTiming;
  display: ub.PresenceDisplay;
}): PresenceStatus => {
  return {
    ...state,
    timing: toPresenceTiming(state.timing),
    contextId: getPresenceContextIdFromKey(state.key),
  };
};

// Collapse the three wire response variants into the reducer-friendly event union.
export const toPresenceEvent = (event: ub.PresenceResponse): PresenceEvent => {
  if ('init' in event) {
    return {
      type: 'init',
      states: toPresenceStatuses(event.init),
    };
  }

  if ('here' in event) {
    return {
      type: 'set',
      state: toPresenceStatus(event.here),
    };
  }

  return {
    type: 'clear',
    key: event.gone,
    contextId: getPresenceContextIdFromKey(event.gone),
  };
};

function toWireDisplay(
  display?: PresenceDisplayInput
): ub.PresenceActionDisplay {
  return {
    icon: display?.icon ?? null,
    text: display?.text ?? null,
    blob: display?.blob ?? null,
  };
}

function toPresenceTiming(timing: ub.PresenceTiming): PresenceTiming {
  try {
    return {
      since: Number(da.toUnix(parse('da', timing.since))),
      timeout: timing.timeout,
    };
  } catch {
    logger.log('failed to parse presence timing', timing);
    return {
      since: 0,
      timeout: timing.timeout,
    };
  }
}

function parsePresenceContext(context: string): ParsedPresenceContext | null {
  const parts = context.split('/').filter(Boolean);

  if (parts[0] === 'dm' && parts.length === 2) {
    return {
      type: 'dm',
      ship: preSig(parts[1]),
    };
  }

  // a bot moon's presence context as seen on the host: /vouched/<moon>/dm/<who>.
  // Key it by the moon so the host's own client can display the bot's presence.
  if (parts[0] === 'vouched' && parts[2] === 'dm' && parts.length === 4) {
    return {
      type: 'dm',
      ship: preSig(parts[1]),
    };
  }

  if (parts[0] === 'channel' && parts.length === 4) {
    return {
      type: 'channel',
      kind: parts[1] as ub.Kind,
      host: preSig(parts[2]),
      name: parts[3],
    };
  }

  if (parts[0] === 'group' && parts.length === 3) {
    return {
      type: 'group',
      host: preSig(parts[1]),
      name: parts[2],
    };
  }

  return null;
}
