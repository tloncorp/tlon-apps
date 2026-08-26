import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ContextLensEvent } from '../Channel/ContextLens/types';
import { agentChatRunOutcome } from './runOutcome';
import {
  FINISHING_RECEIPT_GRACE_MS,
  finishingReceiptExpiresAt,
  useAgentChatReceiptOutcome,
} from './useAgentChatReceiptOutcome';

function event({
  at = 1_000,
  outputAt,
  status = 'tool_running',
  planStatus = 'running',
}: {
  at?: number;
  outputAt?: number;
  status?: ContextLensEvent['lens']['status'];
  planStatus?: 'running' | 'pending' | 'completed';
} = {}): ContextLensEvent {
  return {
    seq: 1,
    at,
    phase: status === 'completed' ? 'completed' : 'final-reply-delivered',
    lens: {
      lensId: 'run-1',
      messageId: 'request-1',
      chatType: 'dm',
      trigger: 'message',
      model: null,
      provider: null,
      status,
      error: null,
      createdAt: 1,
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
      ...(outputAt === undefined
        ? {}
        : {
            outputs: [
              {
                messageId: 'reply-1',
                conversationId: '~zod',
                kind: 'dm' as const,
                sentAt: outputAt,
              },
            ],
          }),
      lifecycle: {
        queuedMs: 0,
        durationMs: null,
        timeoutMs: null,
        timedOut: false,
        deliveredMessageCount: 1,
        queuedFinal: true,
        queuedFinalCount: 1,
        queuedBlockCount: 0,
      },
      activity: {
        schemaVersion: 1,
        eventCount: 1,
        lastEventAt: at,
        truncated: false,
        plan: {
          updatedAt: at,
          steps: [{ id: 'work', title: 'Do the work', status: planStatus }],
        },
        items: [],
      },
    },
  };
}

function Probe({ value }: { value: ContextLensEvent }) {
  const outcome = useAgentChatReceiptOutcome(value, agentChatRunOutcome(value));
  return <>{outcome}</>;
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

describe('agent chat receipt outcome clock', () => {
  it('prefers the final output timestamp and falls back to the event time', () => {
    expect(finishingReceiptExpiresAt(event({ at: 500, outputAt: 1_000 }))).toBe(
      1_000 + FINISHING_RECEIPT_GRACE_MS
    );
    expect(finishingReceiptExpiresAt(event({ at: 500 }))).toBe(
      500 + FINISHING_RECEIPT_GRACE_MS
    );
  });

  it('degrades a synthetic finishing receipt after five minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<Probe value={event({ outputAt: 1_000 })} />);
    });
    expect(renderer!.toJSON()).toBe('finishing');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FINISHING_RECEIPT_GRACE_MS + 1);
    });
    expect(renderer!.toJSON()).toBe('unavailable');

    await act(async () => renderer!.unmount());
  });

  it('cancels the fallback when an authoritative terminal event arrives', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<Probe value={event({ outputAt: 1_000 })} />);
    });
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      renderer!.update(
        <Probe
          value={event({
            at: 2_000,
            outputAt: 1_000,
            status: 'completed',
            planStatus: 'completed',
          })}
        />
      );
    });
    expect(renderer!.toJSON()).toBe('completed');
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => renderer!.unmount());
  });

  it('cancels the fallback timer on unmount', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(<Probe value={event({ outputAt: 1_000 })} />);
    });
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => renderer!.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not time-bound a genuine terminal incomplete result', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(
        <Probe value={event({ status: 'completed', planStatus: 'pending' })} />
      );
    });
    expect(renderer!.toJSON()).toBe('incomplete');
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => renderer!.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });
});
