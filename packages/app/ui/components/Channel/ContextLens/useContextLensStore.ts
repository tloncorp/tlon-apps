import { preSig } from '@tloncorp/api/lib/urbit';
import * as db from '@tloncorp/shared/db';
import { conversationMatchesChannel } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import create from 'zustand';

import {
  type ContextLensGatewayConfig,
  fetchRecentContextLensEvents,
  streamContextLensEvents,
} from './gatewayClient';
import { getContextLensStamp } from './lensPost';
import {
  type ContextLensEvent,
  type ContextLensSelectedMessage,
  type LensStreamState,
  isContextLensEventActive,
} from './types';

const MAX_EVENTS = 160;
const RECONNECT_DELAY_MS = 5000;

function eventKey(event: ContextLensEvent) {
  return [
    event.seq,
    event.at,
    event.phase,
    event.lens.lensId,
    event.detail?.toolCallCount ?? '',
    event.detail?.toolName ?? '',
  ].join(':');
}

function mergeEvents(events: ContextLensEvent[], incoming: ContextLensEvent[]) {
  const known = new Set(events.map(eventKey));
  const added = incoming.filter((event) => !known.has(eventKey(event)));
  if (!added.length) {
    return events;
  }
  return [...events, ...added]
    .sort((left, right) => left.at - right.at || left.seq - right.seq)
    .slice(-MAX_EVENTS);
}

const useLensStreamStore = create<LensStreamState>(() => ({
  events: [],
  status: 'disabled',
}));

// One gateway connection shared by every mounted panel/controller
// (Channel + PostScreenView), ref-counted so it lives while any consumer
// is mounted and reconnects with Last-Event-ID replay after drops.
let refCount = 0;
let activeKey: string | null = null;
let stopStream: (() => void) | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastEventId: number | null = null;
let seededRecent = false;

function configKey(config: ContextLensGatewayConfig) {
  return `${config.baseUrl}\n${config.token}`;
}

function connect(config: ContextLensGatewayConfig) {
  const key = configKey(config);
  useLensStreamStore.setState({ status: 'connecting' });

  if (!seededRecent) {
    seededRecent = true;
    fetchRecentContextLensEvents(config)
      .then((events) => {
        if (activeKey !== key) {
          return;
        }
        useLensStreamStore.setState((state) => ({
          events: mergeEvents(state.events, events),
        }));
      })
      .catch(() => {
        // The stream's own error path drives status; seeding is best-effort.
      });
  }

  stopStream = streamContextLensEvents(config, {
    lastEventId,
    onEvent: (event, eventId) => {
      if (activeKey !== key) {
        return;
      }
      if (eventId !== null) {
        lastEventId = eventId;
      }
      useLensStreamStore.setState((state) => ({
        events: mergeEvents(state.events, [event]),
      }));
    },
    onOpen: () => {
      if (activeKey === key) {
        useLensStreamStore.setState({ status: 'connected' });
      }
    },
    onClose: () => {
      if (activeKey !== key) {
        return;
      }
      stopStream = null;
      useLensStreamStore.setState({ status: 'offline' });
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (activeKey === key && refCount > 0) {
          connect(config);
        }
      }, RECONNECT_DELAY_MS);
    },
  });
}

function teardownConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopStream?.();
  stopStream = null;
}

function retainContextLensConnection(config: ContextLensGatewayConfig) {
  refCount += 1;
  const key = configKey(config);
  if (key === activeKey) {
    return;
  }
  teardownConnection();
  activeKey = key;
  lastEventId = null;
  seededRecent = false;
  useLensStreamStore.setState({ events: [], status: 'connecting' });
  connect(config);
}

function releaseContextLensConnection() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) {
    return;
  }
  teardownConnection();
  activeKey = null;
  lastEventId = null;
  seededRecent = false;
  useLensStreamStore.setState({ events: [], status: 'disabled' });
}

export function useContextLensGatewayConfig(): ContextLensGatewayConfig | null {
  const { data: flagEnabled } = store.useContextLensEnabled();
  const url = db.contextLensGatewayUrl.useValue();
  const token = db.contextLensGatewayToken.useValue();
  return useMemo(() => {
    if (Platform.OS !== 'web' || !flagEnabled) {
      return null;
    }
    const baseUrl = url?.trim();
    const trimmedToken = token?.trim();
    if (!baseUrl || !trimmedToken) {
      return null;
    }
    return { baseUrl, token: trimmedToken };
  }, [flagEnabled, url, token]);
}

