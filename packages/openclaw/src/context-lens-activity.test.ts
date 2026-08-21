import { describe, expect, it } from 'vitest';

import {
  emptyContextLensActivity,
  foldContextLensActivity,
  normalizeContextLensActivityEvent,
} from './context-lens-activity.js';

type HostEvent = Parameters<typeof normalizeContextLensActivityEvent>[0];

function hostEvent(
  stream: string,
  data: Record<string, unknown>,
  overrides: Partial<HostEvent> = {}
): HostEvent {
  return {
    runId: 'run-1',
    sessionKey: 'agent:main:tlon:direct:~ten',
    seq: 1,
    ts: 1_000,
    stream,
    data,
    ...overrides,
  };
}

describe('Context Lens agent activity normalization', () => {
  it('normalizes user-facing commentary without copying unrelated data', () => {
    const event = normalizeContextLensActivityEvent(
      hostEvent('item', {
        itemId: 'commentary-1',
        kind: 'preamble',
        phase: 'update',
        progressText: '  Inspecting   the event schema  ',
        privatePayload: 'do not copy',
      })
    );

    expect(event).toMatchObject({
      schemaVersion: 1,
      runId: 'run-1',
      sequence: 1,
      kind: 'commentary',
      phase: 'update',
      retention: 'snapshot',
      itemId: 'commentary-1',
      status: 'running',
      progressText: 'Inspecting the event schema',
    });
    expect(JSON.stringify(event)).not.toContain('privatePayload');
    expect(JSON.stringify(event)).not.toContain('do not copy');
  });

  it('normalizes plan steps into stable task candidates', () => {
    const event = normalizeContextLensActivityEvent(
      hostEvent('plan', {
        phase: 'update',
        explanation: 'Start with the shared contract.',
        steps: [
          { id: 'contract', step: 'Define contract', status: 'completed' },
          { step: 'Wire live events', status: 'in_progress' },
        ],
      })
    );

    expect(event?.plan).toEqual({
      explanation: 'Start with the shared contract.',
      steps: [
        { id: 'contract', title: 'Define contract', status: 'completed' },
        {
          id: 'plan-step-2',
          title: 'Wire live events',
          status: 'running',
        },
      ],
      updatedAt: 1_000,
    });
  });

  it('normalizes OpenClaw 7.1 string plan steps and camel-case statuses', () => {
    const event = normalizeContextLensActivityEvent(
      hostEvent('plan', {
        phase: 'update',
        explanation: 'Follow the live plan.',
        steps: [
          'Audit the event shape (completed)',
          'Wire live rows (inProgress)',
          'Verify Messenger (pending)',
        ],
      })
    );

    expect(event?.plan?.steps).toEqual([
      {
        id: 'plan-step-1',
        title: 'Audit the event shape',
        status: 'completed',
      },
      {
        id: 'plan-step-2',
        title: 'Wire live rows',
        status: 'running',
      },
      {
        id: 'plan-step-3',
        title: 'Verify Messenger',
        status: 'pending',
      },
    ]);
  });

  it('does not expose raw thinking, assistant deltas, tool args, or results', () => {
    expect(
      normalizeContextLensActivityEvent(
        hostEvent('thinking', { delta: 'private reasoning' })
      )
    ).toBeNull();
    expect(
      normalizeContextLensActivityEvent(
        hostEvent('assistant', { delta: 'reply text' })
      )
    ).toBeNull();

    const tool = normalizeContextLensActivityEvent(
      hostEvent('tool', {
        phase: 'start',
        name: 'read',
        toolCallId: 'call-1',
        args: { path: '/secret/path' },
        result: 'secret result',
      })
    );
    expect(tool).toMatchObject({
      kind: 'tool',
      itemId: 'tool:call-1',
      name: 'read',
      status: 'running',
    });
    expect(JSON.stringify(tool)).not.toContain('/secret/path');
    expect(JSON.stringify(tool)).not.toContain('secret result');
  });

  it('marks command output as live-only and caps its text', () => {
    const event = normalizeContextLensActivityEvent(
      hostEvent('command_output', {
        phase: 'delta',
        toolCallId: 'exec-1',
        output: 'x'.repeat(4_000),
      })
    );

    expect(event).toMatchObject({
      kind: 'command',
      retention: 'ephemeral',
      itemId: 'command:exec-1',
    });
    expect(event?.progressText?.length).toBeLessThanOrEqual(2_000);
  });

  it('normalizes only the explicit requester-input event, not its no-op tool lifecycle', () => {
    const request = normalizeContextLensActivityEvent(
      hostEvent('tlon.request_input', {
        phase: 'requested',
        status: 'waiting',
        itemId: 'request-input:call-1',
        title: 'Which group name should I use?',
        source: 'tlon_request_input',
        toolCallId: 'call-1',
      })
    );
    expect(request).toMatchObject({
      kind: 'request_input',
      itemId: 'request-input:call-1',
      title: 'Which group name should I use?',
      status: 'waiting',
      source: 'tlon_request_input',
      toolCallId: 'call-1',
    });

    expect(
      normalizeContextLensActivityEvent(
        hostEvent('tool', {
          phase: 'start',
          name: 'tlon_request_input',
          toolCallId: 'call-1',
        })
      )
    ).toBeNull();
  });
});

