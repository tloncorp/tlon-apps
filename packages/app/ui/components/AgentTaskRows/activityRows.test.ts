import type { ContextLensActivity } from '@tloncorp/api/urbit/lens';
import { describe, expect, it } from 'vitest';

import {
  buildAgentTaskRowsFromActivity,
  compactWaitingTaskRows,
} from './activityRows';

function activity(
  overrides: Partial<ContextLensActivity> = {}
): ContextLensActivity {
  return {
    schemaVersion: 1,
    eventCount: 0,
    lastEventAt: null,
    truncated: false,
    plan: null,
    items: [],
    ...overrides,
  };
}

describe('Context Lens activity task rows', () => {
  it('projects a waiting plan as one gate while retaining the queued count', () => {
    const projection = compactWaitingTaskRows([
      {
        id: 'confirm',
        sequence: 1,
        title: 'Confirm the setup',
        status: 'waiting',
      },
      {
        id: 'create',
        sequence: 2,
        title: 'Create the group',
        status: 'pending',
      },
      {
        id: 'share',
        sequence: 3,
        title: 'Share the reference',
        status: 'pending',
      },
    ]);

    expect(projection.rows.map((row) => row.id)).toEqual(['confirm']);
    expect(projection.queuedCount).toBe(2);
    expect(projection.hiddenCount).toBe(2);
  });

  it('renders a stable collapsed bootstrap row instead of streamed commentary fragments', () => {
    const partialActivity = activity({
      items: [
        {
          id: 'commentary-1',
          kind: 'commentary',
          title: 'Preamble',
          progressText: 'I',
          status: 'running',
          startedAt: 1_000,
          updatedAt: 1_000,
          completedAt: null,
        },
      ],
    });
    const model = buildAgentTaskRowsFromActivity(partialActivity, [], {
      presentation: 'chat',
      runOutcome: 'active',
    });

    expect(model).toEqual({
      rows: [
        {
          id: 'preparing-task-plan',
          sequence: 1,
          title: 'Preparing task plan',
          status: 'running',
        },
      ],
    });
    expect(JSON.stringify(model)).not.toContain('"I"');

    const inspector = buildAgentTaskRowsFromActivity(partialActivity, [], {
      presentation: 'inspector',
      runOutcome: 'active',
    });
    expect(inspector.rows[0].title).toBe('I');
  });

  it('leaves bootstrap mode when a real action starts before a plan exists', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        items: [
          {
            id: 'commentary-1',
            kind: 'commentary',
            title: 'Preamble',
            progressText: 'Fetching current conditions.',
            status: 'completed',
            startedAt: 1_000,
            updatedAt: 1_100,
            completedAt: 1_100,
          },
        ],
      }),
      [],
      {
        presentation: 'chat',
        runOutcome: 'active',
        toolRuns: [
          {
            id: 'fetch-1',
            name: 'web_fetch',
            status: 'running',
            startedAt: 1_200,
            completedAt: null,
            durationMs: null,
          },
        ],
      }
    );

    expect(model.rows[0]).toMatchObject({
      id: 'unplanned-work',
      title: 'Fetching current conditions.',
      status: 'running',
      meta: '1 action',
    });
    expect(model.rows[0].details).toContainEqual({
      label: 'Actions',
      value: '1 web fetch action running',
    });
  });

  it('reconstructs completed tool-only work when durable activity is missing', () => {
    const model = buildAgentTaskRowsFromActivity(undefined, [], {
      presentation: 'chat',
      runOutcome: 'completed',
      toolRuns: [
        {
          id: 'plan-1',
          name: 'update_plan',
          status: 'completed',
          startedAt: 900,
          completedAt: 950,
          durationMs: 50,
        },
        {
          id: 'fetch-1',
          name: 'web_fetch',
          status: 'completed',
          startedAt: 1_000,
          completedAt: 1_100,
          durationMs: 100,
        },
        {
          id: 'fetch-2',
          name: 'web_fetch',
          status: 'completed',
          startedAt: 1_200,
          completedAt: 1_300,
          durationMs: 100,
        },
        {
          id: 'command-1',
          name: 'exec',
          status: 'completed',
          startedAt: 1_400,
          completedAt: 1_500,
          durationMs: 100,
        },
      ],
    });

    expect(model.autoExpandedId).toBeUndefined();
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      id: 'unplanned-work',
      title: 'Completed agent work',
      subtitle: '2 web fetch actions completed · 1 exec action completed',
      status: 'completed',
      meta: '3 actions',
    });
    expect(model.rows[0].details).toEqual([
      {
        label: 'Actions',
        value: '2 web fetch actions completed · 1 exec action completed',
      },
    ]);
  });

  it('does not turn planning metadata into a completed task row', () => {
    const model = buildAgentTaskRowsFromActivity(undefined, [], {
      presentation: 'chat',
      runOutcome: 'completed',
      toolRuns: [
        {
          id: 'plan-1',
          name: 'update_plan',
          status: 'completed',
          startedAt: 1_000,
          completedAt: 1_100,
          durationMs: 100,
        },
      ],
    });

    expect(model).toEqual({ rows: [] });
  });

  it('reconstructs tool-only work from an explicitly empty activity payload', () => {
    const model = buildAgentTaskRowsFromActivity(activity(), [], {
      presentation: 'chat',
      runOutcome: 'completed',
      toolRuns: [
        {
          id: 'fetch-1',
          name: 'web_fetch',
          status: 'completed',
          startedAt: 1_000,
          completedAt: 1_100,
          durationMs: 100,
        },
      ],
    });

    expect(model.rows[0]).toMatchObject({
      id: 'unplanned-work',
      title: 'Completed agent work',
      subtitle: '1 web fetch action completed',
      status: 'completed',
      meta: '1 action',
    });
  });

  it('projects failed tool-only work without inventing a plan', () => {
    const model = buildAgentTaskRowsFromActivity(activity(), [], {
      presentation: 'chat',
      runOutcome: 'failed',
      failureMessage: 'The weather source failed.',
      toolRuns: [
        {
          id: 'fetch-1',
          name: 'web_fetch',
          status: 'error',
          startedAt: 1_000,
          completedAt: 1_100,
          durationMs: 100,
          error: 'Upstream unavailable',
        },
      ],
    });

    expect(model.rows[0]).toMatchObject({
      id: 'unplanned-work',
      title: 'Agent work',
      subtitle: '1 web fetch action failed',
      status: 'failed',
      meta: '1 action',
    });
    expect(model.rows[0].details).toEqual([
      { label: 'Actions', value: '1 web fetch action failed' },
      { label: 'Error', value: 'Upstream unavailable' },
    ]);
  });

  it('keeps plan steps stable and nests commentary and tools as details', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          explanation: 'Use the normalized event stream.',
          updatedAt: 1_000,
          steps: [
            { id: 'inspect', title: 'Inspect events', status: 'completed' },
            { id: 'wire', title: 'Wire task rows', status: 'running' },
            { id: 'verify', title: 'Verify Messenger', status: 'pending' },
          ],
        },
        items: [
          {
            id: 'commentary-1',
            kind: 'commentary',
            title: 'Preamble',
            status: 'completed',
            planStepId: 'wire',
            startedAt: 1_100,
            updatedAt: 1_200,
            completedAt: 1_200,
            progressText: 'Connecting the live activity snapshot.',
          },
          {
            id: 'tool-1',
            kind: 'tool',
            title: 'read_file',
            name: 'read_file',
            status: 'running',
            planStepId: 'wire',
            startedAt: 1_300,
            updatedAt: 1_300,
            completedAt: null,
          },
        ],
      })
    );

    expect(model.autoExpandedId).toBe('wire');
    expect(
      model.rows.map(({ id, title, status }) => ({ id, title, status }))
    ).toEqual([
      { id: 'inspect', title: 'Inspect events', status: 'completed' },
      { id: 'wire', title: 'Wire task rows', status: 'running' },
      { id: 'verify', title: 'Verify Messenger', status: 'pending' },
    ]);
    expect(model.rows[1]).toMatchObject({
      meta: '2 actions',
      details: [
        {
          label: 'Agent update',
          value: 'Connecting the live activity snapshot.',
        },
        { label: 'Elapsed', value: '100ms' },
        { label: 'Action', value: 'Read file' },
        { label: 'Action status', value: 'Running' },
      ],
    });
  });

  it('renders chat as semantic plan rows with concise progress summaries', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          explanation: 'Compare current conditions with historical records.',
          updatedAt: 1_000,
          steps: [
            {
              id: 'current',
              title: 'Collect current conditions',
              status: 'completed',
            },
            {
              id: 'historical',
              title: 'Find comparable historical records',
              status: 'running',
            },
            {
              id: 'compare',
              title: 'Compare the results',
              status: 'pending',
            },
          ],
        },
        items: [
          {
            id: 'commentary-1',
            kind: 'commentary',
            title: 'Preamble',
            status: 'running',
            planStepId: 'historical',
            startedAt: 1_100,
            updatedAt: 1_100,
            completedAt: null,
            progressText: 'Checking archive coverage for Seoul and Mumbai.',
          },
          ...Array.from({ length: 10 }, (_, index) => ({
            id: `tool-${index}`,
            toolCallId: `call-${index}`,
            kind: 'tool' as const,
            title: 'web_fetch',
            name: 'web_fetch',
            status: 'completed' as const,
            planStepId: 'historical',
            startedAt: 1_200 + index,
            updatedAt: 1_300 + index,
            completedAt: 1_300 + index,
          })),
        ],
      }),
      [],
      { presentation: 'chat' }
    );

    expect(model.autoExpandedId).toBe('historical');
    expect(model.rows).toMatchObject([
      {
        title: 'Collect current conditions',
        subtitle: 'Completed',
        status: 'completed',
      },
      {
        title: 'Find comparable historical records',
        subtitle: 'Checking archive coverage for Seoul and Mumbai.',
        status: 'running',
        meta: '10 actions',
        details: [
          {
            label: 'Latest update',
            value: 'Checking archive coverage for Seoul and Mumbai.',
          },
          {
            label: 'Actions',
            value: '10 web fetch actions completed',
          },
        ],
      },
      {
        title: 'Compare the results',
        subtitle: 'Not started',
        status: 'pending',
      },
    ]);
    expect(model.rows[1].details).toHaveLength(2);
  });

  it('does not present stale ongoing commentary as a completed outcome', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            {
              id: 'historical',
              title: 'Retrieve historical observations',
              status: 'running',
            },
          ],
        },
        items: [
          {
            id: 'commentary-1',
            kind: 'commentary',
            title: 'Preamble',
            status: 'completed',
            planStepId: 'historical',
            startedAt: 1_100,
            updatedAt: 1_200,
            completedAt: 1_200,
            progressText: 'I’m checking three replacement stations.',
          },
          {
            id: 'fetch-1',
            toolCallId: 'fetch-1',
            kind: 'tool',
            title: 'web_fetch',
            name: 'web_fetch',
            status: 'completed',
            planStepId: 'historical',
            startedAt: 1_300,
            updatedAt: 1_400,
            completedAt: 1_400,
          },
        ],
      }),
      [],
      { presentation: 'chat', runOutcome: 'completed' }
    );

    expect(model.rows[0]).toMatchObject({
      status: 'completed',
      subtitle: '1 action completed',
      details: [
        {
          label: 'Last progress update',
          value: 'I’m checking three replacement stations.',
        },
        {
          label: 'Actions',
          value: '1 web fetch action completed',
        },
      ],
    });
  });

  it('keeps context compaction out of user-visible chat action counts', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            {
              id: 'current',
              title: 'Check current temperatures',
              status: 'running',
            },
          ],
        },
        items: [
          {
            id: 'compact-item',
            kind: 'item',
            title: 'Compact context',
            status: 'completed',
            planStepId: 'current',
            startedAt: 1_100,
            updatedAt: 1_200,
            completedAt: 1_200,
          },
          {
            id: 'compaction-event',
            kind: 'compaction',
            title: 'Context compaction',
            status: 'completed',
            planStepId: 'current',
            startedAt: 1_200,
            updatedAt: 1_300,
            completedAt: 1_300,
          },
          {
            id: 'fetch-1',
            kind: 'tool',
            title: 'web_fetch',
            name: 'web_fetch',
            status: 'completed',
            planStepId: 'current',
            startedAt: 1_300,
            updatedAt: 1_400,
            completedAt: 1_400,
          },
        ],
      }),
      [],
      { presentation: 'chat' }
    );

    expect(model.rows[0]).toMatchObject({
      meta: '1 action',
      subtitle: '1 web fetch action completed',
      details: [
        {
          label: 'Actions',
          value: '1 web fetch action completed',
        },
      ],
    });
  });

  it('does not invent commentary tasks in chat when the agent emits no plan', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        items: [
          {
            id: 'commentary-1',
            kind: 'commentary',
            title: 'Preamble',
            status: 'completed',
            progressText: 'Checking live conditions and archive coverage.',
            startedAt: 1_000,
            updatedAt: 1_100,
            completedAt: 1_100,
          },
          {
            id: 'fetch-1-start',
            toolCallId: 'fetch-1',
            kind: 'tool',
            title: 'web_fetch',
            name: 'web_fetch',
            status: 'running',
            startedAt: 1_200,
            updatedAt: 1_200,
            completedAt: null,
          },
          {
            id: 'fetch-1-end',
            toolCallId: 'fetch-1',
            kind: 'tool',
            title: 'web_fetch',
            name: 'web_fetch',
            status: 'completed',
            startedAt: 1_200,
            updatedAt: 1_300,
            completedAt: 1_300,
          },
        ],
      }),
      [],
      { presentation: 'chat' }
    );

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      id: 'unplanned-work',
      title: 'Checking live conditions and archive coverage.',
      subtitle: '1 web fetch action completed',
      status: 'running',
      meta: '1 action',
    });
  });

  it('fails only the active plan step and leaves future work not started', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            { id: 'one', title: 'Collect data', status: 'completed' },
            { id: 'two', title: 'Compare records', status: 'running' },
            { id: 'three', title: 'Write the answer', status: 'pending' },
          ],
        },
      }),
      [],
      { presentation: 'chat', runOutcome: 'failed' }
    );

    expect(model.rows.map((row) => row.status)).toEqual([
      'completed',
      'failed',
      'pending',
    ]);
    expect(model.rows[2].subtitle).toBe('Not started');
  });

  it('keeps unfinished work open when a completed turn is waiting on the user', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            {
              id: 'confirm',
              title: 'Confirm the group name',
              status: 'waiting',
            },
            {
              id: 'create',
              title: 'Create the group and gallery',
              status: 'pending',
            },
            {
              id: 'upload',
              title: 'Upload the photos',
              status: 'pending',
            },
          ],
        },
      }),
      [],
      { presentation: 'chat', runOutcome: 'waiting' }
    );

    expect(model.autoExpandedId).toBe('confirm');
    expect(
      model.rows.map(({ status, subtitle }) => ({ status, subtitle }))
    ).toEqual([
      { status: 'waiting', subtitle: 'Waiting on you' },
      { status: 'pending', subtitle: 'Not started' },
      { status: 'pending', subtitle: 'Not started' },
    ]);
  });

  it('attaches a structured request-input gate to its plan step', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            {
              id: 'confirm',
              title: 'Confirm the exact group name',
              status: 'completed',
            },
            {
              id: 'create',
              title: 'Create the group with you as admin',
              status: 'pending',
            },
            {
              id: 'verify',
              title: 'Verify membership and admin access',
              status: 'pending',
            },
          ],
        },
        items: [
          {
            id: 'input-1',
            kind: 'request_input',
            title: 'Group name needed',
            status: 'waiting',
            planStepId: 'confirm',
            startedAt: 1_000,
            updatedAt: 1_000,
            completedAt: null,
          },
        ],
      }),
      [],
      { presentation: 'chat', runOutcome: 'waiting' }
    );

    expect(model.autoExpandedId).toBe('confirm');
    expect(
      model.rows.map(({ status, subtitle }) => ({ status, subtitle }))
    ).toEqual([
      { status: 'waiting', subtitle: 'Waiting on you' },
      { status: 'pending', subtitle: 'Not started' },
      { status: 'pending', subtitle: 'Not started' },
    ]);
  });

  it('does not invent completion for explicitly pending work in a successful turn', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            { id: 'done', title: 'Collect records', status: 'completed' },
            { id: 'open', title: 'Publish records', status: 'pending' },
          ],
        },
      }),
      [],
      { presentation: 'chat', runOutcome: 'completed' }
    );

    expect(model.rows.map((row) => row.status)).toEqual([
      'completed',
      'pending',
    ]);
  });

  it('settles unfinished rows neutrally for a terminal incomplete plan', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            { id: 'done', title: 'Create the avatar', status: 'completed' },
            { id: 'open', title: 'Apply the avatar', status: 'running' },
            { id: 'queued', title: 'Verify the avatar', status: 'pending' },
          ],
        },
      }),
      [],
      { presentation: 'chat', runOutcome: 'incomplete' }
    );

    expect(
      model.rows.map(({ status, subtitle }) => ({ status, subtitle }))
    ).toEqual([
      { status: 'completed', subtitle: 'Completed' },
      { status: 'pending', subtitle: 'Not finished' },
      { status: 'pending', subtitle: 'Not started' },
    ]);
    expect(model.autoExpandedId).toBeUndefined();
  });

  it('settles a missing terminal snapshot without leaving task spinners', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            { id: 'done', title: 'Create the avatar', status: 'completed' },
            { id: 'open', title: 'Apply the avatar', status: 'running' },
            { id: 'queued', title: 'Verify the avatar', status: 'pending' },
          ],
        },
      }),
      [],
      { presentation: 'chat', runOutcome: 'unavailable' }
    );

    expect(
      model.rows.map(({ status, subtitle }) => ({ status, subtitle }))
    ).toEqual([
      { status: 'completed', subtitle: 'Completed' },
      { status: 'pending', subtitle: 'Status unavailable' },
      { status: 'pending', subtitle: 'Status unavailable' },
    ]);
    expect(model.autoExpandedId).toBeUndefined();
  });

  it('attributes a failed run to its failed event when the plan snapshot is stale', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        plan: {
          updatedAt: 1_000,
          steps: [
            { id: 'one', title: 'Collect current data', status: 'completed' },
            {
              id: 'two',
              title: 'Retrieve historical records',
              status: 'completed',
            },
            { id: 'three', title: 'Compare the results', status: 'pending' },
          ],
        },
        items: [
          {
            id: 'bash-error',
            kind: 'tool',
            title: 'Bash',
            name: 'bash',
            status: 'error',
            planStepId: 'two',
            startedAt: 1_100,
            updatedAt: 1_200,
            completedAt: 1_200,
          },
        ],
      }),
      [],
      {
        presentation: 'chat',
        runOutcome: 'failed',
        failureMessage: 'The archive request failed.',
        toolRuns: [
          {
            id: 'bash-error',
            name: 'bash',
            status: 'running',
            startedAt: 1_100,
            completedAt: null,
            durationMs: null,
          },
        ],
      }
    );

    expect(model.rows.map((row) => row.status)).toEqual([
      'completed',
      'failed',
      'pending',
    ]);
    expect(model.rows[1]).toMatchObject({
      subtitle: 'The archive request failed.',
      details: [
        { label: 'Actions', value: '1 bash action failed' },
        { label: 'Error', value: 'The archive request failed.' },
      ],
    });
    expect(model.rows[2].subtitle).toBe('Not started');
  });

  it('uses commentary as the task title when no plan exists', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        items: [
          {
            id: 'commentary-1',
            kind: 'commentary',
            title: 'Preamble',
            status: 'running',
            progressText: 'Checking the latest OpenClaw event shape.',
            source: 'codex-app-server',
            startedAt: 1_000,
            updatedAt: 1_000,
            completedAt: null,
          },
        ],
      })
    );

    expect(model).toMatchObject({
      autoExpandedId: 'commentary-1',
      rows: [
        {
          id: 'commentary-1',
          title: 'Checking the latest OpenClaw event shape.',
          status: 'running',
        },
      ],
    });
  });

  it('groups tools beneath commentary phases and hides generic reasoning', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        lastEventAt: 5_000,
        items: [
          {
            id: 'reasoning-1',
            kind: 'item',
            title: 'Reasoning',
            status: 'completed',
            startedAt: 1_000,
            updatedAt: 1_100,
            completedAt: 1_100,
          },
          {
            id: 'commentary-1',
            kind: 'commentary',
            title: 'Checking the workspace and GitHub.',
            status: 'completed',
            startedAt: 1_200,
            updatedAt: 2_000,
            completedAt: 2_000,
          },
          {
            id: 'search-1',
            toolCallId: 'call-search',
            kind: 'tool',
            title: 'Web search',
            name: 'web_search',
            status: 'completed',
            startedAt: 1_300,
            updatedAt: 1_600,
            completedAt: 1_600,
          },
          {
            id: 'commentary-2',
            kind: 'commentary',
            title: 'Building the page now, then I’ll publish it.',
            status: 'completed',
            startedAt: 2_100,
            updatedAt: 4_000,
            completedAt: 4_000,
          },
          {
            id: 'patch-1',
            toolCallId: 'call-patch',
            kind: 'tool',
            title: 'Apply patch',
            name: 'apply_patch',
            status: 'running',
            startedAt: 2_200,
            updatedAt: 2_200,
            completedAt: null,
          },
        ],
      }),
      [],
      {
        runOutcome: 'failed',
        toolRuns: [
          {
            id: 'run-patch',
            toolCallId: 'call-patch',
            name: 'apply_patch',
            status: 'completed',
            startedAt: 2_200,
            completedAt: 4_000,
            durationMs: 1_800,
          },
        ],
      }
    );

    expect(model.autoExpandedId).toBe('commentary-2');
    expect(
      model.rows.map(({ title, status, meta }) => ({ title, status, meta }))
    ).toEqual([
      {
        title: 'Checking the workspace and GitHub.',
        status: 'completed',
        meta: '1 action',
      },
      {
        title: 'Building the page now, then I’ll publish it.',
        status: 'failed',
        meta: '1 action',
      },
    ]);
    expect(model.rows[1].details).toEqual([
      { label: 'Action', value: 'Apply patch' },
      { label: 'Action status', value: 'Completed' },
      { label: 'Elapsed', value: '1.8s' },
      {
        label: 'Outcome',
        value: 'The run ended before this task produced a reply.',
      },
    ]);
  });

  it('maps blocked and failed activity to failed rows', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        items: [
          {
            id: 'approval-1',
            kind: 'approval',
            title: 'Run command',
            status: 'blocked',
            startedAt: 1_000,
            updatedAt: 1_100,
            completedAt: 1_100,
          },
        ],
      })
    );

    expect(model.rows[0]).toMatchObject({
      status: 'failed',
    });
    expect(model.rows[0].details).toContainEqual({
      label: 'Status',
      value: 'Blocked',
    });
  });

  it('shows owner-visible tool inputs and useful timing details', () => {
    const model = buildAgentTaskRowsFromActivity(
      activity({
        items: [
          {
            id: 'search-1',
            kind: 'tool',
            title: 'web_search',
            name: 'web_search',
            status: 'completed',
            startedAt: 1_000,
            updatedAt: 2_526,
            completedAt: 2_526,
          },
        ],
      }),
      [],
      {
        includeToolArguments: true,
        toolRuns: [
          {
            id: 'search-1',
            name: 'webrun',
            status: 'completed',
            startedAt: 1_000,
            completedAt: 2_526,
            durationMs: 1_526,
            argumentSummary: '2 keys: search_query, response_length',
            argumentDetail: JSON.stringify({
              search_query: [
                { q: 'best grid infrastructure podcast' },
                { q: 'data center power and cooling podcast' },
              ],
              response_length: 'long',
            }),
          },
        ],
      }
    );

    expect(model.rows[0].details).toEqual([
      { label: 'Action', value: 'Web search' },
      { label: 'Action status', value: 'Completed' },
      {
        label: 'Queries',
        value:
          'best grid infrastructure podcast\ndata center power and cooling podcast',
      },
      { label: 'Search depth', value: 'long' },
      { label: 'Elapsed', value: '1.5s' },
    ]);
  });

  it('adds ephemeral command output to the live row model only', () => {
    const durable = activity({
      plan: {
        updatedAt: 1_000,
        steps: [{ id: 'verify', title: 'Verify the build', status: 'running' }],
      },
    });
    const model = buildAgentTaskRowsFromActivity(durable, [
      {
        schemaVersion: 1,
        runId: 'run-1',
        sequence: 4,
        occurredAt: 1_200,
        kind: 'command',
        phase: 'delta',
        retention: 'ephemeral',
        itemId: 'command-1',
        status: 'running',
        progressText: '843 tests passed',
      },
    ]);

    expect(durable.items).toEqual([]);
    expect(model.rows[0].details).toContainEqual({
      label: 'Command',
      value: '843 tests passed',
    });
  });
});
