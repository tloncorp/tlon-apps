import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import create from 'zustand';

import { useFeatureFlag } from '../../../../lib/featureFlags';
import { getContextLensStamp } from './lensPost';
import {
  type ContextLensGatewayConfig,
  fetchRecentContextLensEvents,
  streamContextLensEvents,
} from './gatewayClient';
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
  const [flagEnabled] = useFeatureFlag('contextLens');
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

// Availability is flag-driven: run history syncs from the ship's %context-lens
// agent on every platform. The gateway connection (web-only, above) is an
// optional live-streaming enhancement on top.
export function useContextLensAvailable() {
  const [flagEnabled] = useFeatureFlag('contextLens');
  return flagEnabled;
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

export function useContextLensRuns(events: ContextLensEvent[]) {
  return useMemo(() => {
    const latestByLens = new Map<string, ContextLensEvent>();
    for (const event of events) {
      latestByLens.set(event.lens.lensId, event);
    }
    return [...latestByLens.values()].sort((left, right) => right.at - left.at);
  }, [events]);
}

export function useContextLensController() {
  const contextLensAvailable = useContextLensAvailable();
  const [open, setOpen] = useState(false);
  const [selectedContextLensMessage, setSelectedContextLensMessage] =
    useState<ContextLensSelectedMessage | null>(null);
  const contextLensStream = useContextLensEvents();
  const contextLensRuns = useContextLensRuns(contextLensStream.events);
  const contextLensActive =
    contextLensAvailable && contextLensRuns.some(isContextLensEventActive);

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

  return {
    contextLensAvailable,
    contextLensOpen: contextLensAvailable && open,
    contextLensActive,
    contextLensStream,
    selectedContextLensMessage,
    toggleContextLens,
    clearSelectedContextLensMessage,
    inspectContextLensPost,
  };
}
