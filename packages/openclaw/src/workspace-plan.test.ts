import { A2UI } from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type WorkspaceProposal,
  type WorkspaceProposalStore,
  createWorkspaceCreateToolExecutor,
  createWorkspacePlanToolExecutor,
  noteWorkspacePlanTap,
  quoteTlonArg,
} from './workspace-plan-tool.js';
import {
  buildWorkspacePlanBlob,
  parseWorkspacePlan,
  readWorkspacePlanTap,
} from './workspace-plan.js';

const bikeParts = {
  intro:
    "I can keep all of that in one place. Here's a private workspace to start from.",
  title: 'Bike Parts',
  description:
    'Plan the gravel build: compare parts, keep sources, watch prices.',
  channels: [
    {
      kind: 'chat',
      title: 'Build chat',
      purpose: 'Decisions and questions, starting with a brief',
    },
    {
      kind: 'gallery',
      title: 'Parts gallery',
      purpose: 'Three sourced references to start from',
    },
    {
      kind: 'notebook',
      title: 'Notes',
      purpose: 'Your spec sheet, kept up to date',
    },
  ],
  task: {
    title: 'Sunday price check',
    description: 'A weekly task: I look up prices and post changes',
    schedule: '0 9 * * 0',
    timezone: 'America/Chicago',
    prompt: 'Look up current prices for the parts in the spec sheet.',
  },
};

function memoryStore(): WorkspaceProposalStore & {
  records: Map<string, WorkspaceProposal>;
} {
  const records = new Map<string, WorkspaceProposal>();
  return {
    records,
    register: async (key, value) => {
      records.set(key, structuredClone(value));
    },
    lookup: async (key) => structuredClone(records.get(key)),
    entries: async () =>
      [...records].map(([key, value]) => ({
        key,
        value: structuredClone(value),
        createdAt: value.proposedAt,
      })),
  };
}

function selectionBlob(surfaceId: string, componentId: string) {
  return JSON.stringify([
    {
      type: 'tlon-a2ui-selection',
      version: 1,
      surfaceId,
      componentId,
      values: ['Create the "Bike Parts" workspace'],
    },
  ]);
}

describe('parseWorkspacePlan', () => {
  it('accepts the mockup plan', () => {
    const plan = parseWorkspacePlan(bikeParts);
    expect(plan.channels.map((channel) => channel.kind)).toEqual([
      'chat',
      'gallery',
      'notebook',
    ]);
    expect(plan.task?.timezone).toBe('America/Chicago');
  });

  it.each([
    [{ title: '  ' }, 'title is required'],
    [{ title: 'x'.repeat(61) }, 'title must be at most 60'],
    [{ channels: [] }, 'channels must list 1 to 6'],
    [
      { channels: Array(7).fill(bikeParts.channels[0]) },
      'channels must list 1 to 6',
    ],
    [{ channels: [bikeParts.channels[1]] }, 'first channel must be a chat'],
    [
      { channels: [bikeParts.channels[0], bikeParts.channels[0]] },
      'channel titles must be different',
    ],
    [
      { channels: [{ ...bikeParts.channels[0], kind: 'bucket' }] },
      'kind must be chat, gallery or notebook',
    ],
    [
      { task: { ...bikeParts.task, schedule: 'every sunday' } },
      'five-field cron',
    ],
    [{ task: { ...bikeParts.task, timezone: 'Mars/Base' } }, 'IANA timezone'],
  ])('rejects %j', (patch, message) => {
    expect(() => parseWorkspacePlan({ ...bikeParts, ...patch })).toThrow(
      message
    );
  });
});

describe('workspace card', () => {
  it('is a valid A2UI card with the plan, Edit and Create', () => {
    const plan = parseWorkspacePlan(bikeParts);
    const [entry] = buildWorkspacePlanBlob('workspace-plan-abc', plan);
    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    const components = A2UI.getUpdateMessage(entry)!.updateComponents
      .components as A2UI.Component[];
    const texts = components
      .filter(
        (component): component is A2UI.Text => component.component === 'Text'
      )
      .map((component) => component.text);
    expect(texts).toEqual(
      expect.arrayContaining([
        'New workspace',
        'Only you',
        'Bike Parts',
        'Build chat',
        'Three sourced references to start from',
        'Sunday price check',
        'Edit',
        'Create',
      ])
    );
    const buttons = components.filter(
      (component): component is A2UI.Button => component.component === 'Button'
    );
    expect(buttons.map((button) => button.id)).toEqual(['edit', 'create']);
    expect(buttons[1].action.event).toEqual({
      name: 'tlon.sendMessage',
      context: { text: 'Create the "Bike Parts" workspace' },
    });
  });

  it('reads a tap on its buttons and ignores other cards', () => {
    expect(
      readWorkspacePlanTap(selectionBlob('workspace-plan-abc', 'create'))
    ).toEqual({ proposalId: 'workspace-plan-abc', action: 'create' });
    expect(
      readWorkspacePlanTap(selectionBlob('workspace-plan-abc', 'edit'))
    ).toEqual({ proposalId: 'workspace-plan-abc', action: 'edit' });
    expect(
      readWorkspacePlanTap(selectionBlob('agent-task-plan-1', 'create'))
    ).toBeUndefined();
    expect(readWorkspacePlanTap(null)).toBeUndefined();
  });
});

