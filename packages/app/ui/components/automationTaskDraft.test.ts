import type { StewardAutomationTask } from '@tloncorp/api/urbit';
import { describe, expect, it } from 'vitest';

import {
  applyAutomationUpdate,
  applyTaskPatch,
  botDeliveryFrom,
  buildTaskCreate,
  buildTaskUpdate,
  canEditPrompt,
  cronExpressionFor,
  describeAutomationError,
  destinationForChannel,
  destinationFromDelivery,
  draftFromTask,
  firstDestinationIn,
  groupsMissingBot,
  isTaskFromCreate,
  newTaskDraft,
  offersScheduledTasks,
  parseEditableSchedule,
  snapshotAfterCreate,
  snapshotAfterRead,
  taskStatus,
  tasksPostingTo,
  tasksRemoved,
  taskTitle,
  validateDraft,
} from './automationTaskDraft';

const task: StewardAutomationTask = {
  name: 'Morning news',
  enabled: true,
  schedule: {
    kind: 'cron',
    expr: '0 7 * * 1-5',
    tz: 'America/New_York',
    staggerMs: 45_000,
  },
  sessionTarget: 'isolated',
  wakeMode: 'now',
  payload: {
    kind: 'agentTurn',
    message: 'Summarize the news.',
    toolsAllow: ['group:web'],
  },
  delivery: {
    mode: 'announce',
    channel: 'tlon',
    to: 'notes/~zod/updates-1',
    failureDestination: {
      mode: 'announce',
      channel: 'tlon',
      to: 'chat/~zod/general',
    },
  },
};

describe('parseEditableSchedule', () => {
  it.each([
    ['0 7 * * 1-5', { days: [1, 2, 3, 4, 5], hour: 7, minute: 0 }],
    ['30 18 * * *', { days: [0, 1, 2, 3, 4, 5, 6], hour: 18, minute: 30 }],
    ['0 9 * * 1', { days: [1], hour: 9, minute: 0 }],
    ['0 9 * * 6,0', { days: [0, 6], hour: 9, minute: 0 }],
    ['0 9 * * 7', { days: [0], hour: 9, minute: 0 }],
    ['0 9 * * 5-7', { days: [0, 5, 6], hour: 9, minute: 0 }],
    ['0 9 * * MON,wed', { days: [1, 3], hour: 9, minute: 0 }],
    ['0 9 * * 0-7', { days: [0, 1, 2, 3, 4, 5, 6], hour: 9, minute: 0 }],
    ['0 9 * * fri-mon', { days: [0, 1, 5, 6], hour: 9, minute: 0 }],
  ])('reads %s as a weekly time', (expr, expected) => {
    expect(parseEditableSchedule({ kind: 'cron', expr })).toEqual(expected);
  });

  it.each([
    '0 10 1 * *',
    '30 8 15 3 *',
    '*/15 * * * *',
    '0 */4 * * *',
    '0 9 * * 1-',
    '0 9 * * 8',
    '0 9 * *',
  ])('leaves %s to the bot', (expr) => {
    expect(parseEditableSchedule({ kind: 'cron', expr })).toBeNull();
  });

  it('does not offer interval or one-time schedules for editing', () => {
    expect(
      parseEditableSchedule({ kind: 'every', everyMs: 60_000 })
    ).toBeNull();
    expect(parseEditableSchedule({ kind: 'at', at: 1 })).toBeNull();
    expect(parseEditableSchedule(undefined)).toBeNull();
  });
});

describe('cronExpressionFor', () => {
  it('writes every day as a wildcard and other sets as a list', () => {
    expect(
      cronExpressionFor({ days: [0, 1, 2, 3, 4, 5, 6], hour: 7, minute: 5 })
    ).toBe('5 7 * * *');
    expect(cronExpressionFor({ days: [3, 1, 1], hour: 0, minute: 0 })).toBe(
      '0 0 * * 1,3'
    );
  });
});

