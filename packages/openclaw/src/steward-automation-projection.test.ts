import { describe, expect, it } from 'vitest';

import capturedCronJobs from './fixtures/openclaw-2026.5.28-cron-jobs.sanitized.json';
import { normalizeStewardAutomationProjection } from './steward-automation-projection.js';

type HookCronJob = Parameters<
  typeof normalizeStewardAutomationProjection
>[0][number];

function runtimeJob(value: unknown): HookCronJob {
  return value as HookCronJob;
}

describe('Steward automation projection normalization', () => {
  it('normalizes captured at/every/cron jobs with their optional fields', () => {
    const result = normalizeStewardAutomationProjection(
      capturedCronJobs.map(runtimeJob)
    );

    expect(result).toEqual({
      project: {
        tasks: [
          {
            id: 'trace-at-1',
            agentId: 'dev',
            name: 'Captured one-shot reminder',
            enabled: true,
            schedule: { kind: 'at', at: 1_785_734_301_000 },
            sessionTarget: 'isolated',
            wakeMode: 'now',
            payload: {
              kind: 'agentTurn',
              message: 'Send a short reminder.',
            },
            createdAtMs: 1_785_734_006_665,
            updatedAtMs: 1_785_734_006_665,
          },
          {
            id: 'trace-every-1',
            agentId: 'dev',
            name: 'Captured interval reminder',
            enabled: true,
            schedule: {
              kind: 'every',
              everyMs: 120_000,
              anchorMs: 1_785_735_243_782,
            },
            sessionTarget: 'isolated',
            wakeMode: 'now',
            payload: {
              kind: 'agentTurn',
              message: 'Send a playful reminder.',
            },
            createdAtMs: 1_785_735_243_782,
            updatedAtMs: 1_785_740_230_441,
          },
          {
            id: 'trace-cron-1',
            agentId: 'dev',
            name: 'Captured weekday reminder',
            description: 'Captured cron expression fixture',
            enabled: false,
            schedule: {
              kind: 'cron',
              expr: '17 4 * * 1-5',
              tz: 'America/New_York',
              staggerMs: 45_000,
            },
            sessionTarget: 'isolated',
            wakeMode: 'now',
            payload: {
              kind: 'agentTurn',
              message: 'Send a weekday reminder.',
            },
            createdAtMs: 1_786_416_589_889,
            updatedAtMs: 1_786_416_589_889,
          },
        ],
      },
    });
    expect(result.project.tasks[0]).not.toHaveProperty('description');
    expect(result.project.tasks[1]).not.toHaveProperty('description');
    for (const task of result.project.tasks) {
      expect(task).not.toHaveProperty('state');
      expect(task).not.toHaveProperty('delivery');
      expect(task).not.toHaveProperty('deleteAfterRun');
      expect(task).not.toHaveProperty('sessionKey');
      expect(task.payload).not.toHaveProperty('text');
    }
  });

  it('prefers canonical message and preserves false and zero', () => {
    const result = normalizeStewardAutomationProjection([
      runtimeJob({
        id: 'disabled-zero',
        enabled: false,
        schedule: {
          kind: 'cron',
          expr: '',
          tz: '',
          staggerMs: 0,
        },
        payload: {
          kind: '',
          text: 'compatibility text',
          message: 'canonical message',
          unknown: 'drop me',
        },
        createdAtMs: 0,
        updatedAtMs: 0,
        deleteAfterRun: false,
        delivery: { mode: 'announce', to: '~sample' },
        sessionKey: 'drop me',
        state: { nextRunAtMs: 1 },
      }),
    ]);

    expect(result).toEqual({
      project: {
        tasks: [
          {
            id: 'disabled-zero',
            enabled: false,
            schedule: { kind: 'cron', expr: '', tz: '', staggerMs: 0 },
            payload: { kind: '', message: 'canonical message' },
            createdAtMs: 0,
            updatedAtMs: 0,
          },
        ],
      },
    });
    const [task] = result.project.tasks;
    expect(task).not.toHaveProperty('state');
    expect(task).not.toHaveProperty('delivery');
    expect(task).not.toHaveProperty('deleteAfterRun');
    expect(task).not.toHaveProperty('sessionKey');
    expect(task.payload).not.toHaveProperty('text');
  });

  it('uses compatibility text when canonical message is absent', () => {
    expect(
      normalizeStewardAutomationProjection([
        runtimeJob({
          id: 'compatibility-text',
          payload: { kind: 'agentTurn', text: 'fallback message' },
        }),
      ]).project.tasks[0]?.payload
    ).toEqual({ kind: 'agentTurn', message: 'fallback message' });
  });

  it('omits explicitly undefined task and schedule fields', () => {
    const tasks = normalizeStewardAutomationProjection([
      runtimeJob({
        id: 'undefined-task-fields',
        agentId: undefined,
        name: '',
        description: undefined,
        enabled: false,
        schedule: {
          kind: 'cron',
          expr: undefined,
          tz: '',
          staggerMs: 0,
        },
        sessionTarget: undefined,
        wakeMode: undefined,
        payload: undefined,
        createdAtMs: undefined,
        updatedAtMs: 0,
      }),
      runtimeJob({
        id: 'undefined-at-field',
        schedule: { kind: 'at', at: undefined },
      }),
      runtimeJob({
        id: 'undefined-every-fields',
        schedule: {
          kind: 'every',
          everyMs: undefined,
          anchorMs: undefined,
        },
      }),
    ]).project.tasks;

    expect(tasks).toStrictEqual([
      {
        id: 'undefined-task-fields',
        name: '',
        enabled: false,
        schedule: { kind: 'cron', tz: '', staggerMs: 0 },
        updatedAtMs: 0,
      },
      { id: 'undefined-at-field', schedule: { kind: 'at' } },
      { id: 'undefined-every-fields', schedule: { kind: 'every' } },
    ]);
    for (const field of [
      'agentId',
      'description',
      'sessionTarget',
      'wakeMode',
      'payload',
      'createdAtMs',
    ]) {
      expect(tasks[0]).not.toHaveProperty(field);
    }
    expect(tasks[0]?.schedule).not.toHaveProperty('expr');
    expect(tasks[1]?.schedule).not.toHaveProperty('at');
    expect(tasks[2]?.schedule).not.toHaveProperty('everyMs');
    expect(tasks[2]?.schedule).not.toHaveProperty('anchorMs');
  });

  it('preserves input order and returns a complete empty projection', () => {
    expect(
      normalizeStewardAutomationProjection([
        runtimeJob({ id: 'second' }),
        runtimeJob({ id: 'first' }),
      ]).project.tasks.map(({ id }) => id)
    ).toEqual(['second', 'first']);
    expect(normalizeStewardAutomationProjection([])).toEqual({
      project: { tasks: [] },
    });
  });

  it('normalizes an ISO datetime with a timezone offset', () => {
    expect(
      normalizeStewardAutomationProjection([
        runtimeJob({
          id: 'offset-at',
          schedule: { kind: 'at', at: '2026-08-01T14:30:00+02:00' },
        }),
      ]).project.tasks[0]?.schedule
    ).toEqual({ kind: 'at', at: 1_785_587_400_000 });
  });

  it.each([
    ['non-object job', null, /Invalid cron job: expected an object/],
    [
      'non-object schedule',
      { id: 'bad-schedule', schedule: [] },
      /cron job bad-schedule schedule: expected an object/,
    ],
    [
      'non-object payload',
      { id: 'bad-payload', payload: null },
      /cron job bad-payload payload: expected an object/,
    ],
    [
      'impossible at date',
      { id: 'bad-at', schedule: { kind: 'at', at: '2026-02-31T00:00:00Z' } },
      /cron job bad-at schedule\.at: expected an ISO timestamp/,
    ],
    [
      'invalid number',
      { id: 'bad-every', schedule: { kind: 'every', everyMs: -1 } },
      /expected a non-negative safe integer/,
    ],
    [
      'unsupported schedule',
      { id: 'bad-kind', schedule: { kind: 'on-exit' } },
      /unsupported value on-exit/,
    ],
    [
      'invalid compatibility payload text',
      { id: 'bad-text', payload: { text: 1 } },
      /payload.text: expected a string/,
    ],
    [
      'invalid canonical payload message',
      { id: 'bad-message', payload: { message: false } },
      /payload.message: expected a string/,
    ],
  ])('rejects %s', (_name, job, error) => {
    expect(() =>
      normalizeStewardAutomationProjection([runtimeJob(job)])
    ).toThrow(error);
  });

  it('rejects duplicate IDs before producing a projection action', () => {
    expect(() =>
      normalizeStewardAutomationProjection([
        runtimeJob({ id: 'duplicate' }),
        runtimeJob({ id: 'duplicate' }),
      ])
    ).toThrow('Duplicate cron job id: duplicate');
  });
});
