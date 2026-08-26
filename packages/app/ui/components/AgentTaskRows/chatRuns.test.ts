import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import type { ContextLensEvent } from '../Channel/ContextLens/types';
import { buildAgentTaskRowsFromActivity } from './activityRows';
import {
  buildAgentChatRunAssignments,
  decoratePostsWithAgentChatRuns,
  filterRenderableAgentChatPosts,
  orderAgentChatRunCards,
} from './chatRuns';
import type { ParticipantContextLensEvent } from './participantActivity';
import { agentChatRunOutcome } from './runOutcome';

function post(id: string, overrides: Partial<db.Post> = {}): db.Post {
  return {
    id,
    authorId: '~zod',
    channelId: 'chat/channel',
    type: 'chat',
    receivedAt: 1,
    sentAt: 1,
    isDeleted: false,
    replyCount: 0,
    ...overrides,
  };
}

function stampedPost(
  id: string,
  delivery: 'final' | 'intermediate',
  lensId = 'run-1',
  outcome: 'completed' | 'failed' = 'completed'
) {
  return post(id, {
    authorId: '~bus',
    blob: JSON.stringify([
      {
        type: 'tlon-context-lens',
        version: 1,
        lensId,
        botShip: '~bus',
        delivery,
        ...(delivery === 'final' ? { outcome } : {}),
      },
    ]),
  });
}