describe('destinationFromDelivery', () => {
  it.each([
    [undefined, { kind: 'none' }],
    [{ mode: 'none', channel: 'last' }, { kind: 'none' }],
    [{ mode: 'announce', channel: 'tlon' }, { kind: 'none' }],
    [
      { mode: 'announce', channel: 'tlon', to: '~sampel-palnet' },
      { kind: 'dm', ship: '~sampel-palnet' },
    ],
    [
      { mode: 'announce', channel: 'tlon', to: 'dm/~zod' },
      { kind: 'dm', ship: '~zod' },
    ],
    [
      { mode: 'announce', to: 'tlon:chat/~zod/general' },
      { kind: 'channel', nest: 'chat/~zod/general' },
    ],
    [
      { mode: 'announce', channel: 'tlon', to: 'group:notes/~zod/updates-1' },
      { kind: 'channel', nest: 'notes/~zod/updates-1' },
    ],
    [
      { mode: 'announce', channel: 'last' },
      { kind: 'other', label: 'Most recent conversation' },
    ],
    [
      { mode: 'announce', channel: 'telegram', to: '12345' },
      { kind: 'other', label: '12345' },
    ],
    [
      { mode: 'webhook', to: 'https://example.com' },
      { kind: 'other', label: 'Webhook' },
    ],
    [
      { mode: 'announce', channel: 'tlon', to: 'zod' },
      { kind: 'dm', ship: '~zod' },
    ],
    [
      { mode: 'announce', channel: 'tlon', to: 'Chat/~Zod/General' },
      { kind: 'channel', nest: 'chat/~zod/General' },
    ],
    [
      { mode: 'announce', channel: 'tlon', to: 'group:~zod/general' },
      { kind: 'channel', nest: 'chat/~zod/general' },
    ],
    [
      { mode: 'announce', channel: 'tlon', to: 'buckets/~zod/files' },
      { kind: 'other', label: 'buckets/~zod/files' },
    ],
    [
      { mode: 'announce', channel: 'tlon', to: 'somewhere odd' },
      { kind: 'other', label: 'somewhere odd' },
    ],
  ] as const)('reads %j', (delivery, expected) => {
    expect(destinationFromDelivery(delivery)).toEqual(expected);
  });
});

describe('task labels', () => {
  it('reports a credit hold apart from an ordinary pause', () => {
    expect(taskStatus(task)).toBe('active');
    expect(taskStatus({ ...task, enabled: false })).toBe('paused');
    expect(
      taskStatus({
        ...task,
        enabled: false,
        description: '[Paused: credit budget] Daily digest',
      })
    ).toBe('held');
    expect(
      taskStatus({
        ...task,
        enabled: false,
        description: '[Paused: credit budget]',
      })
    ).toBe('held');
  });

  it('never shows the plugin markers as a title', () => {
    expect(
      taskTitle({ description: '[Paused: credit budget] Daily digest' })
    ).toBe('Daily digest');
    expect(taskTitle({ description: 'tlon-agent-primary:~zod/home' })).toBe(
      'Untitled task'
    );
    expect(taskTitle(task)).toBe('Morning news');
  });

  it("only lets a prompt change for a payload kind the bot's edit path takes", () => {
    expect(canEditPrompt(task)).toBe(true);
    expect(
      canEditPrompt({
        ...task,
        payload: { kind: 'systemEvent', message: 'hi' },
      })
    ).toBe(true);
    expect(
      canEditPrompt({ ...task, payload: { kind: 'webhook', message: 'hi' } })
    ).toBe(false);
    expect(canEditPrompt({ ...task, payload: { message: 'hi' } })).toBe(false);
    expect(canEditPrompt({ name: 'bare' })).toBe(false);
  });
});

describe('buildTaskUpdate', () => {
  it('sends nothing when nothing changed', () => {
    expect(buildTaskUpdate(task, draftFromTask(task))).toBeNull();
  });

  it('leaves the prompt out of the patch for a payload kind the bot would refuse', () => {
    const other = { ...task, payload: { kind: 'webhook', message: 'old' } };
    const draft = { ...draftFromTask(other), name: 'Renamed', prompt: 'new' };
    expect(buildTaskUpdate(other, draft)).toEqual({ name: 'Renamed' });
  });

  it('keeps an untouched schedule out of the patch even if it would reformat', () => {
    const draft = { ...draftFromTask(task), name: 'Evening news' };
    expect(buildTaskUpdate(task, draft)).toEqual({ name: 'Evening news' });
  });

  it('patches the prompt by payload kind without resending the tool list', () => {
    const draft = { ...draftFromTask(task), prompt: 'Only science news.' };
    expect(buildTaskUpdate(task, draft)).toEqual({
      payload: { kind: 'agentTurn', message: 'Only science news.' },
    });
  });

  it('leaves the prompt alone when the payload kind is unknown', () => {
    const untyped = { ...task, payload: { message: 'hi' } };
    const draft = { ...draftFromTask(untyped), prompt: 'changed' };
    expect(buildTaskUpdate(untyped, draft)).toBeNull();
  });

  it('carries the timezone and stagger over a schedule change', () => {
    const draft = {
      ...draftFromTask(task),
      schedule: { days: [1, 3], hour: 18, minute: 30 },
    };
    expect(buildTaskUpdate(task, draft)).toEqual({
      schedule: {
        kind: 'cron',
        expr: '30 18 * * 1,3',
        tz: 'America/New_York',
        staggerMs: 45_000,
      },
    });
  });

  it('sends only the announce target for a new destination', () => {
    const draft = {
      ...draftFromTask(task),
      destination: { kind: 'dm', ship: '~sampel-palnet' } as const,
    };
    expect(buildTaskUpdate(task, draft)).toEqual({
      delivery: { mode: 'announce', channel: 'tlon', to: '~sampel-palnet' },
    });
  });

  it('never sends a description', () => {
    const slot = { ...task, description: 'tlon-agent-primary:~zod/home' };
    const draft = { ...draftFromTask(slot), name: 'Renamed' };
    expect(buildTaskUpdate(slot, draft)).toEqual({ name: 'Renamed' });
  });
});