describe('Context Lens activity fold', () => {
  it('coalesces streamed commentary updates by stable item id', () => {
    const first = normalizeContextLensActivityEvent(
      hostEvent('item', {
        itemId: 'commentary-1',
        kind: 'preamble',
        phase: 'update',
        progressText: 'Inspecting events',
      })
    );
    const second = normalizeContextLensActivityEvent(
      hostEvent(
        'item',
        {
          itemId: 'commentary-1',
          kind: 'preamble',
          phase: 'update',
          progressText: 'Mapping events into the shared contract',
        },
        { seq: 2, ts: 1_250 }
      )
    );
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    const afterFirst = foldContextLensActivity(
      emptyContextLensActivity(),
      first!
    );
    const afterSecond = foldContextLensActivity(afterFirst, second!);

    expect(afterSecond.eventCount).toBe(2);
    expect(afterSecond.items).toHaveLength(1);
    expect(afterSecond.items[0]).toMatchObject({
      id: 'commentary-1',
      kind: 'commentary',
      progressText: 'Mapping events into the shared contract',
      startedAt: 1_000,
      updatedAt: 1_250,
    });
  });

  it('keeps ephemeral command output out of the durable snapshot', () => {
    const command = normalizeContextLensActivityEvent(
      hostEvent('command_output', {
        phase: 'delta',
        toolCallId: 'exec-1',
        output: 'live output',
      })
    );
    expect(command).not.toBeNull();

    const before = emptyContextLensActivity();
    expect(foldContextLensActivity(before, command!)).toBe(before);
  });

  it('associates activity with the active plan step and closes prior commentary', () => {
    const plan = normalizeContextLensActivityEvent(
      hostEvent('plan', {
        phase: 'update',
        steps: [
          'Inspect the data (completed)',
          'Wire the UI (inProgress)',
          'Verify the app (pending)',
        ],
      })
    );
    const firstCommentary = normalizeContextLensActivityEvent(
      hostEvent(
        'item',
        {
          itemId: 'commentary-1',
          kind: 'preamble',
          phase: 'update',
          progressText: 'Connecting the rows.',
        },
        { seq: 2, ts: 1_100 }
      )
    );
    const secondCommentary = normalizeContextLensActivityEvent(
      hostEvent(
        'item',
        {
          itemId: 'commentary-2',
          kind: 'preamble',
          phase: 'update',
          progressText: 'Checking the rendered result.',
        },
        { seq: 3, ts: 1_200 }
      )
    );

    let activity = foldContextLensActivity(emptyContextLensActivity(), plan!);
    activity = foldContextLensActivity(activity, firstCommentary!);
    activity = foldContextLensActivity(activity, secondCommentary!);

    expect(activity.items).toEqual([
      expect.objectContaining({
        id: 'commentary-1',
        planStepId: 'plan-step-2',
        status: 'completed',
        completedAt: 1_200,
      }),
      expect.objectContaining({
        id: 'commentary-2',
        planStepId: 'plan-step-2',
        status: 'running',
      }),
    ]);
  });

  it('keeps existing rows and activity attached when a new plan step is inserted', () => {
    const firstPlan = normalizeContextLensActivityEvent(
      hostEvent('plan', {
        phase: 'update',
        steps: [
          'Fetch current weather (inProgress)',
          'Compare the cities (pending)',
        ],
      })
    );
    const commentary = normalizeContextLensActivityEvent(
      hostEvent(
        'item',
        {
          itemId: 'commentary-1',
          kind: 'preamble',
          phase: 'update',
          progressText: 'Fetching the current readings.',
        },
        { seq: 2, ts: 1_100 }
      )
    );
    const revisedPlan = normalizeContextLensActivityEvent(
      hostEvent(
        'plan',
        {
          phase: 'update',
          steps: [
            'Confirm the comparison date (inProgress)',
            'Fetch current weather (completed)',
            'Compare the cities (pending)',
          ],
        },
        { seq: 3, ts: 1_200 }
      )
    );

    let folded = foldContextLensActivity(
      emptyContextLensActivity(),
      firstPlan!
    );
    folded = foldContextLensActivity(folded, commentary!);
    folded = foldContextLensActivity(folded, revisedPlan!);

    expect(folded.plan?.steps).toEqual([
      expect.objectContaining({
        title: 'Confirm the comparison date',
        status: 'running',
      }),
      {
        id: 'plan-step-1',
        title: 'Fetch current weather',
        status: 'completed',
      },
      {
        id: 'plan-step-2',
        title: 'Compare the cities',
        status: 'pending',
      },
    ]);
    expect(folded.plan?.steps[0].id).not.toBe('plan-step-1');
    expect(folded.items[0]).toMatchObject({
      id: 'commentary-1',
      planStepId: 'plan-step-1',
    });
  });

  it('closes active commentary and plan work when the run lifecycle ends', () => {
    const plan = normalizeContextLensActivityEvent(
      hostEvent('plan', {
        phase: 'update',
        steps: ['Implement the rows (inProgress)', 'Ship later (pending)'],
      })
    );
    const commentary = normalizeContextLensActivityEvent(
      hostEvent(
        'item',
        {
          itemId: 'commentary-1',
          kind: 'preamble',
          phase: 'update',
          progressText: 'Finishing the current row.',
        },
        { seq: 2, ts: 1_100 }
      )
    );
    const lifecycle = normalizeContextLensActivityEvent(
      hostEvent(
        'lifecycle',
        { phase: 'end', status: 'completed' },
        { seq: 3, ts: 1_200 }
      )
    );

    let activity = foldContextLensActivity(emptyContextLensActivity(), plan!);
    activity = foldContextLensActivity(activity, commentary!);
    activity = foldContextLensActivity(activity, lifecycle!);

    expect(activity.plan?.steps).toEqual([
      {
        id: 'plan-step-1',
        title: 'Implement the rows',
        status: 'completed',
      },
      { id: 'plan-step-2', title: 'Ship later', status: 'pending' },
    ]);
    expect(activity.items[0]).toMatchObject({
      id: 'commentary-1',
      status: 'completed',
      updatedAt: 1_200,
      completedAt: 1_200,
    });
  });

  it('keeps requester input waiting across successful lifecycle completion', () => {
    const request = normalizeContextLensActivityEvent(
      hostEvent('tlon.request_input', {
        phase: 'requested',
        itemId: 'request-input:call-1',
        title: 'Which group name should I use?',
        toolCallId: 'call-1',
      })
    );
    const lifecycle = normalizeContextLensActivityEvent(
      hostEvent(
        'lifecycle',
        { phase: 'end', status: 'completed' },
        { seq: 2, ts: 1_200 }
      )
    );

    let activity = foldContextLensActivity(
      emptyContextLensActivity(),
      request!
    );
    activity = foldContextLensActivity(activity, lifecycle!);

    expect(activity.items).toEqual([
      expect.objectContaining({
        kind: 'request_input',
        status: 'waiting',
        completedAt: null,
        updatedAt: 1_000,
      }),
    ]);
  });

  it('bounds retained activity items and records truncation', () => {
    let activity = emptyContextLensActivity();
    for (let index = 0; index < 3; index += 1) {
      const event = normalizeContextLensActivityEvent(
        hostEvent(
          'item',
          {
            itemId: `item-${index}`,
            kind: 'task',
            phase: 'end',
            title: `Task ${index}`,
            status: 'completed',
          },
          { seq: index + 1, ts: 1_000 + index }
        )
      );
      activity = foldContextLensActivity(activity, event!, 2);
    }

    expect(activity.truncated).toBe(true);
    expect(activity.items.map((item) => item.id)).toEqual(['item-1', 'item-2']);
  });
});
