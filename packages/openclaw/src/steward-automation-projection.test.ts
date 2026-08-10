import { describe, expect, it } from 'vitest';

import capturedCronJobs from './fixtures/openclaw-2026.5.28-cron-jobs.sanitized.json';
import { normalizeStewardAutomationProject } from './steward-automation-projection.js';

type HookCronJob = Parameters<
  typeof normalizeStewardAutomationProject
>[0][number];

function runtimeJob(value: unknown): HookCronJob {
  return value as HookCronJob;
}

describe('Steward automation projection normalization', () => {
  it('normalizes captured jobs and omits execution-only fields', () => {
    const result = normalizeStewardAutomationProject(
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
              text: 'Send a short reminder.',
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
              text: 'Send a playful reminder.',
            },
            createdAtMs: 1_785_735_243_782,
            updatedAtMs: 1_785_740_230_441,
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /state|delivery|deleteAfterRun|message/
    );
  });

  it('preserves false and zero and prefers declared payload text', () => {
    const result = normalizeStewardAutomationProject([
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
          text: 'declared text',
          message: 'runtime message',
          unknown: 'drop me',
        },
        createdAtMs: 0,
        updatedAtMs: 0,
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
            payload: { kind: '', text: 'declared text' },
            createdAtMs: 0,
            updatedAtMs: 0,
          },
        ],
      },
    });
  });

  it('preserves input order and returns a complete empty project', () => {
    expect(
      normalizeStewardAutomationProject([
        runtimeJob({ id: 'second' }),
        runtimeJob({ id: 'first' }),
      ]).project.tasks.map(({ id }) => id)
    ).toEqual(['second', 'first']);
    expect(normalizeStewardAutomationProject([])).toEqual({
      project: { tasks: [] },
    });
  });

  it.each([
    [
      'invalid at date',
      { id: 'bad-at', schedule: { kind: 'at', at: '2026-02-31T00:00:00Z' } },
      /expected an ISO timestamp/,
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
      'invalid declared payload text',
      { id: 'bad-text', payload: { text: 1, message: 'fallback' } },
      /payload.text: expected a string/,
    ],
    [
      'invalid runtime payload message',
      { id: 'bad-message', payload: { message: false } },
      /payload.message: expected a string/,
    ],
  ])('rejects %s', (_name, job, error) => {
    expect(() => normalizeStewardAutomationProject([runtimeJob(job)])).toThrow(
      error
    );
  });

  it('rejects duplicate IDs before producing a project action', () => {
    expect(() =>
      normalizeStewardAutomationProject([
        runtimeJob({ id: 'duplicate' }),
        runtimeJob({ id: 'duplicate' }),
      ])
    ).toThrow('Duplicate cron job id: duplicate');
  });
});
