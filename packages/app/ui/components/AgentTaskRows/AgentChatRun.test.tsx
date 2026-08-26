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
  it('unfurls tool-only completed work into a non-task action summary', async () => {
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
      {
        id: 'fetch-2',
        callIndex: 2,
        name: 'web_fetch',
        status: 'completed',
        startedAt: 1_300,
        completedAt: 1_400,
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
      'aria-label': 'bearclawd · Completed · 2 actions · 2:45. View activity',
    });
    expect(disclosure.props.role).toBe('button');
    expect(disclosure.props.tabIndex).toBe(0);
    expect(disclosure.props['aria-expanded']).toBe(false);
    expect(disclosure.props['aria-label']).not.toContain('task');

    const preventDefault = vi.fn();
    await act(async () =>
      disclosure.props.onKeyDown({ key: 'Enter', preventDefault })
    );
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(disclosure.props['aria-expanded']).toBe(true);
    expect(disclosure.props['aria-label']).toBe(
      'bearclawd · Completed · 2 actions · 2:45. Hide activity'
    );
    expect(disclosure.props['aria-label']).not.toContain('task');

    const actionSummary = renderer!.root.findByProps({
      testID: 'agent-chat-actions-summary',
    });
    expect(
      actionSummary.findAll(
        (node) => node.props.children === 'Actions performed'
      )
    ).not.toHaveLength(0);
    expect(
      actionSummary.findAll(
        (node) => node.props.children === '2 web fetch actions completed'
      )
    ).not.toHaveLength(0);
    expect(
      actionSummary.findAll((node) => node.props.children === 'Task 1')
    ).toHaveLength(0);
    expect(
      actionSummary.findAll((node) => node.props.type === 'Checkmark')
    ).toHaveLength(0);
    expect(
      renderer!.root.findAllByProps({ testID: 'agent-chat-completed-tasks' })
    ).toHaveLength(0);
    expect(JSON.stringify(renderer!.toJSON())).toContain('Hide');

    act(() => renderer!.unmount());
  });

  it('preserves structured plan rows as tasks', async () => {
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
    event.lens.activity = {
      schemaVersion: 1,
      eventCount: 1,
      lastEventAt: 1_200,
      truncated: false,
      plan: {
        updatedAt: 1_100,
        steps: [
          {
            id: 'research',
            title: 'Research sources',
            status: 'completed',
          },
        ],
      },
      items: [
        {
          id: 'fetch-1',
          kind: 'tool',
          title: 'web_fetch',
          name: 'web_fetch',
          planStepId: 'research',
          status: 'completed',
          startedAt: 1_100,
          updatedAt: 1_200,
          completedAt: 1_200,
        },
      ],
    };
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AgentChatActivityReceipt event={event} events={[event]} />
      );
    });

    const disclosure = renderer!.root.findByProps({
      'aria-label': 'bearclawd · Completed · 1 task · 2:45. View activity',
    });
    await act(async () => disclosure.props.onPress());

    const taskRows = renderer!.root.findByProps({
      testID: 'agent-chat-completed-tasks',
    });
    expect(taskRows.props.rows).toMatchObject([
      { id: 'research', title: 'Research sources', status: 'completed' },
    ]);
    expect(
      renderer!.root.findAllByProps({ testID: 'agent-chat-actions-summary' })
    ).toHaveLength(0);

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

  it('keeps a started continuation when its request rejects late', async () => {
    const event = completedEvent([]);
    event.lens.status = 'error';
    event.lens.error = 'The agent could not finish.';
    let rejectContinue!: (error: Error) => void;
    const onContinue = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectContinue = reject;
        })
    );
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AgentChatActivityReceipt
          event={event}
          events={[event]}
          onContinue={onContinue}
        />
      );
    });

    const continueButton = renderer!.root.findByProps({
      'aria-label': 'Continue this agent request',
    });
    act(() => {
      void continueButton.props.onPress();
    });
    expect(onContinue).toHaveBeenCalledOnce();

    await act(async () => {
      renderer!.update(
        <AgentChatActivityReceipt
          event={event}
          events={[event]}
          onContinue={onContinue}
          continuationStarted
        />
      );
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      'Continuation started'
    );

    await act(async () => {
      rejectContinue(new Error('late transport failure'));
      await Promise.resolve();
    });
    const rendered = JSON.stringify(renderer!.toJSON());
    expect(rendered).toContain('Continuation started');
    expect(rendered).not.toContain('Couldn’t reach the agent');

    act(() => renderer!.unmount());
  });
});
