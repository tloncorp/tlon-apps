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
    expect(cleaned).toEqual({
      action: 'update',
      timeoutMs: 10000,
      jobId: '6b8e3aa0',
      patch: {
        payload: {
          kind: 'agentTurn',
          message: 'A daily digest, now with a line on GitHub stars.',
          toolsAllow: ['group:web'],
        },
        enabled: true,
      },
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
    });
  });

  it('leaves reads alone', () => {
    expect(cleanCronToolArgs({ action: 'list', job: placeholderJob })).toBe(
      undefined
    );
  });
});