function event({
  at,
  status,
  outputId,
  lensId = 'run-1',
  botShip = '~bus',
  requestId = 'request-1',
}: {
  at: number;
  status: ContextLensEvent['lens']['status'];
  outputId?: string;
  lensId?: string;
  botShip?: string;
  requestId?: string;
}): ContextLensEvent {
  return {
    seq: at,
    at,
    phase: status,
    lens: {
      lensId,
      botShip,
      messageId: requestId,
      chatType: 'channel',
      trigger: 'message',
      triggerDetails: {
        type: 'message',
        messageId: requestId,
        conversationId: 'chat/channel',
        conversationKind: 'channel',
      },
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
      activity: {
        schemaVersion: 1,
        eventCount: 1,
        lastEventAt: at,
        truncated: false,
        plan: {
          updatedAt: at,
          steps: [
            {
              id: 'work',
              title: 'Complete the requested work',
              status: status === 'completed' ? 'completed' : 'running',
            },
          ],
        },
        items: [
          {
            id: 'commentary-default',
            kind: 'commentary',
            title: 'Progress',
            progressText: 'Working through the requested task.',
            status: status === 'completed' ? 'completed' : 'running',
            planStepId: 'work',
            startedAt: at,
            updatedAt: at,
            completedAt: status === 'completed' ? at : null,
          },
        ],
      },
      outputs: outputId
        ? [
            {
              messageId: outputId,
              conversationId: 'chat/channel',
              kind: 'channel',
              sentAt: at,
            },
          ]
        : [],
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

function participantEvent(
  status: ContextLensEvent['lens']['status']
): ParticipantContextLensEvent {
  const participant = event({ at: 2, status });
  participant.lens.visibility = 'participants';
  return {
    ...participant,
    participantActivity: {
      publicRunId: 'public_run_1',
      revision: 1,
      surface: 'carrier',
      carrierPostId: 'carrier-1',
      triggerPostId: 'request-1',
    },
  };
}

function emptyActivity(): NonNullable<ContextLensEvent['lens']['activity']> {
  return {
    schemaVersion: 1,
    eventCount: 0,
    lastEventAt: null,
    truncated: false,
    plan: null,
    items: [],
  };
}

function planOnlyActivity(
  at: number,
  status: 'pending' | 'running' | 'waiting' | 'completed' = 'running'
): NonNullable<ContextLensEvent['lens']['activity']> {
  return {
    ...emptyActivity(),
    eventCount: 1,
    lastEventAt: at,
    plan: {
      updatedAt: at,
      steps: [{ id: 'work', title: 'Complete the request', status }],
    },
  };
}

describe('agent chat run assignments', () => {
  it('does not create cards for successful reply-only banter or questions', () => {
    for (const [index, preview] of [
      'Doing well—how are you?',
      'The report is ready. Would you like a CSV too?',
      'Which one is your favorite?',
    ].entries()) {
      const lensId = `banter-${index}`;
      const replyId = `reply-${index}`;
      const banter = event({
        at: index + 2,
        status: 'completed',
        outputId: replyId,
        lensId,
      });
      banter.lens.activity = planOnlyActivity(index + 2, 'completed');
      banter.lens.outputs![0].preview = preview;

      const assignments = buildAgentChatRunAssignments(
        [banter],
        [post('request-1'), post(replyId, { authorId: '~bus' })],
        'chat/channel'
      );

      expect(assignments.liveByPostId.size).toBe(0);
      expect(assignments.receiptByPostId.size).toBe(0);
    }
  });

  it('projects an existing plan only after commentary or a real tool appears', () => {
    const plan = event({ at: 1, status: 'dispatching' });
    plan.lens.activity = planOnlyActivity(1);
    expect(
      buildAgentChatRunAssignments([plan], [post('request-1')], 'chat/channel')
        .liveByPostId.size
    ).toBe(0);

    const commentary = event({ at: 2, status: 'dispatching' });
    const commentaryAssignments = buildAgentChatRunAssignments(
      [plan, commentary],
      [post('request-1')],
      'chat/channel'
    );
    const [commentaryCard] =
      commentaryAssignments.liveByPostId.get('request-1') ?? [];
    expect(commentaryCard).toBe(commentary);
    expect(
      buildAgentTaskRowsFromActivity(commentaryCard?.lens.activity, [], {
        presentation: 'chat',
      }).rows.map((row) => row.id)
    ).toEqual(['work']);

    const tool = event({ at: 3, status: 'tool_running', lensId: 'tool-plan' });
    tool.lens.activity = planOnlyActivity(3);
    tool.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['web_search'],
      callCount: 1,
      lastStartedAt: 3,
    };
    const toolAssignments = buildAgentChatRunAssignments(
      [tool],
      [post('request-1')],
      'chat/channel'
    );
    const [toolCard] = toolAssignments.liveByPostId.get('request-1') ?? [];
    expect(toolCard).toBe(tool);
    expect(
      buildAgentTaskRowsFromActivity(toolCard?.lens.activity, [], {
        presentation: 'chat',
      }).rows.map((row) => row.id)
    ).toEqual(['work']);
  });

  it('treats update_plan tool records as planning metadata, not actions', () => {
    const planning = event({ at: 1, status: 'tool_running' });
    planning.lens.activity = {
      ...planOnlyActivity(1),
      items: [
        {
          id: 'tool-plan',
          kind: 'tool',
          title: 'update_plan',
          name: 'update_plan',
          status: 'completed',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 1,
          completedAt: 1,
        },
      ],
    };
    planning.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['update_plan'],
      callCount: 1,
      lastStartedAt: 1,
      runs: [
        {
          id: 'tool-plan',
          callIndex: 1,
          name: 'update_plan',
          startedAt: 1,
          completedAt: 1,
          durationMs: 0,
          status: 'completed',
        },
      ],
    };

    const assignments = buildAgentChatRunAssignments(
      [planning],
      [post('request-1')],
      'chat/channel'
    );
    expect(assignments.liveByPostId.size).toBe(0);
    expect(assignments.receiptByPostId.size).toBe(0);
  });

  it('rejects malformed continuation metadata on a plan-only run', () => {
    const malformed = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    malformed.lens.activity = planOnlyActivity(2, 'completed');
    malformed.lens.continuation = {
      kind: 'request_input',
      parentLensId: ' ',
      requestInputId: 'input-1',
      workflowId: 'workflow-1',
      linkedAt: 2,
    };

    const assignments = buildAgentChatRunAssignments(
      [malformed],
      [post('request-1'), post('reply-1', { authorId: '~bus' })],
      'chat/channel'
    );

    expect(assignments.liveByPostId.size).toBe(0);
    expect(assignments.receiptByPostId.size).toBe(0);
  });

  it('keeps a participant-safe continuation visible without private lineage', () => {
    const resumed = participantEvent('completed');
    resumed.participantActivity.surface = 'final';
    resumed.participantActivity.carrierPostId = 'reply-1';
    resumed.participantActivity.continuation = {
      kind: 'request_input',
      parentPublicRunId: 'public_parent_1',
    };
    resumed.lens.activity = planOnlyActivity(2, 'completed');
    resumed.lens.outputs = [
      {
        messageId: 'reply-1',
        conversationId: 'chat/channel',
        kind: 'channel',
        sentAt: 2,
      },
    ];

    const assignments = buildAgentChatRunAssignments(
      [resumed],
      [post('request-1'), post('reply-1', { authorId: '~bus' })],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('reply-1')).toEqual([resumed]);
  });

  it('shows tool-only and commentary-only work without requiring a plan', () => {
    const toolOnly = event({
      at: 2,
      status: 'tool_running',
      lensId: 'tool-only',
    });
    toolOnly.lens.activity = emptyActivity();
    toolOnly.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['web_search'],
      callCount: 1,
      lastStartedAt: 2,
    };
    const commentaryOnly = event({
      at: 3,
      status: 'dispatching',
      lensId: 'commentary-only',
      requestId: 'request-2',
    });
    commentaryOnly.lens.activity = {
      ...emptyActivity(),
      items: [
        {
          id: 'commentary-1',
          kind: 'commentary',
          title: 'Progress',
          progressText: 'Checking the current records.',
          status: 'running',
          startedAt: 3,
          updatedAt: 3,
          completedAt: null,
        },
      ],
    };

    const assignments = buildAgentChatRunAssignments(
      [toolOnly, commentaryOnly],
      [post('request-1'), post('request-2')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.get('request-1')).toEqual([toolOnly]);
    expect(assignments.liveByPostId.get('request-2')).toEqual([commentaryOnly]);
  });

  it('ignores generic provider items but shows a structured input gate', () => {
    const generic = event({ at: 2, status: 'dispatching' });
    generic.lens.activity = {
      ...emptyActivity(),
      items: [
        {
          id: 'provider-item',
          kind: 'item',
          title: 'Provider activity',
          status: 'waiting',
          startedAt: 2,
          updatedAt: 2,
          completedAt: null,
        },
      ],
    };
    expect(
      buildAgentChatRunAssignments(
        [generic],
        [post('request-1')],
        'chat/channel'
      ).liveByPostId.size
    ).toBe(0);

    const gate = event({ at: 3, status: 'completed', outputId: 'reply-1' });
    gate.lens.activity = {
      ...emptyActivity(),
      items: [
        {
          id: 'input-1',
          kind: 'request_input',
          title: 'Choose a group name',
          status: 'waiting',
          startedAt: 3,
          updatedAt: 3,
          completedAt: null,
        },
      ],
    };
    const gateAssignments = buildAgentChatRunAssignments(
      [gate],
      [post('request-1'), post('reply-1', { authorId: '~bus' })],
      'chat/channel'
    );
    const [receipt] = gateAssignments.receiptByPostId.get('reply-1') ?? [];
    expect(receipt).toBeDefined();
    expect(agentChatRunOutcome(receipt!)).toBe('waiting');
  });

  it('keeps terminal failure feedback even when no task evidence exists', () => {
    const timedOut = event({ at: 120_000, status: 'timed_out' });
    timedOut.lens.activity = emptyActivity();

    const assignments = buildAgentChatRunAssignments(
      [timedOut],
      [post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.size).toBe(0);
    expect(assignments.receiptByPostId.get('request-1')).toEqual([timedOut]);
  });

  it('keeps visibility sticky while honoring an explicit empty plan revision', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    const initial = buildAgentChatRunAssignments(
      [planned],
      [post('request-1')],
      'chat/channel'
    );
    expect(initial.liveByPostId.get('request-1')).toEqual([planned]);

    const revised = event({ at: 2, status: 'tool_running' });
    revised.lens.activity = {
      ...emptyActivity(),
      plan: { updatedAt: 2, steps: [] },
    };
    const updated = buildAgentChatRunAssignments(
      [revised],
      [post('request-1')],
      'chat/channel',
      initial
    );
    const [visibleRevision] = updated.liveByPostId.get('request-1') ?? [];

    expect(visibleRevision).toBe(revised);
    expect(visibleRevision?.lens.activity?.plan?.steps).toEqual([]);

    const planOnly = event({ at: 3, status: 'tool_running' });
    planOnly.lens.activity = planOnlyActivity(3);
    const planOnlyUpdate = buildAgentChatRunAssignments(
      [planOnly],
      [post('request-1')],
      'chat/channel',
      updated
    );
    const [visiblePlanOnly] =
      planOnlyUpdate.liveByPostId.get('request-1') ?? [];
    expect(visiblePlanOnly).toBe(planOnly);
    expect(visiblePlanOnly?.lens.activity?.plan?.steps).toEqual(
      planOnly.lens.activity.plan?.steps
    );
  });

  it('preserves live task identity when terminal activity is missing or structurally empty', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    planned.lens.activity = {
      ...planned.lens.activity!,
      plan: {
        updatedAt: 1,
        steps: [
          {
            id: 'research',
            title: 'Research the options',
            status: 'completed',
          },
          { id: 'compare', title: 'Compare the evidence', status: 'running' },
          {
            id: 'report',
            title: 'Report the recommendation',
            status: 'pending',
          },
        ],
      },
    };
    const liveRows = buildAgentTaskRowsFromActivity(planned.lens.activity, [], {
      presentation: 'chat',
    }).rows.map(({ id, title }) => ({ id, title }));

    for (const terminalActivity of [
      undefined,
      null,
      emptyActivity(),
      { ...emptyActivity(), plan: { updatedAt: 2, steps: [] } },
    ]) {
      const delivered = event({
        at: 2,
        status: 'completed',
        outputId: 'reply-1',
      });
      delivered.lens.activity = terminalActivity as never;
      delivered.lens.lifecycle.durationMs = 1_234;
      delivered.lens.tools = {
        ownerOnlyAvailable: [],
        called: ['web_search'],
        callCount: 1,
        lastStartedAt: 2,
      };

      const assignments = buildAgentChatRunAssignments(
        [planned, delivered],
        [post('request-1'), post('reply-1', { authorId: '~bus' })],
        'chat/channel'
      );
      const [receipt] = assignments.receiptByPostId.get('reply-1') ?? [];
      const receiptRows = buildAgentTaskRowsFromActivity(
        receipt?.lens.activity,
        [],
        { presentation: 'chat' }
      ).rows.map(({ id, title }) => ({ id, title }));

      expect(receiptRows).toEqual(liveRows);
      expect(receipt?.lens.activity?.plan?.steps).toEqual(
        planned.lens.activity?.plan?.steps
      );
      expect(receipt?.lens.lifecycle).toBe(delivered.lens.lifecycle);
      expect(receipt?.lens.tools).toBe(delivered.lens.tools);
    }
  });

  it('recovers terminal activity from previous assignments after stream compaction', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    const initial = buildAgentChatRunAssignments(
      [planned],
      [post('request-1')],
      'chat/channel'
    );
    const delivered = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    delivered.lens.activity = undefined;
    delivered.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['web_search'],
      callCount: 1,
      lastStartedAt: 2,
    };

    const assignments = buildAgentChatRunAssignments(
      [delivered],
      [post('request-1'), post('reply-1', { authorId: '~bus' })],
      'chat/channel',
      initial
    );
    const [receipt] = assignments.receiptByPostId.get('reply-1') ?? [];

    expect(receipt?.lens.activity).toBe(planned.lens.activity);
    expect(receipt?.lens.tools).toBe(delivered.lens.tools);
  });

  it('keeps live task identity and newer statuses when a terminal plan omits items', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    const delivered = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    delivered.lens.activity = planOnlyActivity(2, 'completed');
    delivered.lens.activity.plan!.steps.push({
      id: 'terminal-only',
      title: 'Invented after completion',
      status: 'completed',
    });
    delivered.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['web_search'],
      callCount: 1,
      lastStartedAt: 2,
    };

    const assignments = buildAgentChatRunAssignments(
      [planned, delivered],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel'
    );
    const [receipt] = assignments.receiptByPostId.get('reply-1') ?? [];

    expect(receipt).not.toBe(delivered);
    expect(receipt?.lens.activity?.plan?.steps[0]).toEqual({
      id: 'work',
      title: 'Complete the requested work',
      status: 'completed',
    });
    expect(receipt?.lens.activity?.plan?.steps[0]?.status).toBe('completed');
    expect(receipt?.lens.activity?.plan?.steps).toHaveLength(1);
    expect(receipt?.lens.activity?.items).toEqual(planned.lens.activity?.items);
  });

  it('never adopts terminal-only task identity on a cold multi-terminal history', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    planned.lens.activity = {
      ...planned.lens.activity!,
      plan: {
        updatedAt: 1,
        steps: [
          {
            id: 'work',
            title: 'Live task A',
            status: 'running',
          },
        ],
      },
    };
    const firstTerminal = event({ at: 2, status: 'completed' });
    firstTerminal.lens.activity = {
      ...emptyActivity(),
      plan: {
        updatedAt: 2,
        steps: [
          {
            id: 'work',
            title: 'Terminal task A',
            status: 'completed',
          },
          {
            id: 'terminal-only',
            title: 'Terminal-only task B',
            status: 'completed',
          },
        ],
      },
    };
    const finalTerminal = event({
      at: 3,
      status: 'completed',
      outputId: 'reply-1',
    });
    finalTerminal.lens.activity = emptyActivity();

    const assignments = buildAgentChatRunAssignments(
      [planned, firstTerminal, finalTerminal],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel'
    );
    const receipt = assignments.receiptByPostId.get('reply-1')?.[0];

    expect(receipt?.lens.activity?.plan?.steps).toEqual([
      {
        id: 'work',
        title: 'Live task A',
        status: 'completed',
      },
    ]);
  });

  it('merges prior terminal items by id or tool call without replacing newer items', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    planned.lens.activity = {
      ...planned.lens.activity!,
      items: [
        {
          id: 'commentary-1',
          kind: 'commentary',
          title: 'Researching',
          progressText: 'Checking sources.',
          status: 'completed',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 1,
          completedAt: 1,
        },
        {
          id: 'tool-old-id',
          toolCallId: 'call-1',
          kind: 'tool',
          title: 'Search',
          name: 'web_search',
          status: 'running',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 1,
          completedAt: null,
        },
      ],
    };
    const delivered = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    delivered.lens.activity = {
      ...planOnlyActivity(2, 'completed'),
      items: [
        {
          id: 'tool-new-id',
          toolCallId: 'call-1',
          kind: 'tool',
          title: 'Search complete',
          name: 'web_search',
          status: 'completed',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 2,
          completedAt: 2,
        },
        {
          id: 'patch-1',
          kind: 'patch',
          title: 'Apply fix',
          status: 'completed',
          planStepId: 'work',
          startedAt: 2,
          updatedAt: 2,
          completedAt: 2,
        },
      ],
    };

    const assignments = buildAgentChatRunAssignments(
      [planned, delivered],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel'
    );
    const receipt = assignments.receiptByPostId.get('reply-1')?.[0];

    expect(receipt?.lens.activity?.items.map((item) => item.id)).toEqual([
      'commentary-1',
      'tool-new-id',
      'patch-1',
    ]);
    expect(receipt?.lens.activity?.items[1]).toBe(
      delivered.lens.activity.items[0]
    );
  });

  it('keeps distinct activity kinds that share one tool call id', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    planned.lens.activity = {
      ...planned.lens.activity!,
      items: [
        {
          id: 'tool-1',
          toolCallId: 'call-1',
          kind: 'tool',
          title: 'Run command',
          status: 'running',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 1,
          completedAt: null,
        },
        {
          id: 'patch-1',
          toolCallId: 'call-1',
          kind: 'patch',
          title: 'Apply patch',
          status: 'running',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 1,
          completedAt: null,
        },
      ],
    };
    const delivered = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    delivered.lens.activity = {
      ...planOnlyActivity(2, 'completed'),
      items: [
        {
          ...planned.lens.activity.items[0],
          status: 'completed',
          updatedAt: 2,
          completedAt: 2,
        },
        {
          ...planned.lens.activity.items[1],
          status: 'completed',
          updatedAt: 2,
          completedAt: 2,
        },
      ],
    };

    const assignments = buildAgentChatRunAssignments(
      [planned, delivered],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel'
    );
    const receipt = assignments.receiptByPostId.get('reply-1')?.[0];

    expect(receipt?.lens.activity?.items.map((item) => item.kind)).toEqual([
      'tool',
      'patch',
    ]);
    expect(receipt?.lens.activity?.items.map((item) => item.id)).toEqual([
      'tool-1',
      'patch-1',
    ]);
  });

  it('merges truncated activity snapshots across the full terminal history', () => {
    const first = event({ at: 1, status: 'tool_running' });
    first.lens.activity = {
      ...first.lens.activity!,
      items: [
        {
          id: 'commentary-1',
          kind: 'commentary',
          title: 'Researching',
          progressText: 'Checking the first source.',
          status: 'completed',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 1,
          completedAt: 1,
        },
      ],
    };
    const second = event({ at: 2, status: 'tool_running' });
    second.lens.activity = {
      ...second.lens.activity!,
      items: [
        {
          id: 'tool-1',
          kind: 'tool',
          title: 'Search',
          name: 'web_search',
          status: 'completed',
          planStepId: 'work',
          startedAt: 2,
          updatedAt: 2,
          completedAt: 2,
        },
      ],
    };
    const delivered = event({
      at: 3,
      status: 'completed',
      outputId: 'reply-1',
    });
    delivered.lens.activity = emptyActivity();

    const assignments = buildAgentChatRunAssignments(
      [first, second, delivered],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel'
    );
    const receipt = assignments.receiptByPostId.get('reply-1')?.[0];

    expect(receipt?.lens.activity?.items.map((item) => item.id)).toEqual([
      'commentary-1',
      'tool-1',
    ]);
  });

  it('does not regress fresher embedded plan and item state', () => {
    const fresh = event({ at: 1, status: 'tool_running' });
    fresh.lens.activity = {
      ...fresh.lens.activity!,
      plan: {
        updatedAt: 10,
        steps: [
          {
            id: 'work',
            title: 'Complete the requested work',
            status: 'completed',
          },
        ],
      },
      items: [
        {
          id: 'tool-1',
          kind: 'tool',
          title: 'Search complete',
          name: 'web_search',
          status: 'completed',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 10,
          completedAt: 10,
        },
      ],
    };
    const staleTerminal = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    staleTerminal.lens.activity = {
      ...staleTerminal.lens.activity!,
      plan: {
        updatedAt: 5,
        steps: [
          {
            id: 'work',
            title: 'Stale task title',
            status: 'running',
          },
        ],
      },
      items: [
        {
          id: 'tool-1',
          kind: 'tool',
          title: 'Stale search state',
          name: 'web_search',
          status: 'running',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 5,
          completedAt: null,
        },
      ],
    };

    const assignments = buildAgentChatRunAssignments(
      [fresh, staleTerminal],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel'
    );
    const receipt = assignments.receiptByPostId.get('reply-1')?.[0];

    expect(receipt?.lens.activity?.plan).toBe(fresh.lens.activity?.plan);
    expect(receipt?.lens.activity?.items).toEqual(fresh.lens.activity?.items);
  });

  it('keeps an observed live empty-plan revision as a terminal tombstone', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    const cleared = event({ at: 2, status: 'tool_running' });
    cleared.lens.activity = {
      ...emptyActivity(),
      plan: { updatedAt: 2, steps: [] },
    };
    const delivered = event({
      at: 3,
      status: 'completed',
      outputId: 'reply-1',
    });
    delivered.lens.activity = emptyActivity();

    const assignments = buildAgentChatRunAssignments(
      [planned, cleared, delivered],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel'
    );
    const receipt = assignments.receiptByPostId.get('reply-1')?.[0];
    const model = buildAgentTaskRowsFromActivity(receipt?.lens.activity, [], {
      presentation: 'chat',
      runOutcome: 'completed',
    });

    expect(receipt?.lens.activity?.plan?.steps).toEqual([]);
    expect(model.rows).toEqual([]);
  });

  it('keeps recovered terminal activity across repeated assignment builds', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    const first = buildAgentChatRunAssignments(
      [planned],
      [post('request-1')],
      'chat/channel'
    );
    const delivered = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    delivered.lens.activity = emptyActivity();
    const posts = [post('request-1'), stampedPost('reply-1', 'final')];

    const second = buildAgentChatRunAssignments(
      [delivered],
      posts,
      'chat/channel',
      first
    );
    const third = buildAgentChatRunAssignments(
      [delivered],
      posts,
      'chat/channel',
      second
    );
    const secondReceipt = second.receiptByPostId.get('reply-1')?.[0];
    const thirdReceipt = third.receiptByPostId.get('reply-1')?.[0];

    expect(secondReceipt?.lens.activity?.plan?.steps).toEqual(
      planned.lens.activity?.plan?.steps
    );
    expect(thirdReceipt?.lens.activity?.plan?.steps).toEqual(
      planned.lens.activity?.plan?.steps
    );
    expect(thirdReceipt?.lens.activity?.items).toEqual(
      planned.lens.activity?.items
    );
  });

  it('backfills structured evidence when final delivery races an active empty snapshot', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    const delivering = event({ at: 2, status: 'tool_running' });
    delivering.lens.activity = emptyActivity();
    delivering.lens.lifecycle.durationMs = 1_234;
    delivering.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['web_search'],
      callCount: 1,
      lastStartedAt: 2,
    };

    const assignments = buildAgentChatRunAssignments(
      [planned, delivering],
      [stampedPost('reply-1', 'final'), post('request-1')],
      'chat/channel'
    );
    const [receipt] = assignments.receiptByPostId.get('reply-1') ?? [];

    expect(receipt).toMatchObject({
      phase: 'final-reply-delivered',
      lens: { status: 'tool_running' },
    });
    expect(receipt?.lens.activity).toBe(planned.lens.activity);
    expect(receipt?.lens.lifecycle).toBe(delivering.lens.lifecycle);
    expect(receipt?.lens.tools).toBe(delivering.lens.tools);
  });

  it('does not resurrect a live empty-plan tombstone when final delivery arrives', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    const initial = buildAgentChatRunAssignments(
      [planned],
      [post('request-1')],
      'chat/channel'
    );
    const cleared = event({ at: 2, status: 'tool_running' });
    cleared.lens.activity = {
      ...emptyActivity(),
      plan: { updatedAt: 2, steps: [] },
    };
    const visibleClear = buildAgentChatRunAssignments(
      [cleared],
      [post('request-1')],
      'chat/channel',
      initial
    );

    const delivered = buildAgentChatRunAssignments(
      [cleared],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel',
      visibleClear
    );
    const receipt = delivered.receiptByPostId.get('reply-1')?.[0];

    expect(receipt?.phase).toBe('final-reply-delivered');
    expect(receipt?.lens.activity?.plan?.steps).toEqual([]);
  });

  it('merges truncated active activity when final delivery races folding', () => {
    const planned = event({ at: 1, status: 'tool_running' });
    planned.lens.activity = {
      ...planned.lens.activity!,
      items: [
        {
          id: 'commentary-1',
          kind: 'commentary',
          title: 'Researching',
          progressText: 'Checking the first source.',
          status: 'completed',
          planStepId: 'work',
          startedAt: 1,
          updatedAt: 1,
          completedAt: 1,
        },
      ],
    };
    const truncated = event({ at: 2, status: 'tool_running' });
    truncated.lens.activity = {
      ...emptyActivity(),
      eventCount: 2,
      lastEventAt: 2,
      truncated: true,
      items: [
        {
          id: 'tool-1',
          kind: 'tool',
          title: 'Search',
          name: 'web_search',
          status: 'running',
          planStepId: 'work',
          startedAt: 2,
          updatedAt: 2,
          completedAt: null,
        },
      ],
    };

    const delivered = buildAgentChatRunAssignments(
      [planned, truncated],
      [post('request-1'), stampedPost('reply-1', 'final')],
      'chat/channel'
    );
    const receipt = delivered.receiptByPostId.get('reply-1')?.[0];

    expect(receipt?.lens.activity?.plan).toBe(planned.lens.activity.plan);
    expect(receipt?.lens.activity?.items.map((item) => item.id)).toEqual([
      'commentary-1',
      'tool-1',
    ]);
  });

  it('does not invent structured activity for an empty terminal run', () => {
    const delivered = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    delivered.lens.activity = emptyActivity();
    delivered.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['web_search'],
      callCount: 1,
      lastStartedAt: 2,
    };

    const assignments = buildAgentChatRunAssignments(
      [delivered],
      [post('request-1'), post('reply-1', { authorId: '~bus' })],
      'chat/channel'
    );
    const [receipt] = assignments.receiptByPostId.get('reply-1') ?? [];

    expect(receipt?.lens.activity).toBe(delivered.lens.activity);
    expect(receipt?.lens.activity?.plan).toBeNull();
    expect(receipt?.lens.activity?.items).toEqual([]);
  });

  it('renders a retry below the failed run it continues', () => {
    const failed = event({
      at: 120_000,
      status: 'timed_out',
      lensId: 'failed-run',
    });
    failed.lens.createdAt = 1_000;
    const retry = event({
      at: 121_000,
      status: 'dispatching',
      lensId: 'retry-run',
    });
    retry.lens.createdAt = 121_000;

    expect(orderAgentChatRunCards([retry], [failed])).toEqual([
      { kind: 'receipt', event: failed },
      { kind: 'live', event: retry },
    ]);
  });

  it('anchors a live retry beneath the failed reply instead of the original request', () => {
    const failed = event({
      at: 120_000,
      status: 'error',
      lensId: 'failed-run',
    });
    failed.lens.createdAt = 1_000;
    const retry = event({
      at: 121_000,
      status: 'dispatching',
      lensId: 'retry-run',
    });
    retry.lens.createdAt = 121_000;
    retry.lens.retryOf = 'failed-run';

    const assignments = buildAgentChatRunAssignments(
      [failed, retry],
      [
        post('request-1'),
        stampedPost('failed-reply', 'final', 'failed-run', 'failed'),
      ],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('failed-reply')).toMatchObject([
      { lens: { lensId: 'failed-run', status: 'error' } },
    ]);
    expect(assignments.liveByPostId.get('failed-reply')).toEqual([retry]);
    expect(assignments.liveByPostId.has('request-1')).toBe(false);
    expect(
      orderAgentChatRunCards(
        assignments.liveByPostId.get('failed-reply') ?? [],
        assignments.receiptByPostId.get('failed-reply') ?? []
      ).map((card) => `${card.kind}:${card.event.lens.lensId}`)
    ).toEqual(['receipt:failed-run', 'live:retry-run']);
  });

  it('keeps a terminal retry with no reply beneath the failed run it continued', () => {
    const failed = event({
      at: 120_000,
      status: 'timed_out',
      lensId: 'failed-run',
    });
    failed.lens.createdAt = 1_000;
    const retry = event({
      at: 240_000,
      status: 'timed_out',
      lensId: 'retry-run',
    });
    retry.lens.createdAt = 121_000;
    retry.lens.retryOf = 'failed-run';

    const assignments = buildAgentChatRunAssignments(
      [failed, retry],
      [
        post('request-1'),
        stampedPost('failed-reply', 'final', 'failed-run', 'failed'),
      ],
      'chat/channel'
    );

    expect(
      assignments.receiptByPostId
        .get('failed-reply')
        ?.map((candidate) => candidate.lens.lensId)
    ).toEqual(['failed-run', 'retry-run']);
    expect(assignments.receiptByPostId.has('request-1')).toBe(false);
  });

  it('keeps a fast completed retry observable from its parent receipt', () => {
    const failed = event({
      at: 120_000,
      status: 'timed_out',
      lensId: 'failed-run',
    });
    failed.lens.createdAt = 1_000;
    const retry = event({
      at: 125_000,
      status: 'completed',
      outputId: 'retry-reply',
      lensId: 'retry-run',
    });
    retry.lens.createdAt = 121_000;
    retry.lens.retryOf = 'failed-run';

    const assignments = buildAgentChatRunAssignments(
      [failed, retry],
      [
        post('request-1'),
        stampedPost('failed-reply', 'final', 'failed-run', 'failed'),
        stampedPost('retry-reply', 'final', 'retry-run'),
      ],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('retry-reply')).toMatchObject([
      { lens: { lensId: 'retry-run', status: 'completed' } },
    ]);
    expect(
      assignments.eventsByPostId.get('failed-reply')?.has('retry-run')
    ).toBe(true);
  });

  it('rebuilds a linked continuation after reload and supersedes its waiting receipt', () => {
    const waiting = event({
      at: 2,
      status: 'completed',
      outputId: 'permission-reply',
      lensId: 'permission-run',
      requestId: 'request-1',
    });
    waiting.lens.createdAt = 1;
    waiting.lens.triggerDetails!.authorShip = '~zod';
    waiting.lens.outputs![0]!.preview = 'Please confirm this setup.';
    waiting.lens.activity = {
      schemaVersion: 1,
      eventCount: 1,
      lastEventAt: 2,
      truncated: false,
      plan: {
        title: 'Plan updated',
        updatedAt: 2,
        steps: [
          { id: 'confirm', title: 'Confirm the setup', status: 'completed' },
          { id: 'create', title: 'Create the group', status: 'pending' },
        ],
      },
      items: [
        {
          id: 'input-1',
          kind: 'request_input',
          title: 'Setup confirmation needed',
          status: 'waiting',
          planStepId: 'confirm',
          startedAt: 2,
          updatedAt: 2,
          completedAt: null,
        },
      ],
    };
    const execution = event({
      at: 4,
      status: 'completed',
      lensId: 'execution-run',
      requestId: 'answer-1',
      outputId: 'execution-reply',
    });
    execution.lens.createdAt = 4;
    execution.lens.triggerDetails!.authorShip = '~zod';
    execution.lens.activity = planOnlyActivity(4, 'completed');
    execution.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['update_plan'],
      callCount: 1,
      lastStartedAt: 4,
    };
    execution.lens.continuation = {
      kind: 'request_input',
      parentLensId: 'permission-run',
      requestInputId: 'input-1',
      workflowId: 'workflow-1',
      linkedAt: 4,
    };

    const requestPost = post('request-1', {
      authorId: '~zod',
      receivedAt: 1,
      sentAt: 1,
    });
    const permissionReply = {
      ...stampedPost('permission-reply', 'final', 'permission-run'),
      receivedAt: 2,
      sentAt: 2,
    };
    const allPosts = [
      requestPost,
      permissionReply,
      post('answer-1', { authorId: '~zod', receivedAt: 3, sentAt: 3 }),
      {
        ...stampedPost('execution-reply', 'final', 'execution-run'),
        receivedAt: 4,
        sentAt: 4,
      },
    ];
    const beforeAnswer = buildAgentChatRunAssignments(
      [waiting],
      [requestPost, permissionReply],
      'chat/channel'
    );
    const incrementallyUpdated = buildAgentChatRunAssignments(
      [waiting, execution],
      allPosts,
      'chat/channel',
      beforeAnswer
    );
    // A remount/reload has no in-memory sticky assignment to inherit.
    const rebuiltFromHistory = buildAgentChatRunAssignments(
      [waiting, execution],
      allPosts,
      'chat/channel'
    );

    for (const assignments of [incrementallyUpdated, rebuiltFromHistory]) {
      expect(assignments.receiptByPostId.has('permission-reply')).toBe(false);
      expect(assignments.receiptByPostId.get('execution-reply')).toMatchObject([
        {
          phase: 'final-reply-delivered',
          lens: {
            lensId: 'execution-run',
            continuation: execution.lens.continuation,
          },
        },
      ]);
      expect(assignments.eventsByLensId.has('permission-run')).toBe(true);
    }
  });

  it('keeps an unlinked legacy wait beside the next independently eligible run', () => {
    const waiting = event({
      at: 2,
      status: 'completed',
      outputId: 'permission-reply',
      lensId: 'permission-run',
      requestId: 'request-1',
    });
    waiting.lens.createdAt = 1;
    waiting.lens.triggerDetails!.authorShip = '~zod';
    waiting.lens.activity = {
      ...emptyActivity(),
      items: [
        {
          id: 'input-1',
          kind: 'request_input',
          title: 'Setup confirmation needed',
          status: 'waiting',
          startedAt: 2,
          updatedAt: 2,
          completedAt: null,
        },
      ],
    };
    const nextRun = event({
      at: 4,
      status: 'tool_running',
      lensId: 'next-run',
      requestId: 'answer-1',
    });
    nextRun.lens.createdAt = 4;
    nextRun.lens.triggerDetails!.authorShip = '~zod';

    const assignments = buildAgentChatRunAssignments(
      [waiting, nextRun],
      [
        post('request-1', { authorId: '~zod', receivedAt: 1, sentAt: 1 }),
        {
          ...stampedPost('permission-reply', 'final', 'permission-run'),
          receivedAt: 2,
          sentAt: 2,
        },
        post('answer-1', { authorId: '~zod', receivedAt: 3, sentAt: 3 }),
      ],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('permission-reply')).toHaveLength(1);
    expect(assignments.liveByPostId.get('answer-1')).toEqual([nextRun]);
  });

  it('does not promote a plan-only answer from a legacy incomplete predecessor', () => {
    const incomplete = event({
      at: 2,
      status: 'completed',
      outputId: 'question-reply',
      lensId: 'legacy-question-run',
    });
    incomplete.lens.triggerDetails!.authorShip = '~zod';
    incomplete.lens.activity = {
      ...emptyActivity(),
      plan: {
        updatedAt: 2,
        steps: [
          { id: 'ask', title: 'Get the event name', status: 'completed' },
          { id: 'draft', title: 'Draft the announcement', status: 'pending' },
        ],
      },
      items: [
        {
          id: 'legacy-commentary',
          kind: 'commentary',
          title: 'Progress',
          progressText: 'I need the event name before drafting.',
          status: 'completed',
          planStepId: 'ask',
          startedAt: 1,
          updatedAt: 2,
          completedAt: 2,
        },
      ],
    };
    const answerRun = event({
      at: 4,
      status: 'completed',
      outputId: 'answer-reply',
      lensId: 'legacy-answer-run',
      requestId: 'answer-1',
    });
    answerRun.lens.createdAt = 4;
    answerRun.lens.triggerDetails!.authorShip = '~zod';
    answerRun.lens.activity = planOnlyActivity(4, 'completed');
    answerRun.lens.tools = {
      ownerOnlyAvailable: [],
      called: ['update_plan'],
      callCount: 1,
      lastStartedAt: 4,
    };

    const assignments = buildAgentChatRunAssignments(
      [incomplete, answerRun],
      [
        post('request-1', { authorId: '~zod' }),
        stampedPost('question-reply', 'final', 'legacy-question-run'),
        post('answer-1', { authorId: '~zod' }),
        stampedPost('answer-reply', 'final', 'legacy-answer-run'),
      ],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('question-reply')).toHaveLength(1);
    expect(assignments.receiptByPostId.has('answer-reply')).toBe(false);
  });

  it('does not hide a waiting parent when the linked input id is wrong', () => {
    const waiting = event({
      at: 2,
      status: 'completed',
      outputId: 'permission-reply',
      lensId: 'permission-run',
    });
    waiting.lens.triggerDetails!.authorShip = '~zod';
    waiting.lens.activity = {
      ...emptyActivity(),
      items: [
        {
          id: 'input-1',
          kind: 'request_input',
          title: 'Setup confirmation needed',
          status: 'waiting',
          startedAt: 2,
          updatedAt: 2,
          completedAt: null,
        },
      ],
    };
    const child = event({
      at: 4,
      status: 'tool_running',
      lensId: 'execution-run',
      requestId: 'answer-1',
    });
    child.lens.createdAt = 4;
    child.lens.triggerDetails!.authorShip = '~zod';
    child.lens.activity = planOnlyActivity(4);
    child.lens.continuation = {
      kind: 'request_input',
      parentLensId: 'permission-run',
      requestInputId: 'different-input',
      workflowId: 'workflow-1',
      linkedAt: 4,
    };

    const assignments = buildAgentChatRunAssignments(
      [waiting, child],
      [
        post('request-1', { authorId: '~zod' }),
        stampedPost('permission-reply', 'final', 'permission-run'),
        post('answer-1', { authorId: '~zod' }),
      ],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('permission-reply')).toHaveLength(1);
    expect(assignments.liveByPostId.get('answer-1')).toEqual([child]);
  });

  it('does not supersede a linked waiting parent from another thread', () => {
    const waiting = event({
      at: 2,
      status: 'completed',
      outputId: 'permission-reply',
      lensId: 'permission-run',
    });
    waiting.lens.triggerDetails!.authorShip = '~zod';
    waiting.lens.activity = {
      ...emptyActivity(),
      items: [
        {
          id: 'input-1',
          kind: 'request_input',
          title: 'Setup confirmation needed',
          status: 'waiting',
          startedAt: 2,
          updatedAt: 2,
          completedAt: null,
        },
      ],
    };
    const child = event({
      at: 4,
      status: 'tool_running',
      lensId: 'execution-run',
      requestId: 'answer-1',
    });
    child.lens.createdAt = 4;
    child.lens.triggerDetails!.authorShip = '~zod';
    child.lens.activity = planOnlyActivity(4);
    child.lens.continuation = {
      kind: 'request_input',
      parentLensId: 'permission-run',
      requestInputId: 'input-1',
      workflowId: 'workflow-1',
      linkedAt: 4,
    };

    const assignments = buildAgentChatRunAssignments(
      [waiting, child],
      [
        post('request-1', {
          authorId: '~zod',
          type: 'reply',
          parentId: 'thread-a',
        }),
        {
          ...stampedPost('permission-reply', 'final', 'permission-run'),
          type: 'reply',
          parentId: 'thread-a',
        },
        post('answer-1', {
          authorId: '~zod',
          type: 'reply',
          parentId: 'thread-b',
        }),
      ],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('permission-reply')).toHaveLength(1);
    expect(assignments.liveByPostId.get('answer-1')).toEqual([child]);
  });

  it('does not let another group member resolve a waiting receipt', () => {
    const waiting = event({
      at: 2,
      status: 'completed',
      outputId: 'permission-reply',
      lensId: 'permission-run',
    });
    waiting.lens.createdAt = 1;
    waiting.lens.triggerDetails!.authorShip = '~zod';
    waiting.lens.outputs![0]!.preview = 'Please confirm this setup.';
    waiting.lens.activity = {
      ...emptyActivity(),
      items: [
        {
          id: 'input-1',
          kind: 'request_input',
          title: 'Setup confirmation needed',
          status: 'waiting',
          startedAt: 2,
          updatedAt: 2,
          completedAt: null,
        },
      ],
    };
    const execution = event({
      at: 4,
      status: 'tool_running',
      lensId: 'other-run',
      requestId: 'other-answer',
    });
    execution.lens.createdAt = 4;
    execution.lens.triggerDetails!.authorShip = '~nec';

    const assignments = buildAgentChatRunAssignments(
      [waiting, execution],
      [
        post('request-1', { authorId: '~zod', receivedAt: 1, sentAt: 1 }),
        {
          ...stampedPost('permission-reply', 'final', 'permission-run'),
          receivedAt: 2,
          sentAt: 2,
        },
        post('other-answer', {
          authorId: '~nec',
          receivedAt: 3,
          sentAt: 3,
        }),
      ],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('permission-reply')).toHaveLength(1);
  });

  it('anchors an active run to its triggering message', () => {
    const active = event({ at: 1, status: 'tool_running' });
    const assignments = buildAgentChatRunAssignments(
      [active],
      [post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.get('request-1')).toEqual([active]);
    expect(assignments.receiptByPostId.size).toBe(0);
  });

  it('moves the final receipt to a loaded output message', () => {
    const active = event({ at: 1, status: 'tool_running' });
    const complete = event({
      at: 2,
      status: 'completed',
      outputId: 'reply-1',
    });
    const assignments = buildAgentChatRunAssignments(
      [active, complete],
      [post('reply-1'), post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.size).toBe(0);
    expect(assignments.receiptByPostId.get('reply-1')).toEqual([complete]);
    expect(assignments.eventsByLensId.get('run-1')).toEqual([active, complete]);
  });

  it('never lets a newer run replace an older stamped receipt', () => {
    const first = event({
      at: 2,
      status: 'completed',
      lensId: 'run-1',
      outputId: 'reply-1',
      requestId: 'request-1',
    });
    const second = event({
      at: 4,
      status: 'completed',
      lensId: 'run-2',
      outputId: 'reply-2',
      requestId: 'request-2',
    });

    const assignments = buildAgentChatRunAssignments(
      [first, second],
      [
        post('request-1'),
        stampedPost('reply-1', 'final', 'run-1'),
        post('request-2'),
        stampedPost('reply-2', 'final', 'run-2'),
      ],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('reply-1')).toMatchObject([
      { lens: { lensId: 'run-1' } },
    ]);
    expect(assignments.receiptByPostId.get('reply-2')).toMatchObject([
      { lens: { lensId: 'run-2' } },
    ]);
  });

  it('closes chat tasks when the final reply is visible while cleanup continues', () => {
    const delivering = event({
      at: 2,
      status: 'tool_running',
      outputId: 'reply-1',
    });
    delivering.lens.lifecycle.queuedFinal = true;
    delivering.lens.lifecycle.queuedFinalCount = 1;
    delivering.lens.lifecycle.deliveredMessageCount = 1;

    const assignments = buildAgentChatRunAssignments(
      [delivering],
      [post('reply-1'), post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.size).toBe(0);
    expect(assignments.receiptByPostId.get('reply-1')).toMatchObject([
      {
        phase: 'final-reply-delivered',
        lens: { lensId: 'run-1', status: 'tool_running' },
      },
    ]);
    expect(
      agentChatRunOutcome(assignments.receiptByPostId.get('reply-1')![0])
    ).toBe('finishing');
    expect(delivering.lens.status).toBe('tool_running');
  });

  it('closes from the stamped final post before the durable final snapshot arrives', () => {
    const active = event({ at: 2, status: 'tool_running' });

    const assignments = buildAgentChatRunAssignments(
      [active],
      [stampedPost('reply-1', 'final'), post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.size).toBe(0);
    expect(assignments.receiptByPostId.get('reply-1')).toMatchObject([
      {
        phase: 'final-reply-delivered',
        lens: { lensId: 'run-1', status: 'tool_running' },
      },
    ]);
    expect(active.lens.status).toBe('tool_running');
  });

  it('projects a stamped final reply as finishing while its plan snapshot is stale', () => {
    const stale = event({ at: 2, status: 'tool_running' });
    stale.lens.activity = {
      schemaVersion: 1,
      eventCount: 3,
      lastEventAt: 2,
      truncated: false,
      plan: {
        updatedAt: 2,
        steps: [
          { id: 'create', title: 'Create the avatar', status: 'completed' },
          { id: 'apply', title: 'Apply the avatar', status: 'running' },
          { id: 'verify', title: 'Verify the avatar', status: 'pending' },
        ],
      },
      items: [
        {
          id: 'commentary-stale',
          kind: 'commentary',
          title: 'Progress',
          progressText: 'Applying the avatar now.',
          status: 'running',
          planStepId: 'apply',
          startedAt: 2,
          updatedAt: 2,
          completedAt: null,
        },
      ],
    };

    const assignments = buildAgentChatRunAssignments(
      [stale],
      [stampedPost('reply-1', 'final'), post('request-1')],
      'chat/channel'
    );
    const receipt = assignments.receiptByPostId.get('reply-1')?.[0];

    expect(receipt).toMatchObject({
      phase: 'final-reply-delivered',
      lens: { status: 'tool_running' },
    });
    expect(agentChatRunOutcome(receipt!)).toBe('finishing');
    expect(
      receipt?.lens.activity?.plan?.steps.map((step) => step.status)
    ).toEqual(['completed', 'running', 'pending']);
    expect(stale.lens.status).toBe('tool_running');
  });

  it('projects a terminal all-complete plan as completed', () => {
    const complete = event({ at: 3, status: 'completed' });
    complete.lens.activity = {
      schemaVersion: 1,
      eventCount: 3,
      lastEventAt: 3,
      truncated: false,
      plan: {
        updatedAt: 3,
        steps: [
          { id: 'create', title: 'Create the avatar', status: 'completed' },
          { id: 'apply', title: 'Apply the avatar', status: 'completed' },
          { id: 'verify', title: 'Verify the avatar', status: 'completed' },
        ],
      },
      items: [
        {
          id: 'commentary-complete',
          kind: 'commentary',
          title: 'Progress',
          progressText: 'Verified the avatar.',
          status: 'completed',
          planStepId: 'verify',
          startedAt: 2,
          updatedAt: 3,
          completedAt: 3,
        },
      ],
    };

    const assignments = buildAgentChatRunAssignments(
      [complete],
      [stampedPost('reply-1', 'final'), post('request-1')],
      'chat/channel'
    );
    const receipt = assignments.receiptByPostId.get('reply-1')?.[0];

    expect(agentChatRunOutcome(receipt!)).toBe('completed');
  });

  it('does not close from an intermediate stamped post', () => {
    const active = event({ at: 2, status: 'tool_running' });

    const assignments = buildAgentChatRunAssignments(
      [active],
      [stampedPost('reply-1', 'intermediate'), post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.get('request-1')).toEqual([active]);
    expect(assignments.receiptByPostId.size).toBe(0);
  });

  it('closes a stamped error reply as failed rather than completed', () => {
    const active = event({ at: 2, status: 'tool_running' });

    const assignments = buildAgentChatRunAssignments(
      [active],
      [stampedPost('reply-1', 'final', 'run-1', 'failed'), post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.size).toBe(0);
    expect(assignments.receiptByPostId.get('reply-1')).toMatchObject([
      {
        phase: 'final-reply-delivered',
        lens: { lensId: 'run-1', status: 'error' },
      },
    ]);
  });

  it('keeps non-final delivered blocks live until a final reply arrives', () => {
    const delivering = event({
      at: 2,
      status: 'tool_running',
      outputId: 'reply-1',
    });
    delivering.lens.lifecycle.deliveredMessageCount = 1;

    const assignments = buildAgentChatRunAssignments(
      [delivering],
      [post('reply-1'), post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.get('request-1')).toEqual([delivering]);
    expect(assignments.receiptByPostId.size).toBe(0);
  });

  it('keeps a no-output receipt on the triggering message', () => {
    const complete = event({ at: 2, status: 'no_reply' });
    const assignments = buildAgentChatRunAssignments(
      [complete],
      [post('request-1')],
      'chat/channel'
    );

    expect(assignments.receiptByPostId.get('request-1')).toEqual([complete]);
  });

  it('keeps concurrent group agents as separate stable rows', () => {
    const first = event({
      at: 1,
      status: 'tool_running',
      lensId: 'run-1',
      botShip: '~bus',
    });
    const second = event({
      at: 2,
      status: 'dispatching',
      lensId: 'run-2',
      botShip: '~dev',
    });
    const firstUpdate = event({
      at: 3,
      status: 'delivering',
      lensId: 'run-1',
      botShip: '~bus',
    });

    const assignments = buildAgentChatRunAssignments(
      [first, second, firstUpdate],
      [post('request-1')],
      'chat/channel'
    );

    expect(assignments.liveByPostId.get('request-1')).toEqual([
      firstUpdate,
      second,
    ]);
    expect(assignments.eventsByLensId.get('run-1')).toEqual([
      first,
      firstUpdate,
    ]);
  });

  it('preserves unrelated post assignments when another run receives events', () => {
    const first = event({
      at: 1,
      status: 'tool_running',
      lensId: 'run-1',
      requestId: 'request-1',
    });
    const second = event({
      at: 2,
      status: 'tool_running',
      lensId: 'run-2',
      requestId: 'request-2',
    });
    const initial = buildAgentChatRunAssignments(
      [first, second],
      [post('request-1'), post('request-2')],
      'chat/channel'
    );
    const firstUpdate = event({
      at: 3,
      status: 'delivering',
      lensId: 'run-1',
      requestId: 'request-1',
    });

    const updated = buildAgentChatRunAssignments(
      [first, second, firstUpdate],
      [post('request-1'), post('request-2')],
      'chat/channel',
      initial
    );

    expect(updated.liveByPostId.get('request-1')).not.toBe(
      initial.liveByPostId.get('request-1')
    );
    expect(updated.eventsByPostId.get('request-1')).not.toBe(
      initial.eventsByPostId.get('request-1')
    );
    expect(updated.liveByPostId.get('request-2')).toBe(
      initial.liveByPostId.get('request-2')
    );
    expect(updated.eventsByLensId.get('run-2')).toBe(
      initial.eventsByLensId.get('run-2')
    );
    expect(updated.eventsByPostId.get('request-2')).toBe(
      initial.eventsByPostId.get('request-2')
    );
  });

  it('changes only the decorated virtual-list item for the updated run', () => {
    const firstPost = post('request-1');
    const secondPost = post('request-2');
    const items = [
      { post: firstPost, previous: null, next: secondPost },
      { post: secondPost, previous: firstPost, next: null },
    ];
    const first = event({
      at: 1,
      status: 'tool_running',
      lensId: 'run-1',
      requestId: 'request-1',
    });
    const second = event({
      at: 2,
      status: 'tool_running',
      lensId: 'run-2',
      requestId: 'request-2',
    });
    const initialAssignments = buildAgentChatRunAssignments(
      [first, second],
      [firstPost, secondPost],
      'chat/channel'
    );
    const initialItems = decoratePostsWithAgentChatRuns(
      items,
      initialAssignments
    );
    const firstUpdate = event({
      at: 3,
      status: 'delivering',
      lensId: 'run-1',
      requestId: 'request-1',
    });
    const updatedAssignments = buildAgentChatRunAssignments(
      [first, second, firstUpdate],
      [firstPost, secondPost],
      'chat/channel',
      initialAssignments
    );
    const updatedItems = decoratePostsWithAgentChatRuns(
      items,
      updatedAssignments,
      initialItems
    );

    expect(updatedItems[0]).not.toBe(initialItems[0]);
    expect(updatedItems[1]).toBe(initialItems[1]);
  });

  it('normalizes wire writ ids before anchoring a real DM run', () => {
    const active = event({ at: 1, status: 'tool_running' });
    active.lens.chatType = 'dm';
    active.lens.messageId = '~zod/170.1';
    active.lens.triggerDetails = {
      type: 'dm',
      messageId: '~zod/170.1',
      conversationId: '~zod',
      conversationKind: 'dm',
    };

    const complete = structuredClone(active);
    complete.at = 2;
    complete.seq = 2;
    complete.lens.status = 'completed';
    complete.lens.outputs = [
      {
        messageId: '~bus/170.2',
        conversationId: '~zod',
        kind: 'dm',
        sentAt: 2,
      },
    ];

    const activeAssignments = buildAgentChatRunAssignments(
      [active],
      [post('170.1')],
      '~bus'
    );
    expect(activeAssignments.liveByPostId.get('170.1')).toEqual([active]);

    const finalAssignments = buildAgentChatRunAssignments(
      [active, complete],
      [post('170.2'), post('170.1')],
      '~bus'
    );
    expect(finalAssignments.receiptByPostId.get('170.2')).toEqual([complete]);
  });

  it('projects only the live DM run whose trigger is loaded in the open thread', () => {
    const openThreadRun = event({
      at: 1,
      status: 'tool_running',
      lensId: 'open-thread-run',
      requestId: 'thread-reply-1',
    });
    const otherThreadRun = event({
      at: 2,
      status: 'tool_running',
      lensId: 'other-thread-run',
      requestId: 'thread-reply-2',
    });
    for (const candidate of [openThreadRun, otherThreadRun]) {
      candidate.lens.chatType = 'dm';
      candidate.lens.triggerDetails = {
        type: 'dm',
        messageId: candidate.lens.messageId,
        conversationId: '~owner',
        conversationKind: 'dm',
      };
    }

    const assignments = buildAgentChatRunAssignments(
      [openThreadRun, otherThreadRun],
      [
        post('thread-root'),
        post('thread-reply-1', {
          type: 'reply',
          parentId: 'thread-root',
        }),
      ],
      '~bus'
    );

    expect(assignments.liveByPostId.get('thread-reply-1')).toEqual([
      openThreadRun,
    ]);
    expect(assignments.liveByPostId.has('thread-reply-2')).toBe(false);
    expect(
      [...assignments.liveByPostId.values()]
        .flat()
        .map((candidate) => candidate.lens.lensId)
    ).toEqual(['open-thread-run']);
  });

  it('anchors a group run whose Lens trigger uses an undotted @ud', () => {
    const rawPostId = '170141184508121164785158283132504375296';
    const canonicalPostId =
      '170.141.184.508.121.164.785.158.283.132.504.375.296';
    const groupRun = event({
      at: 1,
      status: 'tool_running',
      lensId: 'group-run',
      requestId: rawPostId,
    });
    groupRun.lens.chatType = 'channel';
    groupRun.lens.messageId = rawPostId;
    groupRun.lens.triggerDetails = {
      type: 'message',
      messageId: rawPostId,
      conversationId: 'chat/~sitrul-nacwyl/pqupjxzy-general',
      conversationKind: 'channel',
    };

    const assignments = buildAgentChatRunAssignments(
      [groupRun],
      [
        post(canonicalPostId, {
          channelId: 'chat/~sitrul-nacwyl/pqupjxzy-general',
        }),
      ],
      'chat/~sitrul-nacwyl/pqupjxzy-general'
    );

    expect(assignments.liveByPostId.get(canonicalPostId)).toEqual([groupRun]);
  });

  it('anchors a live participant projection to its hidden carrier post', () => {
    const participant = participantEvent('tool_running');
    const carrierIds = new Set(['carrier-1']);
    const assignments = buildAgentChatRunAssignments(
      [participant],
      [post('request-1'), post('carrier-1')],
      'chat/channel',
      undefined,
      carrierIds
    );

    expect(assignments.liveByPostId.get('carrier-1')).toEqual([participant]);
    expect(assignments.liveByPostId.has('request-1')).toBe(false);
    expect(assignments.participantCarrierPostIds).toBe(carrierIds);

    const [decorated] = decoratePostsWithAgentChatRuns(
      [
        {
          post: post('carrier-1'),
          previous: null,
          next: null,
        },
      ],
      assignments
    );
    expect(decorated.hidePostContent).toBe(true);
    expect(decorated.agentRunEvents).toEqual([participant]);
  });

  it('keeps a terminal participant receipt on its carrier post', () => {
    const participant = participantEvent('timed_out');
    const assignments = buildAgentChatRunAssignments(
      [participant],
      [post('request-1'), post('carrier-1')],
      'chat/channel',
      undefined,
      new Set(['carrier-1'])
    );

    expect(assignments.liveByPostId.size).toBe(0);
    expect(assignments.receiptByPostId.get('carrier-1')).toEqual([participant]);
    expect(assignments.receiptByPostId.has('request-1')).toBe(false);
  });

  it('does not let a successful reply stamp overwrite a failed participant task', () => {
    const participant = participantEvent('error');
    participant.participantActivity.surface = 'final';
    participant.lens.outputs = [
      {
        messageId: 'final-1',
        conversationId: 'chat/channel',
        kind: 'channel',
        sentAt: 3,
      },
    ];
    const finalPost = stampedPost('final-1', 'final', 'run-1', 'completed');

    const assignments = buildAgentChatRunAssignments(
      [participant],
      [post('request-1'), finalPost],
      'chat/channel'
    );
    const [receipt] = assignments.receiptByPostId.get('final-1') ?? [];

    expect(receipt?.lens.status).toBe('error');
    expect(agentChatRunOutcome(receipt)).toBe('failed');
  });

  it('removes an enabled inactive carrier but keeps fallback text when off', () => {
    const request = post('request-1');
    const carrier = post('carrier-1');
    const enabledAssignments = buildAgentChatRunAssignments(
      [],
      [request, carrier],
      'chat/channel',
      undefined,
      new Set(['carrier-1'])
    );
    const disabledAssignments = buildAgentChatRunAssignments(
      [],
      [request, carrier],
      'chat/channel'
    );

    expect(
      filterRenderableAgentChatPosts([request, carrier], enabledAssignments)
    ).toEqual([request]);
    expect(
      filterRenderableAgentChatPosts([request, carrier], disabledAssignments)
    ).toEqual([request, carrier]);
  });
});
