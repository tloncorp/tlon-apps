import { describe, expect, it } from 'vitest';

import { isContextLensCardEligible } from './context-lens-card-eligibility.js';
import type { ContextLens } from './context-lens.js';

function lens(overrides: Partial<ContextLens> = {}): ContextLens {
  return {
    lensId: 'lens-1',
    botShip: '~zod',
    runId: 'run-1',
    messageId: 'message-1',
    sessionKeyHash: null,
    chatType: 'dm',
    runKind: 'conversation',
    visibility: 'owner',
    trigger: 'dm',
    triggerDetails: {
      type: 'dm',
      messageId: 'message-1',
      conversationKind: 'dm',
    },
    model: null,
    provider: null,
    context: {
      currentMessage: true,
      threadMessages: 0,
      channelMessages: 0,
      citedPosts: 0,
      attachments: 0,
      pendingNudge: false,
      sources: [],
    },
    persistence: {
      postsReply: false,
      updatesSettings: false,
      writesMedia: false,
      emitsTelemetry: false,
      cachesHistory: false,
      events: [],
    },
    tools: {
      ownerOnlyAvailable: [],
      called: [],
      callCount: 0,
      lastStartedAt: null,
      runs: [],
    },
    outputs: [],
    activity: {
      schemaVersion: 1,
      eventCount: 0,
      lastEventAt: null,
      truncated: false,
      plan: null,
      items: [],
    },
    lifecycle: {
      queuedAt: null,
      queuedMs: 0,
      dispatchStartedAt: null,
      firstToolStartedAt: null,
      completedAt: null,
      durationMs: null,
      timeoutMs: null,
      timedOut: false,
      deliveredMessageCount: 0,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
    },
    status: 'dispatching',
    error: null,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 10,
    ...overrides,
  };
}

describe('isContextLensCardEligible', () => {
  it('keeps a lifecycle-only conversational turn out of task cards', () => {
    expect(isContextLensCardEligible(lens())).toBe(false);
    expect(
      isContextLensCardEligible(
        lens({
          status: 'completed',
          lifecycle: { ...lens().lifecycle, durationMs: 4_000 },
        })
      )
    ).toBe(false);
  });

  it('does not qualify a plan and update_plan accounting alone', () => {
    const planned = lens();
    planned.activity.plan = {
      updatedAt: 2,
      steps: [{ id: 'step-1', title: 'Do the work', status: 'running' }],
    };
    planned.tools = {
      ...planned.tools,
      called: ['update_plan'],
      callCount: 3,
      runs: [
        {
          id: 'plan-call-1',
          callIndex: 1,
          name: 'update_plan',
          startedAt: 1,
          completedAt: 2,
          durationMs: 1,
          status: 'completed',
        },
      ],
    };
    expect(isContextLensCardEligible(planned)).toBe(false);

    planned.activity.items = [
      {
        id: 'commentary-with-plan',
        kind: 'commentary',
        title: 'Checking now.',
        status: 'running',
        startedAt: 2,
        updatedAt: 2,
        completedAt: null,
      },
    ];
    expect(isContextLensCardEligible(planned)).toBe(true);
  });

  it('qualifies a typed requester-input continuation without prose heuristics', () => {
    expect(
      isContextLensCardEligible(
        lens({
          continuation: {
            kind: 'request_input',
            parentLensId: 'parent-lens',
            requestInputId: 'request-input:call-1',
            workflowId: 'parent-lens',
            linkedAt: 2,
          },
        })
      )
    ).toBe(true);
  });

  it('qualifies user-facing commentary and real recorded tool calls', () => {
    const commentary = lens();
    commentary.activity.items = [
      {
        id: 'commentary-1',
        kind: 'commentary',
        title: 'Progress',
        status: 'running',
        startedAt: 1,
        updatedAt: 2,
        completedAt: null,
      },
    ];
    expect(isContextLensCardEligible(commentary)).toBe(true);

    expect(
      isContextLensCardEligible(
        lens({
          tools: {
            ...lens().tools,
            called: ['web_search'],
            callCount: 1,
          },
        })
      )
    ).toBe(true);
  });

  it('qualifies unsuccessful terminal runs but not generic reasoning items', () => {
    const generic = lens();
    generic.activity.items = [
      {
        id: 'reasoning-1',
        kind: 'item',
        title: 'Reasoning',
        status: 'completed',
        startedAt: 1,
        updatedAt: 2,
        completedAt: 2,
      },
    ];
    expect(isContextLensCardEligible(generic)).toBe(false);

    for (const status of [
      'no_reply',
      'timed_out',
      'aborted',
      'error',
    ] as const) {
      expect(isContextLensCardEligible(lens({ status }))).toBe(true);
    }
  });
});
