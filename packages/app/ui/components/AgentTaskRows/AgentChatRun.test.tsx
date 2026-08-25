import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ContextLensEvent } from '../Channel/ContextLens/types';
import { AgentChatActivityReceipt } from './AgentChatRun';

vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Pressable: 'Pressable',
}));

vi.mock('tamagui', () => ({
  SizableText: 'SizableText',
  XStack: 'XStack',
  YStack: 'YStack',
}));

vi.mock('../ContactNameV2', () => ({
  useContactName: () => 'bearclawd',
}));

vi.mock('./AgentRunTimer', () => ({
  AgentRunTimer: 'AgentRunTimer',
  formatAgentRunElapsedTime: () => '2:45',
  resolveAgentRunTimerStartedAt: () => 1,
}));

vi.mock('./AgentTaskRows', () => ({
  AgentTaskRows: 'AgentTaskRows',
}));

function completedEvent(
  toolRuns: NonNullable<ContextLensEvent['lens']['tools']['runs']>
): ContextLensEvent {
  return {
    seq: 1,
    at: 2_000,
    phase: 'final',
    lens: {
      lensId: 'run-1',
      botShip: '~sitrul-nacwyl',
      messageId: 'request-1',
      chatType: 'dm',
      trigger: 'message',
      visibility: 'owner',
      model: null,
      provider: null,
      status: 'completed',
      error: null,
      createdAt: 1_000,
      updatedAt: 2_000,
      context: {
        currentMessage: true,
        threadMessages: 0,
        channelMessages: 0,
        citedPosts: 0,
        attachments: 0,
        pendingNudge: false,
      },
      persistence: {
        postsReply: true,
        updatesSettings: false,
        writesMedia: false,
        emitsTelemetry: false,
        cachesHistory: true,
      },
      tools: {
        ownerOnlyAvailable: [],
        called: toolRuns.map((run) => run.name),
        callCount: toolRuns.length,
        lastStartedAt: toolRuns.at(-1)?.startedAt ?? null,
        runs: toolRuns,
      },
      lifecycle: {
        queuedMs: 0,
        durationMs: 165_000,
        timeoutMs: 900_000,
        timedOut: false,
        deliveredMessageCount: 1,
        queuedFinal: true,
        queuedFinalCount: 1,
        queuedBlockCount: 0,
      },
    },
  };
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe('AgentChatActivityReceipt', () => {
  it('unfurls tool-only completed work into a real task row', async () => {
    const event = completedEvent([
      {
        id: 'fetch-1',
        callIndex: 1,
        name: 'web_fetch',
        status: 'completed',
        startedAt: 1_100,
        completedAt: 1_200,
        durationMs: 100,
      },
    ]);
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AgentChatActivityReceipt event={event} events={[event]} />
      );
    });

    const disclosure = renderer!.root.findByProps({
      'aria-label': 'bearclawd · Completed · 1 task · 2:45. View activity',
    });
    expect(disclosure.props.role).toBe('button');

    await act(async () => disclosure.props.onPress());

    const taskRows = renderer!.root.findByProps({
      testID: 'agent-chat-completed-tasks',
    });
    expect(taskRows.props.rows[0]).toMatchObject({
      title: 'Completed agent work',
      subtitle: '1 web fetch action completed',
      status: 'completed',
      details: [{ label: 'Actions', value: '1 web fetch action completed' }],
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain('Hide');

    act(() => renderer!.unmount());
  });

  it('does not advertise an empty receipt as expandable', async () => {
    const event = completedEvent([
      {
        id: 'plan-1',
        callIndex: 1,
        name: 'update_plan',
        status: 'completed',
        startedAt: 1_100,
        completedAt: 1_200,
        durationMs: 100,
      },
    ]);
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AgentChatActivityReceipt event={event} events={[event]} />
      );
    });

    const receipt = renderer!.root.findByProps({
      'aria-label': 'bearclawd · Completed · 2:45',
    });
    expect(receipt.props.disabled).toBe(true);
    expect(receipt.props.cursor).toBe('default');
    expect(receipt.props.role).toBeUndefined();
    expect(receipt.props.onPress).toBeUndefined();
    expect(receipt.props['aria-expanded']).toBeUndefined();
    expect(JSON.stringify(renderer!.toJSON())).not.toContain('View activity');
    expect(JSON.stringify(renderer!.toJSON())).not.toContain('Hide');

    act(() => renderer!.unmount());
  });
});
