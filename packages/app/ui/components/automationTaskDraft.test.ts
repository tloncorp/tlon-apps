import type { StewardAutomationTask } from '@tloncorp/api/urbit';
import { describe, expect, it } from 'vitest';

import {
  applyAutomationUpdate,
  applyTaskPatch,
  buildTaskCreate,
  buildTaskUpdate,
  canEditPrompt,
  cronExpressionFor,
  describeAutomationError,
  destinationFromDelivery,
  draftFromTask,
  newTaskDraft,
  parseEditableSchedule,
  taskPrompt,
  taskStatus,
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

  it('never shows the plugin markers as a title or prompt', () => {
    expect(
      taskTitle({ description: '[Paused: credit budget] Daily digest' })
    ).toBe('Daily digest');
    expect(taskTitle({ description: 'tlon-agent-primary:~zod/home' })).toBe(
      'Untitled task'
    );
    expect(taskPrompt({ description: 'tlon-agent-primary:~zod/home' })).toBe(
      ''
    );
    expect(taskTitle(task)).toBe('Morning news');
    expect(taskPrompt(task)).toBe('Summarize the news.');
  });

  it('only lets a prompt change when the payload kind is known', () => {
    expect(canEditPrompt(task)).toBe(true);
    expect(canEditPrompt({ ...task, payload: { message: 'hi' } })).toBe(false);
    expect(canEditPrompt({ name: 'bare' })).toBe(false);
  });
});

describe('buildTaskUpdate', () => {
  it('sends nothing when nothing changed', () => {
    expect(buildTaskUpdate(task, draftFromTask(task))).toBeNull();
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
