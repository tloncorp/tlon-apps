import type * as db from '@tloncorp/shared/db';
import { createElement } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  contextLensRunKeysForPosts,
  mergeContextLensEventSources,
} from './eventSources';
import type { ContextLensEvent } from './types';
import { useContextLensPostEvents } from './useContextLensStore';

const storeMocks = vi.hoisted(() => ({
  enabled: true,
  ownedBotShips: ['~bus'] as string[],
  isFetched: true,
  runs: [] as Array<{
    botShip: string;
    lensId: string;
    complete: boolean;
    receivedAt: number;
    payload: unknown;
  }>,
  ensureContextLensRun: vi.fn(),
  refreshContextLensRun: vi.fn(),
}));

vi.mock('@tloncorp/shared/db', () => ({
  contextLensGatewayToken: { useValue: vi.fn() },
  contextLensGatewayUrl: { useValue: vi.fn() },
}));

vi.mock('@tloncorp/shared/store', () => ({
  ensureContextLensRun: storeMocks.ensureContextLensRun,
  refreshContextLensRun: storeMocks.refreshContextLensRun,
  useContextLensEnabled: () => ({ data: storeMocks.enabled }),
  useContextLensBotShips: () => ({ data: storeMocks.ownedBotShips }),
  useContextLensRunsByKeys: () => ({
    data: storeMocks.runs,
    isFetched: storeMocks.isFetched,
  }),
}));

function event(lensId: string, at: number): ContextLensEvent {
  return {
    seq: at,
    at,
    phase: 'completed',
    lens: {
      lensId,
      botShip: '~bus',
      messageId: 'request',
      chatType: 'channel',
      trigger: 'message',
      model: null,
      provider: null,
      status: 'completed',
      error: null,
      createdAt: at,
      updatedAt: at,
      context: {
        currentMessage: true,
        threadMessages: 0,
        channelMessages: 0,
        citedPosts: 0,
        attachments: 0,
        pendingNudge: false,
      },
      persistence: {
        postsReply: false,
        updatesSettings: false,
        writesMedia: false,
        emitsTelemetry: false,
        cachesHistory: false,
      },
      tools: {
        ownerOnlyAvailable: [],
        called: [],
        callCount: 0,
        lastStartedAt: null,
      },
      lifecycle: {
        queuedMs: 0,
        durationMs: 1,
        timeoutMs: null,
        timedOut: false,
        deliveredMessageCount: 1,
        queuedFinal: false,
        queuedFinalCount: 0,
        queuedBlockCount: 0,
      },
    },
  };
}

function stampedPost(
  id: string,
  lensId: string,
  delivery: 'final' | 'intermediate' = 'final'
): db.Post {
  return {
    id,
    authorId: '~bus',
    channelId: 'chat/~bus/channel',
    type: 'chat',
    receivedAt: 1,
    sentAt: 1,
    isDeleted: false,
    replyCount: 0,
    blob: JSON.stringify([
      {
        type: 'tlon-context-lens',
        version: 1,
        lensId,
        botShip: '~bus',
        delivery,
        ...(delivery === 'final' ? { outcome: 'completed' } : {}),
      },
    ]),
  };
}

function runSnapshot(complete: boolean) {
  return {
    botShip: '~bus',
    lensId: 'run-1',
    complete,
    receivedAt: complete ? 2 : 1,
    payload: {},
  };
}