// Availability is flag-gated everywhere; when a channel is provided it is
// additionally scoped to where the bot actually is: a known bot ship (from
// synced lens runs) must be the DM counterpart or hold a seat in the
// channel's group. Without a channel it stays flag-only, for surfaces that
// already have direct evidence (a lens-stamped post).
export function useContextLensAvailable(channel?: db.Channel | null) {
  const { data: flagEnabled } = store.useContextLensEnabled();
  const isDm = channel?.type === 'dm';
  const chatId = !channel
    ? null
    : channel.type === 'groupDm'
      ? channel.id
      : channel.groupId ?? null;
  const { data: botShips } = store.useContextLensBotShips();
  const { data: botsInChat } = store.useContextLensBotsInChat({
    chatId: flagEnabled ? chatId : null,
  });

  if (!flagEnabled) {
    return false;
  }
  if (!channel) {
    return true;
  }
  if (isDm) {
    return (botShips ?? []).includes(preSig(channel.id));
  }
  return (botsInChat ?? []).length > 0;
}

export function useContextLensEvents(): LensStreamState {
  const config = useContextLensGatewayConfig();

  useEffect(() => {
    if (!config) {
      return;
    }
    retainContextLensConnection(config);
    return () => {
      releaseContextLensConnection();
    };
  }, [config]);

  const events = useLensStreamStore((state) => state.events);
  const status = useLensStreamStore((state) => state.status);
  return useMemo(
    () => ({ events, status: config ? status : 'disabled' }),
    [events, status, config]
  );
}

// Match a live gateway event to a channel. Live events don't carry the bot
// ship, so for DM matching resolve it from the synced rows when available;
// before a %context-lens row has synced for a new lensId, fall back to the
// channel id itself (a DM channel id is the bot ship). Ignored for group
// matching, which keys off the conversation nest.
export function liveEventMatchesChannel(
  event: ContextLensEvent,
  channelId: string,
  botShipByLensId?: Map<string, string>
) {
  return conversationMatchesChannel(
    {
      chatType: event.lens.chatType,
      conversationId: event.lens.triggerDetails?.conversationId ?? null,
    },
    botShipByLensId?.get(event.lens.lensId) ?? channelId,
    channelId
  );
}

export function useContextLensRuns(events: ContextLensEvent[]) {
  return useMemo(() => {
    const latestByLens = new Map<string, ContextLensEvent>();
    for (const event of events) {
      latestByLens.set(event.lens.lensId, event);
    }
    return [...latestByLens.values()].sort((left, right) => right.at - left.at);
  }, [events]);
}

export function useContextLensController(params?: {
  channel?: db.Channel | null;
}) {
  const contextLensAvailable = useContextLensAvailable(params?.channel);
  const [open, setOpen] = useState(false);
  const [selectedContextLensMessage, setSelectedContextLensMessage] =
    useState<ContextLensSelectedMessage | null>(null);
  const contextLensStream = useContextLensEvents();
  const contextLensRuns = useContextLensRuns(contextLensStream.events);
  // Availability can be channel-scoped, so scope the active flag to the same
  // channel — otherwise an active run in another channel would light up this
  // channel's UI.
  const scopedRuns = useMemo(() => {
    const channelId = params?.channel?.id;
    if (!channelId) {
      return contextLensRuns;
    }
    return contextLensRuns.filter((event) =>
      liveEventMatchesChannel(event, channelId)
    );
  }, [contextLensRuns, params?.channel?.id]);
  const contextLensActive =
    contextLensAvailable && scopedRuns.some(isContextLensEventActive);

  useEffect(() => {
    if (!contextLensAvailable && open) {
      setOpen(false);
    }
  }, [contextLensAvailable, open]);

  const toggleContextLens = useCallback(() => {
    if (!open) {
      setSelectedContextLensMessage(null);
    }
    setOpen((wasOpen) => !wasOpen);
  }, [open]);

  const clearSelectedContextLensMessage = useCallback(() => {
    setSelectedContextLensMessage(null);
  }, []);

  const inspectContextLensPost = useCallback((post: db.Post) => {
    const stamp = getContextLensStamp(post);
    setSelectedContextLensMessage({
      id: post.id,
      authorId: post.authorId,
      channelId: post.channelId,
      lensId: stamp?.lensId ?? null,
      botShip: stamp?.botShip ?? null,
    });
  }, []);

  const openContextLensForPost = useCallback(
    (post: db.Post) => {
      inspectContextLensPost(post);
      setOpen(true);
    },
    [inspectContextLensPost]
  );

  return {
    contextLensAvailable,
    contextLensOpen: contextLensAvailable && open,
    contextLensActive,
    contextLensStream,
    selectedContextLensMessage,
    toggleContextLens,
    clearSelectedContextLensMessage,
    inspectContextLensPost,
    openContextLensForPost,
  };
}
