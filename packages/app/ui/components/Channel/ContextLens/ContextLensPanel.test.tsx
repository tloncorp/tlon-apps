import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ContextLensPanel } from './ContextLensPanel';
import type { ContextLens } from './types';

const mocks = vi.hoisted(() => ({
  copyRaw: vi.fn((_props: { payload: unknown }) => null),
  rows: [] as Array<{
    botShip: string;
    lensId: string;
    complete: boolean;
    receivedAt: number;
    payload: unknown;
  }>,
}));

vi.mock('@tloncorp/shared/logic', () => ({
  lensRunMatchesChannel: () => true,
}));

vi.mock('@tloncorp/shared/store', () => ({
  useRecentContextLensRuns: () => ({ data: mocks.rows }),
  retryLensRun: vi.fn(),
}));

vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Pressable: 'Pressable',
}));

vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  SizableText: 'SizableText',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
}));

vi.mock('./CopyRawPayloadButton', () => ({
  CopyRawPayloadButton: mocks.copyRaw,
}));

vi.mock('./RecentRunList', () => ({ RecentRunList: () => null }));
vi.mock('./RunInspector', () => ({ RunInspector: () => null }));
vi.mock('./RunSummary', () => ({ RunSummary: () => null }));
vi.mock('./RunTimeline', () => ({
  RunTimeline: () => null,
  buildRunTimeline: () => [],
}));
vi.mock('./useContextLensStore', () => ({
  liveEventMatchesChannel: () => true,
  useContextLensGatewayConfig: () => null,
}));

function lens(): ContextLens {
  return {
    lensId: 'lens-1',
    messageId: 'message-1',
    chatType: 'dm',
    trigger: 'dm',
    model: null,
    provider: null,
    status: 'completed',
    error: null,
    createdAt: 1,
    updatedAt: 2,
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
  };
}

describe('ContextLensPanel raw payload', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.copyRaw.mockClear();
    mocks.rows = [];
  });

  it('passes the selected Steward envelope unchanged to Copy raw', async () => {
    const payload = {
      schemaVersion: 1,
      lens: lens(),
      unknownExtension: { retained: 'exactly' },
    };
    mocks.rows = [
      {
        botShip: '~bus',
        lensId: 'lens-1',
        complete: true,
        receivedAt: 3,
        payload,
      },
    ];

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ContextLensPanel
          events={[]}
          rawEvents={[]}
          streamStatus="disabled"
          selectedMessage={{
            id: 'message-1',
            lensId: 'lens-1',
            botShip: '~bus',
          }}
        />
      );
    });

    expect(mocks.copyRaw).toHaveBeenCalled();
    expect(mocks.copyRaw.mock.calls.at(-1)?.[0].payload).toBe(payload);

    act(() => renderer!.unmount());
  });
});
