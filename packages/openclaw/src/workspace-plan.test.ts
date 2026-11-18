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
    expect(result.content[0].text).not.toContain('Return NO_REPLY now');
    expect(result.content[0].text).toContain("answer the owner's message");
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

  it('keeps the open card when its replacement fails to post', async () => {
    const store = memoryStore();
    let failCard = false;
    const execute = createWorkspacePlanToolExecutor({
      ownerShip: () => '~ten',
      postText: async () => undefined,
      postCard: async () => {
        if (failCard) throw new Error('poke failed');
      },
      store: () => store,
    });
    await execute('1', bikeParts);
    failCard = true;
    const result = await execute('2', { ...bikeParts, title: 'Gravel Bike' });
    expect(result.details).toEqual({ error: true });
    const bikePartsRecord = [...store.records.values()].find(
      (record) => record.plan.title === 'Bike Parts'
    );
    expect(bikePartsRecord?.status).toBe('open');
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

  const kitchenAnswer =
    'Start with demolition and rough plumbing,\nthen cabinets, then counters.';

  function planExecutor(store: ReturnType<typeof memoryStore>) {
    const posted: string[] = [];
    let now = 0;
    const execute = createWorkspacePlanToolExecutor({
      ownerShip: () => '~ten',
      postText: async (target, text) => posted.push(`${target} ${text}`),
      postCard: async () => undefined,
      store: () => store,
      now: () => (now += 1),
    });
    return { execute, posted };
  }

  it('stores the answer and posts it in the DM after the card', async () => {
    const store = memoryStore();
    const posted: string[] = [];
    const execute = createWorkspacePlanToolExecutor({
      ownerShip: () => '~ten',
      postText: async (target, text) => posted.push(`${target} ${text}`),
      postAnswer: async (target, text) =>
        posted.push(`${target} answer ${text}`),
      postCard: async ({ target }) => posted.push(`${target} card`),
      store: () => store,
    });
    const result = await execute('1', { ...bikeParts, answer: kitchenAnswer });
    expect(result.content[0].text).toContain('do not write it again');
    expect(result.content[0].text).toContain('Return NO_REPLY now');
    const [record] = store.records.values();
    expect(record.answer).toBe(kitchenAnswer);
    expect(posted).toEqual([
      `~ten ${bikeParts.intro}`,
      '~ten card',
      `~ten answer ${kitchenAnswer}`,
    ]);
  });

  it('hands the answer back to the model when posting it fails', async () => {
    const store = memoryStore();
    const execute = createWorkspacePlanToolExecutor({
      ownerShip: () => '~ten',
      postText: async () => undefined,
      postAnswer: async () => {
        throw new Error('nack');
      },
      postCard: async () => undefined,
      store: () => store,
    });
    const result = await execute('1', { ...bikeParts, answer: kitchenAnswer });
    expect(result.details).toBeUndefined();
    expect(result.content[0].text).toContain('Posting your answer failed');
    expect([...store.records.values()][0].answer).toBe(kitchenAnswer);
  });

  it('keeps the answer through Edit when the revision omits it', async () => {
    const store = memoryStore();
    const { execute, posted } = planExecutor(store);
    await execute('1', { ...bikeParts, answer: kitchenAnswer });
    const [first] = store.records.values();
    await noteWorkspacePlanTap(
      { proposalId: first.proposalId, action: 'edit' },
      store
    );
    const before = posted.length;
    await execute('2', { ...bikeParts, title: 'Gravel Bike' });
    const revised = [...store.records.values()].find(
      (record) => record.plan.title === 'Gravel Bike'
    );
    expect(revised?.answer).toBe(kitchenAnswer);
    // The inherited answer is already in the DM: only the intro and card.
    expect(posted.slice(before)).toEqual([`~ten ${bikeParts.intro}`]);
    expect(store.records.get(first.proposalId)?.status).toBe('superseded');
  });

  it('does not carry an answer to a new card without an Edit', async () => {
    const store = memoryStore();
    const { execute } = planExecutor(store);
    await execute('1', { ...bikeParts, answer: kitchenAnswer });
    await execute('2', { ...bikeParts, title: 'Gravel Bike' });
    const second = [...store.records.values()].find(
      (record) => record.plan.title === 'Gravel Bike'
    );
    expect(second?.answer).toBeUndefined();
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
  let syncs: number[];
  let syncFails: boolean;

  const cron = {
    list: async () => jobs,
    add: async (input: { description: string }) => {
      jobs.push({ id: `job-${jobs.length}`, description: input.description });
    },
  };

  async function runTlon(_id: string, command: string) {
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
  }

  function executor(
    postText?: (target: string, text: string) => Promise<unknown>
  ) {
    return createWorkspaceCreateToolExecutor({
      store: () => store,
      getCron: () => cron as never,
      postText,
      // Records how many jobs existed when the mirror was asked to sync.
      syncTasks: async () => {
        syncs.push(jobs.length);
        if (syncFails) throw new Error('steward unreachable');
      },
      runTlon,
    });
  }

  beforeEach(async () => {
    store = memoryStore();
    commands = [];
    jobs = [];
    failOn = undefined;
    syncs = [];
    syncFails = false;
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

  it("posts the workspace's card to the owner itself", async () => {
    const posts: Array<[string, string]> = [];
    const execute = executor(async (target, text) => {
      posts.push([target, text]);
    });
    const created = await execute('call-1', {
      proposalId: 'workspace-plan-abc',
    });
    expect(posts).toEqual([['~ten', '/1/group/~ten/bike-parts']]);
    expect(created.content[0].text).toContain("don't write its link");
    expect(created.content[0].text).not.toContain('/1/group/');
    // A second tap posts it again and still makes nothing.
    const again = await execute('call-2', { proposalId: 'workspace-plan-abc' });
    expect(again.content[0].text).toContain('Already created');
    expect(posts).toHaveLength(2);
    expect(
      commands.filter((command) => command.startsWith('groups create-owned'))
    ).toHaveLength(1);
  });

  it('hands the model the link when posting the card fails', async () => {
    const created = await executor(async () => {
      throw new Error('ship unreachable');
    })('call-1', { proposalId: 'workspace-plan-abc' });
    expect(created.details).toBeUndefined();
    expect(created.content[0].text).toMatch(/\n\/1\/group\/~ten\/bike-parts$/);
  });

  describe('with an answer from the DM', () => {
    const answer = 'Demolition first,\nthen plumbing.';
    beforeEach(async () => {
      const record = store.records.get('workspace-plan-abc')!;
      await store.register('workspace-plan-abc', { ...record, answer });
    });

    it('posts it first in the workspace chat', async () => {
      const posts: Array<[string, string]> = [];
      const created = await executor(async (target, text) => {
        posts.push([target, text]);
      })('call-1', { proposalId: 'workspace-plan-abc' });
      expect(posts).toEqual([
        ['chat/~ten/general', answer],
        ['~ten', '/1/group/~ten/bike-parts'],
      ]);
      expect(created.content[0].text).toContain(
        "already opens with your answer from the DM; don't post it again"
      );
      expect(store.records.get('workspace-plan-abc')?.answerPosted).toBe(true);
    });

    it('does not post it twice on a retry', async () => {
      const posts: string[] = [];
      const post = async (target: string) => {
        posts.push(target);
      };
      failOn = 'groups move-channel';
      const failed = await executor(post)('call-1', {
        proposalId: 'workspace-plan-abc',
      });
      expect(failed.details).toEqual({ error: true });
      expect(posts).toEqual([]);
      failOn = undefined;
      await executor(post)('call-2', { proposalId: 'workspace-plan-abc' });
      await executor(post)('call-3', { proposalId: 'workspace-plan-abc' });
      expect(posts.filter((target) => target === 'chat/~ten/general')).toEqual([
        'chat/~ten/general',
      ]);
    });

    it('retries the answer when its post failed', async () => {
      let fail = true;
      const posts: string[] = [];
      const post = async (target: string) => {
        if (fail && target === 'chat/~ten/general') throw new Error('nack');
        posts.push(target);
      };
      const failed = await executor(post)('call-1', {
        proposalId: 'workspace-plan-abc',
      });
      expect(failed.content[0].text).toContain(
        'posting your answer in chat/~ten/general failed'
      );
      fail = false;
      await executor(post)('call-2', { proposalId: 'workspace-plan-abc' });
      expect(posts).toEqual(['chat/~ten/general', '~ten']);
      expect(
        commands.filter((command) => command.startsWith('groups create-owned'))
      ).toHaveLength(1);
    });
  });

  it('posts nothing extra without an answer', async () => {
    const posts: Array<[string, string]> = [];
    const created = await executor(async (target, text) => {
      posts.push([target, text]);
    })('call-1', { proposalId: 'workspace-plan-abc' });
    expect(posts).toEqual([['~ten', '/1/group/~ten/bike-parts']]);
    expect(created.content[0].text).not.toContain('your answer');
  });

  it("mirrors the task into the owner's task list once it is added", async () => {
    await executor()('call-1', { proposalId: 'workspace-plan-abc' });
    expect(syncs).toEqual([1]);
  });

  it('still creates the workspace when the task mirror fails', async () => {
    syncFails = true;
    const result = await executor()('call-1', {
      proposalId: 'workspace-plan-abc',
    });
    expect(result.details).toBeUndefined();
    expect(store.records.get('workspace-plan-abc')?.status).toBe('created');
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

  it('keeps a notebook whose verification failed', async () => {
    const failed = await createWorkspaceCreateToolExecutor({
      store: () => store,
      getCron: () => cron as never,
      runTlon: async (id, command) =>
        command.startsWith('channels create ~ten/bike-parts "Notes"')
          ? {
              ok: false,
              text: 'Error: %notes created notes/~ten/notes-1, but its readers could not be verified: timeout.',
            }
          : runTlon(id, command),
    })('call-1', { proposalId: 'workspace-plan-abc' });
    expect(failed.details).toEqual({ error: true });
    commands = [];
    const resumed = await executor()('call-2', {
      proposalId: 'workspace-plan-abc',
    });
    expect(resumed.details).toBeUndefined();
    expect(
      commands.filter((command) => command.startsWith('channels create'))
    ).toEqual([]);
  });

  it('remembers a group whose admin grant failed', async () => {
    const execute = createWorkspaceCreateToolExecutor({
      store: () => store,
      getCron: () => cron as never,
      runTlon: async (_id, command) => {
        commands.push(command);
        return {
          ok: false,
          text: 'Error: Created ~ten/bike-parts (Ref: /1/group/~ten/bike-parts) with its chat chat/~ten/general, but making ~zod its admin failed',
        };
      },
    });
    await execute('call-1', { proposalId: 'workspace-plan-abc' });
    expect(store.records.get('workspace-plan-abc')).toMatchObject({
      groupId: '~ten/bike-parts',
      defaultChannelNest: 'chat/~ten/general',
    });
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
