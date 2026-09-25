import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { AnalyticsEvent } from '../../domain';
import { CursorNormalizationError } from './cursorError';
import { useChannelPosts } from './useChannelPosts';

const mocks = vi.hoisted(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  return {
    read: vi.fn(),
    sync: vi.fn(),
    posts: vi.fn(),
    error: vi.fn(),
    event: vi.fn(),
    empty: [],
  };
});
vi.mock('../../debug', () => ({
  addCustomEnabledLoggers: vi.fn(),
  createDevLogger: () => ({
    log: vi.fn(),
    trackError: mocks.error,
    trackEvent: mocks.event,
  }),
}));
vi.mock('../../db', () => ({
  getPost: mocks.read,
  getSequencedChannelPosts: mocks.posts,
  getLatestChannelSequenceNum: async () => 10,
}));
vi.mock('../sync', () => ({
  syncPosts: mocks.sync,
  syncUpdatedPosts: vi.fn(),
}));
vi.mock('../dbHooks', () => ({ usePendingPostsInChannel: () => mocks.empty }));
vi.mock('../session', () => ({ useCurrentSession: () => null }));
vi.mock('../useDetectSequenceRegression', () => ({
  useDetectSequenceRegression: vi.fn(),
}));
vi.mock('./subscriptions', () => ({
  useNewPostListener: vi.fn(),
  useDeletedPosts: () => mocks.empty,
}));
vi.mock('./queries', () => ({
  getLatestChannelPostsInitialPage: () => undefined,
  getOlderPageParam: () => undefined,
  queryKeyPrefix: ['channelPosts'],
}));
vi.mock('../../logic/utilHooks', async () => {
  const { useRef } = await import('react');
  return {
    useLiveRef: useRef,
    useOptimizedQueryResults: (value: unknown) => value,
  };
});

let client: QueryClient;
let renderer: ReactTestRenderer;
let result: ReturnType<typeof useChannelPosts>;
function Harness({ cursor = 'anchor' }: { cursor?: string | null }) {
  const queryResult = useChannelPosts({
    enabled: true,
    channelId: 'chat/~zod/test',
    count: 30,
    mode: cursor ? 'around' : 'newest',
    cursorPostId: cursor,
  });
  React.useEffect(() => {
    result = queryResult;
  }, [queryResult]);
  return null;
}
function tree(cursor?: string | null) {
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(Harness, { cursor })
  );
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(null);
  mocks.sync.mockResolvedValue({ posts: [], deletedPosts: [] });
  mocks.posts.mockResolvedValue([
    {
      id: 'newest',
      channelId: 'chat/~zod/test',
      sequenceNum: 10,
      type: 'chat',
      receivedAt: 10,
    },
  ]);
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  client.clear();
  vi.useRealTimers();
});

test('reports one exhausted missing-anchor load, then can load newest successfully', async () => {
  await act(async () => {
    renderer = create(tree());
  });
  await advance(2500);
  expect(result.query.isError).toBe(true);
  expect(result.query.error).toBeInstanceOf(CursorNormalizationError);
  expect(result.isLoading).toBe(false);
  expect(mocks.sync).toHaveBeenCalledTimes(5);
  expect(mocks.error).toHaveBeenCalledOnce();
  expect(mocks.error.mock.calls[0][1]).toMatchObject({
    cursorPostId: 'anchor',
    retryCount: 4,
    fetchedPostCount: 0,
  });
  expect(mocks.event).not.toHaveBeenCalledWith(
    AnalyticsEvent.ChannelLoadComplete,
    expect.anything()
  );

  await act(async () => {
    renderer.update(tree(null));
  });
  await advance(1);
  expect(result.query.isSuccess).toBe(true);
  expect(result.posts?.map((p) => p.id)).toEqual(['newest']);
  expect(mocks.event).toHaveBeenCalledWith(
    AnalyticsEvent.ChannelLoadComplete,
    expect.anything()
  );

  // Revisiting the same anchor uses the cached failed query. It must retry
  // rather than remain stuck on that error or inherit the newest-page result.
  await act(async () => {
    renderer.update(tree('anchor'));
  });
  await advance(2500);
  expect(result.query.error).toBeInstanceOf(CursorNormalizationError);
  expect(mocks.error).toHaveBeenCalledTimes(2);
  expect(mocks.sync).toHaveBeenCalledTimes(10);
});

test('a temporarily unavailable anchor can recover during retries without a terminal report', async () => {
  let reads = 0;
  mocks.read.mockImplementation(async () =>
    ++reads <= 2 ? null : { id: 'anchor', sequenceNum: 7 }
  );
  await act(async () => {
    renderer = create(tree());
  });
  await advance(600);
  expect(result.query.isSuccess).toBe(true);
  expect(mocks.error).not.toHaveBeenCalled();
  expect(mocks.posts).toHaveBeenCalledWith(
    expect.objectContaining({
      cursorPostId: null,
      cursorSequenceNum: 7,
      mode: 'around',
    })
  );
});

test.each(['network', 'database'])(
  'exhausted %s failures retain the original error',
  async (stage) => {
    const error = new Error(stage);
    if (stage === 'network') mocks.sync.mockRejectedValue(error);
    else mocks.read.mockRejectedValue(error);
    await act(async () => {
      renderer = create(tree());
    });
    await advance(2500);
    expect(result.query.isError).toBe(true);
    expect(result.query.error).toBe(error);
    expect(result.isLoading).toBe(false);
    expect(mocks.posts).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('failed to load posts', error);
    expect(mocks.event).not.toHaveBeenCalledWith(
      AnalyticsEvent.ChannelLoadComplete,
      expect.anything()
    );
  }
);