describe('buildTaskCreate', () => {
  it('fills in everything the bot requires of a new job', () => {
    const draft = {
      ...newTaskDraft('~sampel-palnet'),
      name: ' Standup ',
      prompt: ' Ask for updates. ',
    };
    expect(buildTaskCreate(draft, { timezone: 'Europe/Berlin' })).toEqual({
      name: 'Standup',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '0 9 * * 1,2,3,4,5',
        tz: 'Europe/Berlin',
      },
      sessionTarget: 'isolated',
      wakeMode: 'now',
      payload: { kind: 'agentTurn', message: 'Ask for updates.' },
      delivery: { mode: 'announce', channel: 'tlon', to: '~sampel-palnet' },
    });
  });
});

describe('validateDraft', () => {
  const draft = {
    ...newTaskDraft('~sampel-palnet'),
    name: 'Standup',
    prompt: 'Ask for updates.',
  };

  it('accepts a complete new task', () => {
    expect(validateDraft(draft, { isNew: true })).toBeNull();
  });

  it('names the first missing piece', () => {
    expect(validateDraft({ ...draft, name: ' ' }, { isNew: true })).toBe(
      'Give the task a name.'
    );
    expect(validateDraft({ ...draft, prompt: '' }, { isNew: true })).toBe(
      'Say what the bot should do.'
    );
    expect(
      validateDraft(
        { ...draft, schedule: { days: [], hour: 9, minute: 0 } },
        { isNew: true }
      )
    ).toBe('Pick at least one day.');
    expect(
      validateDraft(
        { ...draft, destination: { kind: 'none' } },
        { isNew: true }
      )
    ).toBe('Choose where the task posts.');
  });

  it('lets an existing task keep a schedule and destination it cannot edit', () => {
    expect(
      validateDraft(
        { ...draft, prompt: '', schedule: null, destination: { kind: 'none' } },
        { isNew: false }
      )
    ).toBeNull();
  });

  it('lets a task the bot made without a name be saved without one', () => {
    const nameless = { ...draft, name: '' };
    expect(validateDraft(nameless, { isNew: false, named: false })).toBeNull();
    // A name it has cannot be cleared, and a new task still needs one.
    expect(validateDraft(nameless, { isNew: false, named: true })).toBe(
      'Give the task a name.'
    );
    expect(validateDraft(nameless, { isNew: false })).toBe(
      'Give the task a name.'
    );
    expect(validateDraft(nameless, { isNew: true, named: false })).toBe(
      'Give the task a name.'
    );
  });
});

describe('applyTaskPatch', () => {
  it('merges payload and delivery one field deep, as the host does', () => {
    const patched = applyTaskPatch(task, {
      enabled: false,
      payload: { kind: 'agentTurn', message: 'New prompt.' },
      delivery: { mode: 'announce', channel: 'tlon', to: '~zod' },
    });
    expect(patched.enabled).toBe(false);
    expect(patched.payload).toEqual({
      kind: 'agentTurn',
      message: 'New prompt.',
      toolsAllow: ['group:web'],
    });
    expect(patched.delivery?.to).toBe('~zod');
    expect(patched.delivery?.failureDestination).toEqual(
      task.delivery?.failureDestination
    );
  });
});