describe('tlon_workspace_plan', () => {
  it('posts the intro and card and replaces the open card', async () => {
    const store = memoryStore();
    const posted: string[] = [];
    const execute = createWorkspacePlanToolExecutor({
      ownerShip: () => '~ten',
      postText: async (target, text) => posted.push(`${target} ${text}`),
      postCard: async ({ target, fallbackText }) =>
        posted.push(`${target} card ${fallbackText.split('\n')[0]}`),
      store: () => store,
    });
    await execute('1', bikeParts);
    const result = await execute('2', { ...bikeParts, title: 'Gravel Bike' });
    expect(result.content[0].text).toContain('Return NO_REPLY');
    expect(posted).toEqual([
      `~ten ${bikeParts.intro}`,
      '~ten card New workspace: Bike Parts',
      `~ten ${bikeParts.intro}`,
      '~ten card New workspace: Gravel Bike',
    ]);
    const statuses = [...store.records.values()].map(
      (record) => `${record.plan.title}:${record.status}`
    );
    expect(statuses).toEqual(['Bike Parts:superseded', 'Gravel Bike:open']);
  });

  it('reports an invalid plan without posting', async () => {
    const postCard = vi.fn();
    const execute = createWorkspacePlanToolExecutor({
      ownerShip: () => '~ten',
      postText: vi.fn(),
      postCard,
      store: () => memoryStore(),
    });
    const result = await execute('1', { ...bikeParts, channels: [] });
    expect(result.details).toEqual({ error: true });
    expect(postCard).not.toHaveBeenCalled();
  });
});

describe('workspace card taps', () => {
  let store: ReturnType<typeof memoryStore>;
  const proposal = (
    status: WorkspaceProposal['status']
  ): WorkspaceProposal => ({
    proposalId: 'workspace-plan-abc',
    ownerShip: '~ten',
    plan: parseWorkspacePlan(bikeParts),
    status,
    proposedAt: 1,
  });
  beforeEach(() => {
    store = memoryStore();
  });

  it('approves the card on Create and tells the model to create it', async () => {
    await store.register('workspace-plan-abc', proposal('open'));
    const note = await noteWorkspacePlanTap(
      { proposalId: 'workspace-plan-abc', action: 'create' },
      store
    );
    expect(note).toContain(
      'Call tlon_workspace_create with proposalId "workspace-plan-abc"'
    );
    expect(store.records.get('workspace-plan-abc')?.status).toBe('approved');
  });

  it('asks what to change on Edit and approves nothing', async () => {
    await store.register('workspace-plan-abc', proposal('open'));
    const note = await noteWorkspacePlanTap(
      { proposalId: 'workspace-plan-abc', action: 'edit' },
      store
    );
    expect(note).toContain('Ask in one short line what to change');
    expect(store.records.get('workspace-plan-abc')?.status).toBe('open');
  });

  it('creates nothing from a replaced card', async () => {
    await store.register('workspace-plan-abc', proposal('superseded'));
    const note = await noteWorkspacePlanTap(
      { proposalId: 'workspace-plan-abc', action: 'create' },
      store
    );
    expect(note).toContain('Create nothing');
    expect(store.records.get('workspace-plan-abc')?.status).toBe('superseded');
  });
});

