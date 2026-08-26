import { isDmChannelId } from '@tloncorp/api/client';
import { preSig } from '@tloncorp/api/lib/urbit';
import * as db from '@tloncorp/shared/db';
import { conversationMatchesChannel } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import create from 'zustand';

import {
  contextLensEventKey,
  contextLensRunKeysForPosts,
  mergeContextLensEventSources,
} from './eventSources';
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
  contextLensEventAtTime,
  contextLensEventFromStewardRun,
  isContextLensEventActive,
} from './types';
import { useContextLensExpiryClock } from './useContextLensExpiryClock';

const MAX_EVENTS = 160;
const RECONNECT_DELAY_MS = 5000;
const POST_RUN_HYDRATION_RETRY_DELAYS_MS = [1_000, 5_000, 15_000] as const;
// A final reply can reach chat before the owner ship receives the terminal
// %steward snapshot. These bounded delays span just over the observed
// three-minute propagation window without turning run hydration into polling.
const POST_RUN_COMPLETION_RETRY_DELAYS_MS = [
  1_000, 5_000, 15_000, 30_000, 60_000, 90_000,
] as const;
type PostRunHydrationRetryMode = 'missing' | 'completion';

function mergeEvents(events: ContextLensEvent[], incoming: ContextLensEvent[]) {
  const known = new Set(events.map(contextLensEventKey));
  const added = incoming.filter(
    (event) => !known.has(contextLensEventKey(event))
  );
  if (!added.length) {
    return events;
  }
  return [...events, ...added]
    .sort((left, right) => left.at - right.at || left.seq - right.seq)
    .slice(-MAX_EVENTS);
}

export { mergeContextLensEventSources } from './eventSources';

type GatewayLensStreamState = Omit<LensStreamState, 'rawEvents'>;