describe('applyAutomationUpdate', () => {
  const snapshot = {
    available: true,
    tasks: { '~bot': { a: task, b: { name: 'Other' } } },
  };

  it('replaces the mirror on a full snapshot', () => {
    expect(applyAutomationUpdate(undefined, { tasks: { '~bot': {} } })).toEqual(
      { available: true, tasks: { '~bot': {} } }
    );
  });

  it('sets one task, creating the ship entry when it is missing', () => {
    const next = applyAutomationUpdate(snapshot, {
      set: { ship: '~new', id: 'c', task: { name: 'Fresh' } },
    });
    expect(next.tasks['~new']).toEqual({ c: { name: 'Fresh' } });
    expect(next.tasks['~bot']).toBe(snapshot.tasks['~bot']);
  });

  it('removes one task and keeps an emptied entry as synced', () => {
    const next = applyAutomationUpdate(
      applyAutomationUpdate(snapshot, { del: { ship: '~bot', id: 'a' } }),
      { del: { ship: '~bot', id: 'b' } }
    );
    expect(next.tasks['~bot']).toEqual({});
  });

  it('drops a ship entry when its bot is gone', () => {
    const next = applyAutomationUpdate(snapshot, { gone: { ship: '~bot' } });
    expect(next.tasks).toEqual({});
  });

  it('ignores a delete for a ship it has never seen', () => {
    const next = applyAutomationUpdate(snapshot, {
      del: { ship: '~other', id: 'a' },
    });
    expect(next.tasks).toEqual(snapshot.tasks);
  });
});

describe('snapshotAfterCreate', () => {
  const created = { name: 'Morning news', enabled: true };

  it('adds the task as it was asked for when the mirror does not have it yet', () => {
    const next = snapshotAfterCreate(
      { available: true, tasks: { '~bot': { a: task } } },
      '~bot',
      'new',
      created
    );
    expect(next.tasks['~bot']).toEqual({ a: task, new: created });
    expect(
      snapshotAfterCreate(undefined, '~bot', 'new', created).tasks
    ).toEqual({ '~bot': { new: created } });
  });

  it("keeps the bot's own copy when it reached the mirror first", () => {
    const projected: StewardAutomationTask = {
      ...created,
      schedule: { kind: 'cron', staggerMs: 300 },
    };
    const snapshot = { available: true, tasks: { '~bot': { new: projected } } };
    expect(snapshotAfterCreate(snapshot, '~bot', 'new', created)).toBe(
      snapshot
    );
  });
});

describe('tasksRemoved', () => {
  const other = { name: 'Other' };
  const snapshot = {
    available: true,
    tasks: { '~bot': { a: task, b: other }, '~two': { a: other } },
  };
  const after = (update: Parameters<typeof applyAutomationUpdate>[1]) =>
    tasksRemoved(snapshot, applyAutomationUpdate(snapshot, update));

  it('finds nothing when a task is added or changed', () => {
    expect(
      after({ set: { ship: '~bot', id: 'c', task: { name: 'Fresh' } } })
    ).toEqual([]);
    expect(
      after({ set: { ship: '~bot', id: 'a', task: { name: 'Renamed' } } })
    ).toEqual([]);
  });

  it('finds a deleted task', () => {
    expect(after({ del: { ship: '~bot', id: 'a' } })).toEqual([
      { ship: '~bot', task },
    ]);
  });

  it('finds what a whole new set of tasks leaves out', () => {
    expect(after({ tasks: { '~bot': { b: other }, '~two': {} } })).toEqual([
      { ship: '~bot', task },
      { ship: '~two', task: other },
    ]);
  });

  it('finds every task of a bot that is gone', () => {
    expect(after({ gone: { ship: '~bot' } })).toEqual([
      { ship: '~bot', task },
      { ship: '~bot', task: other },
    ]);
  });

  it('finds nothing before there was a mirror', () => {
    expect(tasksRemoved(undefined, snapshot)).toEqual([]);
  });
});

