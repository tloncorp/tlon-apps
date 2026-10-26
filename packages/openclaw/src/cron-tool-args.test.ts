import { describe, expect, it } from 'vitest';

import { cleanCronToolArgs } from './cron-tool-args.js';

// The shape the model sends: every schema field, mostly placeholders.
const placeholderJob = {
  name: '',
  displayName: '',
  owner: { agentId: '', sessionKey: '' },
  schedule: {
    kind: 'every',
    at: '',
    everyMs: 1,
    anchorMs: 0,
    expr: '',
    tz: '',
    staggerMs: 0,
  },
  trigger: { script: 'return { fire: false };', once: false },
  sessionTarget: 'main',
  wakeMode: 'next-heartbeat',
  payload: {
    kind: 'systemEvent',
    text: '',
    message: '',
    model: '',
    timeoutSeconds: 0,
    fallbacks: [],
    toolsAllow: [],
  },
  delivery: {
    mode: 'none',
    channel: '',
    to: '',
    bestEffort: false,
    failureDestination: { channel: '', to: '', mode: 'announce' },
  },
  agentId: null,
  failureAlert: { after: 1, channel: '', to: '', mode: 'announce' },
};

describe('cleanCronToolArgs', () => {
  it('keeps only the change an update means to make', () => {
    // Captured from a real run, where core rejected it: "cron patch agentId
    // cannot be changed by the agent cron tool".
    const cleaned = cleanCronToolArgs({
      action: 'update',
      gatewayUrl: '',
      timeoutMs: 10000,
      job: placeholderJob,
      jobId: '6b8e3aa0',
      id: '',
      patch: {
        ...placeholderJob,
        sessionTarget: '',
        trigger: null,
        payload: {
          kind: 'agentTurn',
          message: 'A daily digest, now with a line on GitHub stars.',
          model: null,
          toolsAllow: ['group:web'],
        },
        delivery: { mode: 'none', to: null, bestEffort: false },
        enabled: true,
      },
      mode: 'now',
      runMode: 'due',
      agentId: '',
    });
    const change = {
      payload: {
        kind: 'agentTurn',
        message: 'A daily digest, now with a line on GitHub stars.',
        toolsAllow: ['group:web'],
      },
      enabled: true,
    };
    expect(cleaned).toEqual({
      action: 'update',
      timeoutMs: 10000,
      jobId: '6b8e3aa0',
      patch: change,
      job: change,
    });
  });

  it('keeps a reminder for the DM, minus the placeholders', () => {
    const cleaned = cleanCronToolArgs({
      action: 'add',
      patch: placeholderJob,
      job: {
        ...placeholderJob,
        name: 'Friday timesheet',
        schedule: {
          kind: 'cron',
          expr: '0 16 * * 5',
          tz: 'America/New_York',
          anchorMs: 0,
        },
        payload: {
          kind: 'systemEvent',
          text: 'Submit your timesheet.',
          fallbacks: [],
        },
        delivery: {
          mode: 'announce',
          channel: 'tlon',
          to: '~ten',
          bestEffort: true,
        },
      },
    });
    expect(cleaned).toEqual({
      action: 'add',
      job: {
        name: 'Friday timesheet',
        schedule: {
          kind: 'cron',
          expr: '0 16 * * 5',
          tz: 'America/New_York',
        },
        sessionTarget: 'main',
        wakeMode: 'next-heartbeat',
        payload: { kind: 'systemEvent', text: 'Submit your timesheet.' },
        delivery: { mode: 'announce', channel: 'tlon', to: '~ten' },
      },
    });
  });

  it('keeps a real interval and a real trigger', () => {
    const cleaned = cleanCronToolArgs({
      action: 'add',
      job: {
        name: 'Hourly check',
        schedule: { kind: 'every', everyMs: 3_600_000 },
        trigger: { script: 'return { fire: prices.drop > 5 };' },
        payload: { kind: 'agentTurn', message: 'Check prices.' },
      },
    });
    expect(cleaned?.job).toMatchObject({
      schedule: { kind: 'every', everyMs: 3_600_000 },
      trigger: { script: 'return { fire: prices.drop > 5 };' },
    });
  });

  it('treats a job-only update as the change', () => {
    const cleaned = cleanCronToolArgs({
      action: 'update',
      jobId: 'job-1',
      job: { ...placeholderJob, enabled: false },
    });
    expect(cleaned).toEqual({
      action: 'update',
      jobId: 'job-1',
      patch: { enabled: false },
      job: { enabled: false },
    });
  });

  // The 2026.9 tool takes an update's change as `job` and offers every
  // schedule and payload kind's fields together.
  const placeholderJob9 = {
    name: '',
    declarationKey: 'x',
    displayName: null,
    owner: { agentId: '', sessionKey: '' },
    schedule: {
      kind: 'on-exit',
      at: '',
      everyMs: 1,
      anchorMs: 0,
      expr: '',
      tz: '',
      staggerMs: 0,
      command: '',
      cwd: '',
      mode: 'line',
      match: '',
      batchMs: 0,
      maxBatchBytes: 0,
    },
    pacing: null,
    trigger: null,
    sessionTarget: '',
    wakeMode: 'next-heartbeat',
    payload: {
      kind: 'systemEvent',
      text: 'x',
      message: '',
      argv: [],
      script: '',
      model: null,
      thinking: '',
      timeoutSeconds: null,
      toolBudget: 1,
      lightContext: false,
      allowUnsafeExternalContent: false,
      fallbacks: null,
      toolsAllow: null,
    },
    delivery: {
      mode: 'none',
      channel: null,
      to: null,
      threadId: null,
      bestEffort: true,
      accountId: '',
      failureDestination: null,
      completionDestination: null,
    },
    agentId: null,
    description: '',
    enabled: true,
    deleteAfterRun: false,
    sessionKey: null,
    failureAlert: false,
  };

  it('cleans a 2026.9 update in the key core reads', () => {
    // Captured from a real run on 2026.9.33, where core rejected the model's
    // own `job`: "unexpected property 'declarationKey'", an empty name, an
    // on-exit schedule. The owner had asked to enable the job.
    const raw = {
      action: 'update',
      gatewayUrl: '',
      gatewayToken: '',
      timeoutMs: 20000,
      includeDisabled: true,
      limit: 100,
      offset: 0,
      job: placeholderJob9,
      jobId: '3e34f98c-b315-4245-8539-e132ad8a4408',
    };
    const cleaned = cleanCronToolArgs(raw);
    const change = { enabled: true, deleteAfterRun: false };
    expect(cleaned).toEqual({
      action: 'update',
      timeoutMs: 20000,
      includeDisabled: true,
      jobId: '3e34f98c-b315-4245-8539-e132ad8a4408',
      patch: change,
      job: change,
    });
    // Core lays the hook's params over the model's.
    expect({ ...raw, ...cleaned }.job).toEqual(change);
  });

  it('keeps only the fields of the schedule and payload kind meant', () => {
    const cleaned = cleanCronToolArgs({
      action: 'update',
      jobId: 'job-1',
      job: {
        ...placeholderJob9,
        schedule: {
          ...placeholderJob9.schedule,
          kind: 'cron',
          expr: '0 9 * * 1',
          tz: 'America/Los_Angeles',
        },
        payload: {
          ...placeholderJob9.payload,
          kind: 'agentTurn',
          message: 'Round up this week’s music releases.',
        },
      },
    });
    expect(cleaned?.job).toEqual({
      schedule: { kind: 'cron', expr: '0 9 * * 1', tz: 'America/Los_Angeles' },
      payload: {
        kind: 'agentTurn',
        message: 'Round up this week’s music releases.',
        lightContext: false,
        allowUnsafeExternalContent: false,
      },
      enabled: true,
      deleteAfterRun: false,
    });
  });

  it('drops a placeholder declaration key from an add', () => {
    const cleaned = cleanCronToolArgs({
      action: 'add',
      job: {
        ...placeholderJob9,
        name: 'Weekly roundup',
        declarationKey: 'placeholder',
        schedule: { kind: 'cron', expr: '0 9 * * 1' },
        payload: { kind: 'agentTurn', message: 'Round up releases.' },
      },
    });
    expect(cleaned?.job).not.toHaveProperty('declarationKey');
    expect(cleaned?.job).not.toHaveProperty('failureAlert');
  });

  it('leaves spellings it does not recognise as they were sent', () => {
    // Core also accepts these; rewriting them would drop the whole job.
    expect(
      cleanCronToolArgs({
        action: 'add',
        name: 'daily',
        schedule: { kind: 'cron', expr: '0 8 * * *' },
        payload: { kind: 'agentTurn', message: 'summarize' },
      })
    ).toBeUndefined();
    expect(
      cleanCronToolArgs({
        action: 'add',
        data: { job: { name: 'daily' } },
      })
    ).toBeUndefined();
    expect(
      cleanCronToolArgs({ action: 'update', jobId: '6b8e3aa0', enabled: false })
    ).toBeUndefined();
  });

  it('leaves reads alone', () => {
    expect(cleanCronToolArgs({ action: 'list', job: placeholderJob })).toBe(
      undefined
    );
  });
});