function PostEventsProbe({ posts }: { posts: readonly db.Post[] }) {
  useContextLensPostEvents(posts);
  return null;
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

beforeEach(() => {
  storeMocks.enabled = true;
  storeMocks.ownedBotShips = ['~bus'];
  storeMocks.isFetched = true;
  storeMocks.runs = [];
  storeMocks.ensureContextLensRun.mockReset().mockResolvedValue(null);
  storeMocks.refreshContextLensRun.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Context Lens chat event retention', () => {
  it('keeps a loaded historical run alongside a full live-event window', () => {
    const live = Array.from({ length: 160 }, (_, index) =>
      event(`live-${index}`, index + 1_000)
    );
    const historical = event('historical-loaded-post', 10);

    const merged = mergeContextLensEventSources(live, [historical]);

    expect(merged).toHaveLength(161);
    expect(merged[0]).toBe(historical);
    expect(merged.at(-1)).toBe(live.at(-1));
  });

  it('collects one exact durable lookup per loaded final bot reply', () => {
    const posts = [
      stampedPost('reply-1', 'run-1'),
      stampedPost('reply-1-copy', 'run-1'),
      stampedPost('reply-2', 'run-2'),
      stampedPost('intermediate', 'run-3', 'intermediate'),
    ];

    expect(contextLensRunKeysForPosts(posts)).toEqual([
      { botShip: '~bus', lensId: 'run-1' },
      { botShip: '~bus', lensId: 'run-2' },
    ]);
  });
});

describe('final-post run hydration', () => {
  it('hydrates only after the stamped bot appears in the owned Lens index', async () => {
    storeMocks.ownedBotShips = [];
    const finalPost = stampedPost('reply', 'run-1');

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(PostEventsProbe, { posts: [finalPost] }));
    });
    expect(storeMocks.ensureContextLensRun).not.toHaveBeenCalled();
    expect(storeMocks.refreshContextLensRun).not.toHaveBeenCalled();

    storeMocks.ownedBotShips = ['~bus'];
    await act(async () => {
      renderer!.update(createElement(PostEventsProbe, { posts: [finalPost] }));
    });
    expect(storeMocks.ensureContextLensRun).toHaveBeenCalledTimes(1);

    await act(async () => renderer!.unmount());
  });

  it('force-refreshes an incomplete run until its terminal snapshot arrives', async () => {
    vi.useFakeTimers();
    const partial = runSnapshot(false);
    const complete = runSnapshot(true);
    storeMocks.runs = [partial];
    let refreshCount = 0;
    storeMocks.refreshContextLensRun.mockImplementation(async () => {
      refreshCount += 1;
      return refreshCount >= 7 ? complete : partial;
    });

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        createElement(PostEventsProbe, {
          posts: [stampedPost('reply', 'run-1')],
        })
      );
    });

    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(1);
    expect(storeMocks.ensureContextLensRun).not.toHaveBeenCalled();

    // Advance one scheduled retry at a time so React can commit the revision
    // that schedules the next backoff (a single large jump is batched by act).
    for (const delay of [1_000, 5_000, 15_000, 30_000, 60_000]) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(69_000);
    });
    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(6);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(21_000);
    });
    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(7);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(7);

    await act(async () => renderer!.unmount());
  });

  it('preserves db-first hydration and its shorter backoff for a missing run', async () => {
    vi.useFakeTimers();
    storeMocks.ensureContextLensRun
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(runSnapshot(true));

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        createElement(PostEventsProbe, {
          posts: [stampedPost('reply', 'run-1')],
        })
      );
    });
    expect(storeMocks.ensureContextLensRun).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(storeMocks.ensureContextLensRun).toHaveBeenCalledTimes(2);
    expect(storeMocks.refreshContextLensRun).not.toHaveBeenCalled();

    await act(async () => renderer!.unmount());
  });

  it('cancels a scheduled completion refresh when the post is no longer requested', async () => {
    vi.useFakeTimers();
    storeMocks.runs = [runSnapshot(false)];
    storeMocks.refreshContextLensRun.mockResolvedValue(runSnapshot(false));

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        createElement(PostEventsProbe, {
          posts: [stampedPost('reply', 'run-1')],
        })
      );
    });
    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer!.update(createElement(PostEventsProbe, { posts: [] }));
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(1);

    await act(async () => renderer!.unmount());
  });

  it('does not retry when ship sync completes while a refresh is in flight', async () => {
    vi.useFakeTimers();
    const partial = runSnapshot(false);
    const complete = runSnapshot(true);
    storeMocks.runs = [partial];
    let resolveRefresh: (run: ReturnType<typeof runSnapshot>) => void = () =>
      undefined;
    storeMocks.refreshContextLensRun.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );
    const post = stampedPost('reply', 'run-1');

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(PostEventsProbe, { posts: [post] }));
    });
    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(1);

    storeMocks.runs = [complete];
    await act(async () => {
      renderer!.update(createElement(PostEventsProbe, { posts: [post] }));
    });
    await act(async () => resolveRefresh(partial));
    await vi.advanceTimersByTimeAsync(300_000);

    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(1);
    await act(async () => renderer!.unmount());
  });

  it('cancels a scheduled completion refresh on unmount', async () => {
    vi.useFakeTimers();
    storeMocks.runs = [runSnapshot(false)];
    storeMocks.refreshContextLensRun.mockResolvedValue(runSnapshot(false));

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        createElement(PostEventsProbe, {
          posts: [stampedPost('reply', 'run-1')],
        })
      );
    });
    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(1);

    await act(async () => renderer!.unmount());
    await vi.advanceTimersByTimeAsync(300_000);

    expect(storeMocks.refreshContextLensRun).toHaveBeenCalledTimes(1);
  });
});
