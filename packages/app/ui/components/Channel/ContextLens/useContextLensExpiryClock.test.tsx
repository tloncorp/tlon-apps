import { act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ContextLensEvent } from './types';
import {
  nextContextLensExpiry,
  useContextLensExpiryClock,
} from './useContextLensExpiryClock';

function event(
  lensId: string,
  expiresAt: number,
  status: ContextLensEvent['lens']['status'] = 'tool_running'
): ContextLensEvent {
  return {
    seq: 1,
    at: 1,
    phase: 'update',
    lens: {
      lensId,
      messageId: 'message-1',
      chatType: 'dm',
      trigger: 'message',
      model: null,
      provider: null,
      status,
      error: null,
      createdAt: 1,
      updatedAt: 1,
      expiresAt,
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
        durationMs: null,
        timeoutMs: null,
        timedOut: false,
        deliveredMessageCount: 0,
        queuedFinal: false,
        queuedFinalCount: 0,
        queuedBlockCount: 0,
      },
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe('Context Lens expiry clock', () => {
  it('selects the nearest active expiry and ignores terminal runs', () => {
    expect(
      nextContextLensExpiry(
        [
          event('later', 3_000),
          event('done', 1_500, 'completed'),
          event('next', 2_000),
        ],
        1_000
      )
    ).toBe(2_000);
  });

  it('rerenders when an otherwise idle run crosses its expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const observed: number[] = [];

    function Probe() {
      observed.push(useContextLensExpiryClock([event('run', 2_000)]));
      return null;
    }

    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(observed.at(-1)).toBe(1_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_001);
    });
    expect(observed.at(-1)).toBe(2_001);

    await act(async () => renderer.unmount());
  });
});