const useLensStreamStore = create<GatewayLensStreamState>(() => ({
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
  const isDm = channel ? isDmChannelId(channel.id) : false;
  const chatId =
    !channel || isDm
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
  // Notes channels have no per-post surface for a run to attach to, so the
  // header toggle would open a panel with nothing to show.
  if (channel.type === 'notes') {
    return false;
  }
  if (isDm) {
    return (botShips ?? []).includes(preSig(channel.id));
  }
  return (botsInChat ?? []).length > 0;
}

export function useContextLensEvents(): LensStreamState {
  const config = useContextLensGatewayConfig();
  const { data: flagEnabled } = store.useContextLensEnabled();
  const { data: syncedRuns } = store.useRecentContextLensRuns(MAX_EVENTS);

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
  const durableSnapshots = useMemo(
    () =>
      flagEnabled
        ? (syncedRuns ?? []).flatMap((run) => {
            const event = contextLensEventFromStewardRun(
              run,
              Number.NEGATIVE_INFINITY
            );
            return event ? [event] : [];
          })
        : [],
    [flagEnabled, syncedRuns]
  );
  const expirableEvents = useMemo(
    () => [...events, ...durableSnapshots],
    [durableSnapshots, events]
  );
  const now = useContextLensExpiryClock(expirableEvents);
  const projectedEvents = useMemo(
    () => events.map((event) => contextLensEventAtTime(event, now)),
    [events, now]
  );
  const durableEvents = useMemo(
    () =>
      durableSnapshots.map((event) =>
        contextLensEventAtTime(event, now, 'steward-stale')
      ),
    [durableSnapshots, now]
  );
  const merged = useMemo(
    () => mergeContextLensEventSources(projectedEvents, durableEvents),
    [durableEvents, projectedEvents]
  );
  return useMemo(
    () => ({
      events: merged,
      rawEvents: events,
      status: config ? status : 'disabled',
    }),
    [events, merged, status, config]
  );
}

/**
 * Loaded chat posts are durable presentation anchors. Hydrate their exact run
 * snapshots independently of the bounded, high-frequency gateway stream so a
 * terminal card cannot disappear merely because newer activity arrived.
 */
export function useContextLensPostEvents(posts: readonly db.Post[]) {
  const { data: flagEnabled } = store.useContextLensEnabled();
  const { data: ownedBotShips } = store.useContextLensBotShips();
  const ownedBotShipSet = useMemo(
    () => new Set((ownedBotShips ?? []).map(preSig)),
    [ownedBotShips]
  );
  const keys = useMemo(
    () =>
      flagEnabled
        ? contextLensRunKeysForPosts(posts).filter((key) =>
            ownedBotShipSet.has(preSig(key.botShip))
          )
        : [],
    [flagEnabled, ownedBotShipSet, posts]
  );
  const runsQuery = store.useContextLensRunsByKeys(keys);
  const hydrationAttempts = useRef(new Map<string, number>());
  const hydrationRetryModes = useRef(
    new Map<string, PostRunHydrationRetryMode>()
  );
  const hydrationForceRefreshKeys = useRef(new Set<string>());
  const hydrationCompleteKeys = useRef(new Set<string>());
  const hydrationInFlight = useRef(new Set<string>());
  const hydrationRetryTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );
  const hydrationRequestedKeys = useRef(new Set<string>());
  const hydrationMounted = useRef(true);
  const [hydrationRetryRevision, setHydrationRetryRevision] = useState(0);

  useEffect(() => {
    hydrationMounted.current = true;
    const attempts = hydrationAttempts.current;
    const retryModes = hydrationRetryModes.current;
    const forceRefreshKeys = hydrationForceRefreshKeys.current;
    const completeKeys = hydrationCompleteKeys.current;
    const inFlight = hydrationInFlight.current;
    const retryTimers = hydrationRetryTimers.current;
    return () => {
      hydrationMounted.current = false;
      for (const timer of retryTimers.values()) {
        clearTimeout(timer);
      }
      retryTimers.clear();
      attempts.clear();
      retryModes.clear();
      forceRefreshKeys.clear();
      completeKeys.clear();
      inFlight.clear();
    };
  }, []);

  useEffect(() => {
    const requested = new Set(
      flagEnabled ? keys.map((key) => `${key.botShip}\n${key.lensId}`) : []
    );
    hydrationRequestedKeys.current = requested;
    hydrationCompleteKeys.current.clear();
    for (const [id, timer] of hydrationRetryTimers.current) {
      if (requested.has(id)) continue;
      clearTimeout(timer);
      hydrationRetryTimers.current.delete(id);
    }
    for (const id of hydrationAttempts.current.keys()) {
      if (requested.has(id)) continue;
      hydrationAttempts.current.delete(id);
      hydrationRetryModes.current.delete(id);
      hydrationForceRefreshKeys.current.delete(id);
    }
    for (const id of hydrationInFlight.current) {
      if (requested.has(id)) continue;
      hydrationInFlight.current.delete(id);
    }
    if (!flagEnabled || !runsQuery.isFetched || keys.length === 0) return;
    const runsById = new Map(
      (runsQuery.data ?? []).map((run) => [
        `${preSig(run.botShip)}\n${run.lensId}`,
        run,
      ])
    );
    for (const [id, run] of runsById) {
      if (!run.complete) continue;
      hydrationCompleteKeys.current.add(id);
      hydrationAttempts.current.delete(id);
      hydrationRetryModes.current.delete(id);
      hydrationForceRefreshKeys.current.delete(id);
      hydrationInFlight.current.delete(id);
      const timer = hydrationRetryTimers.current.get(id);
      if (timer) clearTimeout(timer);
      hydrationRetryTimers.current.delete(id);
    }
    const pending = keys.flatMap((key) => {
      const id = `${key.botShip}\n${key.lensId}`;
      const run = runsById.get(id);
      if (
        run?.complete ||
        hydrationInFlight.current.has(id) ||
        hydrationRetryTimers.current.has(id)
      ) {
        return [];
      }
      const forceRefresh =
        run?.complete === false || hydrationForceRefreshKeys.current.has(id);
      const retryMode: PostRunHydrationRetryMode = forceRefresh
        ? 'completion'
        : 'missing';
      const retryDelays =
        retryMode === 'completion'
          ? POST_RUN_COMPLETION_RETRY_DELAYS_MS
          : POST_RUN_HYDRATION_RETRY_DELAYS_MS;
      if (
        hydrationRetryModes.current.get(id) === retryMode &&
        (hydrationAttempts.current.get(id) ?? 0) > retryDelays.length
      ) {
        return [];
      }
      return [
        {
          key,
          forceRefresh,
        },
      ];
    });
    if (!pending.length) return;

    for (const { key } of pending) {
      hydrationInFlight.current.add(`${key.botShip}\n${key.lensId}`);
    }

    void (async () => {
      for (let index = 0; index < pending.length; index += 4) {
        const batch = pending.slice(index, index + 4);
        const results = await Promise.all(
          batch.map(({ key, forceRefresh }) =>
            forceRefresh
              ? store.refreshContextLensRun(key)
              : store.ensureContextLensRun(key)
          )
        );
        results.forEach((result, resultIndex) => {
          const { key, forceRefresh } = batch[resultIndex];
          const id = `${key.botShip}\n${key.lensId}`;
          hydrationInFlight.current.delete(id);
          if (
            !hydrationMounted.current ||
            !hydrationRequestedKeys.current.has(id) ||
            hydrationCompleteKeys.current.has(id)
          ) {
            return;
          }
          if (result?.complete) {
            hydrationAttempts.current.delete(id);
            hydrationRetryModes.current.delete(id);
            hydrationForceRefreshKeys.current.delete(id);
            return;
          }
          const retryMode: PostRunHydrationRetryMode =
            forceRefresh || result?.complete === false
              ? 'completion'
              : 'missing';
          if (retryMode === 'completion') {
            hydrationForceRefreshKeys.current.add(id);
          }
          const priorMode = hydrationRetryModes.current.get(id);
          const attempt =
            priorMode === retryMode
              ? (hydrationAttempts.current.get(id) ?? 0) + 1
              : 1;
          hydrationRetryModes.current.set(id, retryMode);
          hydrationAttempts.current.set(id, attempt);
          const retryDelays =
            retryMode === 'completion'
              ? POST_RUN_COMPLETION_RETRY_DELAYS_MS
              : POST_RUN_HYDRATION_RETRY_DELAYS_MS;
          const delay = retryDelays[attempt - 1];
          if (delay === undefined || hydrationRetryTimers.current.has(id)) {
            return;
          }
          hydrationRetryTimers.current.set(
            id,
            setTimeout(() => {
              hydrationRetryTimers.current.delete(id);
              setHydrationRetryRevision((revision) => revision + 1);
            }, delay)
          );
        });
      }
    })();
  }, [
    flagEnabled,
    hydrationRetryRevision,
    keys,
    runsQuery.data,
    runsQuery.isFetched,
  ]);

  const runSnapshots = useMemo(
    () =>
      (runsQuery.data ?? []).flatMap((run) => {
        const event = contextLensEventFromStewardRun(
          run,
          Number.NEGATIVE_INFINITY
        );
        return event ? [event] : [];
      }),
    [runsQuery.data]
  );
  const now = useContextLensExpiryClock(runSnapshots);
  return useMemo(
    () =>
      runSnapshots.map((event) =>
        contextLensEventAtTime(event, now, 'steward-stale')
      ),
    [now, runSnapshots]
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
    event.lens.botShip ?? botShipByLensId?.get(event.lens.lensId) ?? channelId,
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

  const openContextLensForEvent = useCallback(
    (event: ContextLensEvent) => {
      setSelectedContextLensMessage({
        id: event.lens.triggerDetails?.messageId ?? event.lens.messageId,
        authorId: event.lens.triggerDetails?.authorShip ?? null,
        channelId:
          event.lens.triggerDetails?.conversationId ??
          params?.channel?.id ??
          null,
        lensId: event.lens.lensId,
        botShip: event.lens.botShip,
      });
      setOpen(true);
    },
    [params?.channel?.id]
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
    openContextLensForEvent,
  };
}
