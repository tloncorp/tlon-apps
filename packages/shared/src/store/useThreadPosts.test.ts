import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { recordThreadEvidence } from './threadSyncTelemetry';
import { useThreadCatchupTelemetry, useThreadPosts } from './useThreadPosts';

const mocks = vi.hoisted(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  return {
    capture: vi.fn(),
    sync: vi.fn(),
    read: vi.fn(),
    readDiagnostics: vi.fn(),
  };
});
vi.mock('../debug', () => ({
  createDevLogger: () => ({ trackEvent: mocks.capture }),
  addCustomEnabledLoggers: vi.fn(),
}));
vi.mock('./sync', () => ({ syncThreadPosts: mocks.sync }));
vi.mock('../db', () => ({
  getThreadPosts: Object.assign(mocks.read, {
    meta: { tableDependencies: ['posts'] },
  }),
  getThreadPostDiagnostics: mocks.readDiagnostics,
}));
const identity = {
  channelId: 'chat/~zod/test',
  postId: 'root',
  authorId: '~zod',
};
const reply = {
  id: 'reply',
  type: 'reply',
  parentId: 'root',
  channelId: identity.channelId,
  authorId: '~zod',
  sentAt: 1,
  receivedAt: 1,
};
let client: QueryClient;
let renderer: ReactTestRenderer;
let foreground: boolean;
const isForeground = () => foreground;

function Harness({ focused = true }: { focused?: boolean }) {
  const query = useThreadPosts(identity);
  const view = useMemo(
    () => ({
      queryReplies: query.data,
      listReplies: query.data ?? [],
      includeDeleted: false,
      queryStatus: query.status,
      fetchStatus: query.fetchStatus,
      dataUpdatedAt: query.dataUpdatedAt,
      errorUpdatedAt: query.errorUpdatedAt,
    }),
    [
      query.data,
      query.status,
      query.fetchStatus,
      query.dataUpdatedAt,
      query.errorUpdatedAt,
    ]
  );
  useThreadCatchupTelemetry({
    ...identity,
    active: foreground && focused,
    isForeground,
    view,
  });
  return null;
}
function tree(focused = true) {
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(Harness, { focused })
  );
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function outcomes(outcome: string) {
  return mocks.capture.mock.calls.filter(
    ([, props]) => props.outcome === outcome
  );
}
function receive() {
  recordThreadEvidence({
    ...identity,
    attemptId: 'fetch-1',
    source: 'thread_fetch',
    startedAt: Date.now(),
    replies: [reply],
  });
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.clearAllMocks();
  foreground = true;
  client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false, gcTime: 0 },
    },
  });
  mocks.sync.mockResolvedValue(undefined);
  mocks.read.mockResolvedValue([]);
  mocks.readDiagnostics.mockResolvedValue([]);
  await act(async () => {
    renderer = create(tree());
  });
  await advance(100);
  await advance(100);
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  client.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('detects a missed invalidation with real React Query and records recovery after refetch', async () => {
  mocks.read.mockResolvedValue([reply]);
  mocks.readDiagnostics.mockResolvedValue([reply]);
  receive();
  await advance(100);
  await advance(5000);
  expect(outcomes('mismatch')[0][1]).toMatchObject({
    sustainedStages: ['query'],
    missingDatabaseCount: 0,
    missingQueryIds: ['reply'],
  });
  // Diagnostic reads must leave the infinite-stale-time cache untouched.
  expect(mocks.read).toHaveBeenCalledTimes(1);
  await act(async () => {
    await client.invalidateQueries({ queryKey: [['thread', 'root', '~zod']] });
  });
  await advance(100);
  await advance(100);
  expect(outcomes('recovered')).toHaveLength(1);
  expect(mocks.sync).toHaveBeenCalledTimes(1);
});

test('foreground and route focus start fresh checks without adding server fetches', async () => {
  receive();
  await advance(100);
  foreground = false;
  await act(async () => {
    renderer.update(tree());
  });
  await advance(6000);
  expect(outcomes('mismatch')).toHaveLength(0);
  mocks.readDiagnostics.mockResolvedValue([reply]);
  foreground = true;
  await act(async () => {
    renderer.update(tree());
  });
  await advance(100);
  await advance(5000);
  expect(outcomes('mismatch')[0][1]).toMatchObject({
    trigger: 'foreground',
    sustainedStages: ['query'],
    source: 'local_only',
  });
  await act(async () => {
    renderer.update(tree(false));
  });
  await act(async () => {
    renderer.update(tree(true));
  });
  await advance(100);
  await advance(5000);
  expect(outcomes('mismatch').at(-1)?.[1]).toMatchObject({ trigger: 'focus' });
  expect(mocks.sync).toHaveBeenCalledTimes(1);
});