describe('tlon_workspace_create', () => {
  let store: ReturnType<typeof memoryStore>;
  let commands: string[];
  let jobs: Array<{ id: string; description?: string }>;
  let failOn: string | undefined;

  const cron = {
    list: async () => jobs,
    add: async (input: { description: string }) => {
      jobs.push({ id: `job-${jobs.length}`, description: input.description });
    },
  };

  function executor() {
    return createWorkspaceCreateToolExecutor({
      store: () => store,
      getCron: () => cron as never,
      runTlon: async (_id, command) => {
        commands.push(command);
        if (failOn && command.startsWith(failOn)) {
          return { ok: false, text: 'Error: poke failed' };
        }
        if (command.startsWith('groups create-owned')) {
          return {
            ok: true,
            text: [
              '✅ Owned group created successfully!',
              '   ID: ~ten/bike-parts',
              '   Channel: chat/~ten/general',
              '   Ref: /1/group/~ten/bike-parts',
            ].join('\n'),
          };
        }
        if (command.startsWith('channels create')) {
          const kind = command.match(/--kind (\w+)/)![1];
          return { ok: true, text: `Nest: ${kind}/~ten/${kind}-1` };
        }
        return { ok: true, text: 'ok' };
      },
    });
  }

  beforeEach(async () => {
    store = memoryStore();
    commands = [];
    jobs = [];
    failOn = undefined;
    await store.register('workspace-plan-abc', {
      proposalId: 'workspace-plan-abc',
      ownerShip: '~ten',
      plan: parseWorkspacePlan(bikeParts),
      status: 'approved',
      proposedAt: 1,
    });
  });

  it('provisions exactly what the card listed', async () => {
    const result = await executor()('call-1', {
      proposalId: 'workspace-plan-abc',
    });
    expect(result.details).toBeUndefined();
    expect(commands).toEqual([
      'groups create-owned "Bike Parts" --admin ~ten --description "Plan the gravel build: compare parts, keep sources, watch prices."',
      'groups set-privacy ~ten/bike-parts secret',
      'channels update chat/~ten/general --title "Build chat" --description "Decisions and questions, starting with a brief"',
      'channels create ~ten/bike-parts "Parts gallery" --kind heap --description "Three sourced references to start from"',
      'channels create ~ten/bike-parts "Notes" --kind notes',
      'groups move-channel ~ten/bike-parts chat/~ten/general --section default --index 0',
      'groups move-channel ~ten/bike-parts heap/~ten/heap-1 --section default --index 1',
      'groups move-channel ~ten/bike-parts notes/~ten/notes-1 --section default --index 2',
    ]);
    expect(jobs).toEqual([
      { id: 'job-0', description: 'tlon-workspace:workspace-plan-abc' },
    ]);
    expect(result.content[0].text).toMatch(/\n\/1\/group\/~ten\/bike-parts$/);
    expect(store.records.get('workspace-plan-abc')).toMatchObject({
      status: 'created',
      groupId: '~ten/bike-parts',
      channelNests: [
        'chat/~ten/general',
        'heap/~ten/heap-1',
        'notes/~ten/notes-1',
      ],
      taskJobId: 'job-0',
    });
  });

  it('makes one workspace from a double tap', async () => {
    const execute = executor();
    const [first, second] = await Promise.all([
      execute('call-1', { proposalId: 'workspace-plan-abc' }),
      execute('call-2', { proposalId: 'workspace-plan-abc' }),
    ]);
    const third = await execute('call-3', { proposalId: 'workspace-plan-abc' });
    expect(
      commands.filter((command) => command.startsWith('groups create-owned'))
    ).toHaveLength(1);
    expect(jobs).toHaveLength(1);
    expect(second.content[0].text).toBe(first.content[0].text);
    expect(third.content[0].text).toContain('Already created');
    expect(third.content[0].text).toContain('/1/group/~ten/bike-parts');
  });

  it('resumes a failed create without a second workspace', async () => {
    failOn = 'channels create ~ten/bike-parts "Notes"';
    const failed = await executor()('call-1', {
      proposalId: 'workspace-plan-abc',
    });
    expect(failed.details).toEqual({ error: true });
    expect(failed.content[0].text).toContain('creating Notes failed');
    failOn = undefined;
    commands = [];
    const resumed = await executor()('call-2', {
      proposalId: 'workspace-plan-abc',
    });
    expect(resumed.details).toBeUndefined();
    expect(commands).toEqual([
      'channels create ~ten/bike-parts "Notes" --kind notes',
      'groups move-channel ~ten/bike-parts chat/~ten/general --section default --index 0',
      'groups move-channel ~ten/bike-parts heap/~ten/heap-1 --section default --index 1',
      'groups move-channel ~ten/bike-parts notes/~ten/notes-1 --section default --index 2',
    ]);
  });

  it('remembers a group whose admin grant failed', async () => {
    const execute = createWorkspaceCreateToolExecutor({
      store: () => store,
      getCron: () => cron as never,
      runTlon: async (_id, command) => {
        commands.push(command);
        return {
          ok: false,
          text: 'Error: Created ~ten/bike-parts (Ref: /1/group/~ten/bike-parts), but making ~zod its admin failed',
        };
      },
    });
    await execute('call-1', { proposalId: 'workspace-plan-abc' });
    expect(store.records.get('workspace-plan-abc')?.groupId).toBe(
      '~ten/bike-parts'
    );
  });

  it('refuses a card the owner has not tapped Create on', async () => {
    await store.register('workspace-plan-abc', {
      ...store.records.get('workspace-plan-abc')!,
      status: 'open',
    });
    const result = await executor()('call-1', {
      proposalId: 'workspace-plan-abc',
    });
    expect(result.content[0].text).toContain('has not tapped Create');
    expect(commands).toEqual([]);
  });

  it('quotes titles for the tlon tool', () => {
    expect(quoteTlonArg('Mom\'s "Big" Move\\')).toBe(
      '"Mom\'s \\"Big\\" Move\\\\"'
    );
  });
});