describe('destinationForChannel', () => {
  const delivery = {
    botShip: '~zod',
    ownerShip: '~ten',
    botGroupIds: new Set(['~ten/with-bot']),
    botRoles: new Map([['~ten/with-bot', new Set(['helper'])]]),
    writerRoles: new Map<string, string[]>(),
    readerRoles: new Map<string, string[]>(),
  };
  const channel = (id: string, type: string, groupId?: string) => ({
    id,
    type,
    groupId,
  });

  it("posts to the owner through the bot's own DM, and no other", () => {
    expect(destinationForChannel(channel('~zod', 'dm'), delivery)).toEqual({
      kind: 'dm',
      ship: '~ten',
    });
    expect(destinationForChannel(channel('~bus', 'dm'), delivery)).toBeNull();
    expect(
      destinationForChannel(channel('0v4.abcde', 'groupDm'), delivery)
    ).toBeNull();
  });

  it.each([
    ['chat/~ten/general', 'chat'],
    ['heap/~ten/links', 'gallery'],
    ['diary/~ten/journal', 'notebook'],
    ['notes/~ten/wiki', 'notes'],
  ])('offers %s in a group the bot has joined', (id, type) => {
    expect(
      destinationForChannel(channel(id, type, '~ten/with-bot'), delivery)
    ).toEqual({ kind: 'channel', nest: id });
  });

  it('leaves out a channel in a group the bot has not joined', () => {
    expect(
      destinationForChannel(
        channel('chat/~ten/general', 'chat', '~ten/without-bot'),
        delivery
      )
    ).toBeNull();
    expect(
      destinationForChannel(channel('chat/~ten/general', 'chat'), delivery)
    ).toBeNull();
    expect(
      destinationForChannel(
        channel('chat/~ten/general', 'chat', '~ten/with-bot'),
        {
          ...delivery,
          botGroupIds: new Set(),
        }
      )
    ).toBeNull();
  });

  it('leaves out a channel only other roles may write in', () => {
    const announcements = channel(
      'chat/~ten/announcements',
      'chat',
      '~ten/with-bot'
    );
    const restricted = (roles: string[]) => ({
      ...delivery,
      writerRoles: new Map([['chat/~ten/announcements', roles]]),
    });
    expect(
      destinationForChannel(announcements, restricted(['admin']))
    ).toBeNull();
    expect(
      destinationForChannel(announcements, restricted(['admin', 'helper']))
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/announcements' });
    // A restriction on one channel says nothing about the next one.
    expect(
      destinationForChannel(
        channel('chat/~ten/general', 'chat', '~ten/with-bot'),
        restricted(['admin'])
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/general' });
    // No roles at all in the group: only unrestricted channels.
    expect(
      destinationForChannel(announcements, {
        ...restricted(['admin']),
        botRoles: new Map(),
      })
    ).toBeNull();
  });

  it('leaves out a channel the bot may not read, whoever may write there', () => {
    const lounge = channel('chat/~ten/lounge', 'chat', '~ten/with-bot');
    const withRoles = (readers: string[], writers: string[] = []) => ({
      ...delivery,
      readerRoles: new Map([['chat/~ten/lounge', readers]]),
      writerRoles: new Map([['chat/~ten/lounge', writers]]),
    });
    const offered = { kind: 'channel', nest: 'chat/~ten/lounge' };

    // Readers are restricted and writers are not: the group counts nobody
    // who cannot read the channel among its writers.
    expect(destinationForChannel(lounge, withRoles(['member']))).toBeNull();
    expect(destinationForChannel(lounge, withRoles(['helper']))).toEqual(
      offered
    );
    // It must pass both: read with one role and write with one.
    expect(
      destinationForChannel(lounge, withRoles(['helper'], ['member']))
    ).toBeNull();
    expect(
      destinationForChannel(lounge, withRoles(['member'], ['helper']))
    ).toBeNull();
    expect(
      destinationForChannel(lounge, withRoles(['helper'], ['helper', 'member']))
    ).toEqual(offered);
  });

  it('offers every channel to a bot that is an admin or hosts the group', () => {
    const locked = {
      ...delivery,
      readerRoles: new Map([['chat/~ten/lounge', ['member']]]),
      writerRoles: new Map([['chat/~ten/lounge', ['member']]]),
    };
    expect(
      destinationForChannel(
        channel('chat/~ten/lounge', 'chat', '~ten/with-bot'),
        {
          ...locked,
          botRoles: new Map([['~ten/with-bot', new Set(['admin'])]]),
        }
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/lounge' });

    // The host needs no role: the group is its own.
    const hosted = {
      ...delivery,
      botGroupIds: new Set(['~zod/own']),
      botRoles: new Map(),
      readerRoles: new Map([['chat/~zod/lounge', ['member']]]),
      writerRoles: new Map([['chat/~zod/lounge', ['member']]]),
    };
    expect(
      destinationForChannel(
        channel('chat/~zod/lounge', 'chat', '~zod/own'),
        hosted
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~zod/lounge' });
    // Being an admin of one group says nothing about another.
    expect(
      destinationForChannel(
        channel('chat/~ten/lounge', 'chat', '~ten/with-bot'),
        { ...locked, botRoles: new Map([['~ten/other', new Set(['admin'])]]) }
      )
    ).toBeNull();
  });

  it('goes by reader roles for a notes notebook, where reading is editing', () => {
    const notebook = channel('notes/~ten/wiki', 'notes', '~ten/with-bot');
    const withRoles = (
      readers: string[] | undefined,
      writers: string[] | undefined
    ) => ({
      ...delivery,
      readerRoles: new Map(readers ? [['notes/~ten/wiki', readers]] : []),
      writerRoles: new Map(writers ? [['notes/~ten/wiki', writers]] : []),
    });
    const offered = { kind: 'channel', nest: 'notes/~ten/wiki' };

    expect(
      destinationForChannel(notebook, withRoles(['admin'], undefined))
    ).toBeNull();
    expect(
      destinationForChannel(notebook, withRoles(['admin', 'helper'], undefined))
    ).toEqual(offered);
    // Writer roles left on a notebook are stale and decide nothing.
    expect(
      destinationForChannel(notebook, withRoles(undefined, ['admin']))
    ).toEqual(offered);
    expect(
      destinationForChannel(notebook, withRoles(['admin'], ['helper']))
    ).toBeNull();
  });

  it("leaves out an id the bot's target parser would not accept", () => {
    for (const id of ['~ten/general', 'buckets/~ten/files', 'general']) {
      expect(
        destinationForChannel(channel(id, 'chat', '~ten/with-bot'), delivery)
      ).toBeNull();
    }
  });

  it('saves the nest in the form the bot compares against', () => {
    expect(
      destinationForChannel(
        channel('Chat/TEN/General', 'chat', '~ten/with-bot'),
        delivery
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/General' });
  });
});

describe('botDeliveryFrom', () => {
  const loaded = {
    botShip: '~zod',
    ownerShip: '~ten',
    seats: [{ groupId: '~ten/with-bot' }, { groupId: null }],
    roles: [
      { groupId: '~ten/with-bot', roleId: 'helper' },
      { groupId: '~ten/with-bot', roleId: 'admin' },
    ],
    writers: [
      { channelId: 'chat/~ten/announcements', roleId: 'admin' },
      { channelId: 'chat/~ten/announcements', roleId: 'mod' },
    ],
    readers: [{ channelId: 'notes/~ten/wiki', roleId: 'admin' }],
  };

  it('gathers seats, roles by group, and writer and reader roles by channel', () => {
    const delivery = botDeliveryFrom(loaded);
    expect([...delivery.botGroupIds]).toEqual(['~ten/with-bot']);
    expect([...(delivery.botRoles.get('~ten/with-bot') ?? [])]).toEqual([
      'helper',
      'admin',
    ]);
    expect(delivery.writerRoles.get('chat/~ten/announcements')).toEqual([
      'admin',
      'mod',
    ]);
    expect(delivery.readerRoles.get('notes/~ten/wiki')).toEqual(['admin']);
  });

  it.each(['seats', 'roles', 'writers', 'readers'] as const)(
    'offers no group channel while %s are still loading',
    (missing) => {
      const delivery = botDeliveryFrom({ ...loaded, [missing]: undefined });
      expect(delivery.botGroupIds.size).toBe(0);
      expect(
        destinationForChannel(
          { id: 'chat/~ten/general', type: 'chat', groupId: '~ten/with-bot' },
          delivery
        )
      ).toBeNull();
      expect(
        destinationForChannel({ id: '~zod', type: 'dm' }, delivery)
      ).toEqual({ kind: 'dm', ship: '~ten' });
    }
  );
});

describe('tasksPostingTo', () => {
  const posting = (to?: string): StewardAutomationTask => ({
    name: to ?? 'nowhere',
    delivery: to ? { mode: 'announce', channel: 'tlon', to } : undefined,
  });
  const tasks = {
    chat: posting('chat/~ten/general'),
    // The bot may store the target in any form its parser reads.
    prefixed: posting('group:chat/~ten/general'),
    notebook: posting('notes/~ten/wiki'),
    elsewhere: posting('chat/~bus/lobby'),
    dm: posting('~ten'),
    silent: posting(),
  };

  it("keeps the tasks whose destination is one of the group's channels", () => {
    const inGroup = tasksPostingTo(
      tasks,
      new Set(['chat/~ten/general', 'notes/~ten/wiki', 'heap/~ten/links'])
    );
    expect(Object.keys(inGroup).sort()).toEqual([
      'chat',
      'notebook',
      'prefixed',
    ]);
    expect(inGroup.chat).toBe(tasks.chat);
  });

  it('finds none for a group nothing posts to', () => {
    expect(tasksPostingTo(tasks, new Set(['chat/~nec/quiet']))).toEqual({});
    expect(tasksPostingTo(tasks, new Set())).toEqual({});
  });

  it('narrows to one channel when given only that channel', () => {
    expect(
      Object.keys(tasksPostingTo(tasks, new Set(['chat/~ten/general']))).sort()
    ).toEqual(['chat', 'prefixed']);
    expect(
      Object.keys(tasksPostingTo(tasks, new Set(['notes/~ten/wiki'])))
    ).toEqual(['notebook']);
  });
});

describe('firstDestinationIn', () => {
  const delivery = botDeliveryFrom({
    botShip: '~zod',
    ownerShip: '~ten',
    seats: [{ groupId: '~ten/with-bot' }],
    roles: [],
    writers: [{ channelId: 'chat/~ten/announcements', roleId: 'admin' }],
    readers: [],
  });
  const channel = (id: string, type = 'chat') => ({
    id,
    type,
    groupId: '~ten/with-bot',
  });

  it('takes the first channel the bot can post in', () => {
    expect(
      firstDestinationIn(
        [channel('chat/~ten/announcements'), channel('chat/~ten/general')],
        delivery
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/general' });
  });

  it('has nothing to offer when the bot can post in none of them', () => {
    expect(
      firstDestinationIn([channel('chat/~ten/announcements')], delivery)
    ).toBeUndefined();
    expect(firstDestinationIn([], delivery)).toBeUndefined();
  });

  it('takes a chat before a notebook or a gallery, whatever their order', () => {
    expect(
      firstDestinationIn(
        [
          channel('diary/~ten/journal', 'notebook'),
          channel('heap/~ten/photos', 'gallery'),
          channel('chat/~ten/general'),
        ],
        delivery
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/general' });
  });

  it('takes the channel the task was started from before any other', () => {
    const channels = [
      channel('chat/~ten/general'),
      channel('diary/~ten/journal', 'notebook'),
      channel('chat/~ten/watering'),
    ];
    expect(
      firstDestinationIn(channels, delivery, 'diary/~ten/journal')
    ).toEqual({ kind: 'channel', nest: 'diary/~ten/journal' });
    expect(
      firstDestinationIn(channels, delivery, 'chat/~ten/watering')
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/watering' });
  });

  it('falls back to the group when the bot cannot post where the task was started', () => {
    expect(
      firstDestinationIn(
        [
          channel('chat/~ten/announcements'),
          channel('heap/~ten/photos', 'gallery'),
          channel('chat/~ten/general'),
        ],
        delivery,
        'chat/~ten/announcements'
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/general' });
    // A channel that is not one of the group's changes nothing.
    expect(
      firstDestinationIn(
        [channel('chat/~ten/general')],
        delivery,
        'chat/~bus/x'
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/general' });
  });

  it('starts a new task there, or in the DM by default', () => {
    expect(newTaskDraft('~ten').destination).toEqual({
      kind: 'dm',
      ship: '~ten',
    });
    expect(
      newTaskDraft('~ten', { kind: 'channel', nest: 'chat/~ten/general' })
        .destination
    ).toEqual({ kind: 'channel', nest: 'chat/~ten/general' });
  });
});

describe('groupsMissingBot', () => {
  it('lists each group the bot has no seat in once, and nothing else', () => {
    expect(
      groupsMissingBot(
        [
          { type: 'chat', groupId: '~ten/without-bot' },
          { type: 'notebook', groupId: '~ten/without-bot' },
          { type: 'chat', groupId: '~ten/with-bot' },
          { type: 'gallery', groupId: '~bus/another' },
          { type: 'dm', groupId: null },
          { type: 'groupDm' },
          { type: 'chat' },
        ],
        new Set(['~ten/with-bot'])
      )
    ).toEqual(['~bus/another', '~ten/without-bot']);
  });
});

describe('offersScheduledTasks', () => {
  const available = { available: true, tasks: {} };
  const unavailable = { available: false, tasks: {} };

  it.each([
    ['a mirror that answered', { data: available, isError: false }, true],
    ['a node without the module', { data: unavailable, isError: false }, false],
    ['a read that failed', { isError: true }, true],
    [
      'a failed read after an earlier 404',
      { data: unavailable, isError: true },
      true,
    ],
  ])('for %s, whatever the loading rule', (_, query, shown) => {
    expect(offersScheduledTasks(query, { whileLoading: true })).toBe(shown);
    expect(offersScheduledTasks(query, { whileLoading: false })).toBe(shown);
  });

  it('follows the loading rule before the first answer', () => {
    const loading = { isError: false };
    expect(offersScheduledTasks(loading, { whileLoading: true })).toBe(true);
    expect(offersScheduledTasks(loading, { whileLoading: false })).toBe(false);
  });
});

describe('snapshotAfterRead', () => {
  const read = { available: true, tasks: { '~zod': { a: { name: 'old' } } } };
  const cached = { available: true, tasks: { '~zod': { a: { name: 'new' } } } };
  const settleMs = 5_000;

  it('takes the read when no edit was applied lately', () => {
    expect(
      snapshotAfterRead(read, cached, { editedMsAgo: 60_000, settleMs })
    ).toBe(read);
  });

  it('keeps what an edit just put in the cache', () => {
    expect(
      snapshotAfterRead(read, cached, { editedMsAgo: 1_000, settleMs })
    ).toBe(cached);
  });

  it('takes the read when there is nothing usable cached', () => {
    expect(
      snapshotAfterRead(read, undefined, { editedMsAgo: 1_000, settleMs })
    ).toBe(read);
    expect(
      snapshotAfterRead(
        read,
        { available: false, tasks: {} },
        { editedMsAgo: 1_000, settleMs }
      )
    ).toBe(read);
  });
});

describe('isTaskFromCreate', () => {
  const created = buildTaskCreate(
    {
      name: 'Morning news',
      prompt: 'Summarize the news.',
      schedule: { days: [1, 2, 3, 4, 5], hour: 7, minute: 0 },
      destination: { kind: 'dm', ship: '~ten' },
    },
    { timezone: 'America/New_York' }
  );
  // As the mirror hands it back: the bot's own fields added, keys reordered.
  const mirrored: StewardAutomationTask = {
    agentId: 'main',
    wakeMode: 'now',
    schedule: {
      staggerMs: 30_000,
      tz: 'America/New_York',
      expr: '0 7 * * 1,2,3,4,5',
      kind: 'cron',
    },
    payload: { message: 'Summarize the news.', kind: 'agentTurn' },
    delivery: { to: 'dm/~ten', channel: 'tlon', mode: 'announce' },
    name: 'Morning news',
    enabled: true,
    createdAtMs: 1,
  };

  it('knows the task a create made, whatever the bot added to it', () => {
    expect(created.schedule).toMatchObject({ expr: '0 7 * * 1,2,3,4,5' });
    expect(isTaskFromCreate(created, mirrored)).toBe(true);
  });

  it.each([
    ['name', { name: 'Evening news' }],
    ['time', { schedule: { kind: 'cron' as const, expr: '0 8 * * 1-5' } }],
    ['prompt', { payload: { kind: 'agentTurn', message: 'Something else.' } }],
    ['schedule kind', { schedule: { kind: 'every' as const, everyMs: 1 } }],
    [
      'destination',
      { delivery: { mode: 'announce' as const, to: 'chat/~ten/general' } },
    ],
    ['destination (none)', { delivery: undefined }],
  ])('tells a task with another %s apart', (_, change) => {
    expect(isTaskFromCreate(created, { ...mirrored, ...change })).toBe(false);
  });
});

describe('describeAutomationError', () => {
  it.each([
    ['harness-offline', 'Your bot is offline. Try again once it is back.'],
    ['not-found', 'This task no longer exists.'],
    ['invalid', 'The bot did not accept this change.'],
  ])('explains %s', (errorType, message) => {
    expect(
      describeAutomationError(Object.assign(new Error('x'), { errorType }))
    ).toBe(message);
  });

  it('says a pending edit may still land', () => {
    const pending = Object.assign(new Error('x'), {
      name: 'StewardAutomationPendingError',
    });
    expect(describeAutomationError(pending)).toBe(
      'The bot has not answered yet. The change may still apply.'
    );
  });

  it('falls back to a connection message', () => {
    expect(describeAutomationError(new Error('network'))).toBe(
      'Could not reach your bot. Check your connection and try again.'
    );
  });
});
