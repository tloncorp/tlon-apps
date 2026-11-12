import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { botService, createRuntimeContext } from '../runtime/context.js';
import { allocateRuntimeEndpoints } from '../runtime/ports.js';
import {
  type HarnessSchedule,
  dmGrant,
  harnessDriver,
  harnessScheduleSnapshot,
  harnessTlonAction,
  removeHarnessSchedule,
} from './harness.js';
import type { RuntimeSeed } from './types.js';

describe('Harness driver runtime spec', () => {
  test('runs on the bot ship without a bot service', async () => {
    const repoRoot = path.resolve('/repo');
    const seed: RuntimeSeed = {
      driverName: 'harness',
      repoRoot,
      runId: 'unit',
      endpoints: await allocateRuntimeEndpoints({
        fakeModel: 4100,
        zod: 4101,
        ten: 4102,
        mug: 4103,
      }),
    };

    const ctx = createRuntimeContext(seed, harnessDriver.resolveRuntime(seed));

    expect(ctx.composeProjectName).toBe('tlon-bot-e2e-harness-unit');
    expect(ctx.packageDir).toBe(path.join(repoRoot, 'packages/harness'));
    expect(ctx.composeFiles).toEqual([
      path.join(
        repoRoot,
        'packages/tlon-bot-e2e/docker/docker-compose.base.yml'
      ),
    ]);
    expect(ctx.services.bot).toBeUndefined();
    expect(() => botService(ctx)).toThrow(
      'The harness driver has no bot service.'
    );
    expect(ctx.testEnv).toMatchObject({
      TLON_BOT_E2E_DRIVER: 'harness',
      TLON_URL: 'http://127.0.0.1:4101',
      TEST_USER_SHIP: '~ten',
      TEST_THIRD_PARTY_SHIP: '~mug',
      FAKE_MODEL_BASE_URL: 'http://127.0.0.1:4100',
    });
  });

  test('model adapter scripts final text and structured tlon actions', () => {
    expect(harnessDriver.model.replyText('hello')).toMatchObject({
      steps: [{ kind: 'text', content: 'hello' }],
      expectations: {
        advertisedTools: { include: ['tlon'] },
        expectedCallCount: 1,
      },
    });

    expect(
      harnessDriver.model.readOrAdmin(
        'contacts update-profile --nickname "bot name"',
        'done'
      ).steps
    ).toEqual([
      {
        kind: 'tool_call',
        name: 'tlon',
        args: { action: 'update_profile', nickname: 'bot name' },
      },
      { kind: 'text', content: 'done' },
    ]);
  });

  test('refuses what it cannot script instead of faking it', () => {
    expect(() => harnessTlonAction('version')).toThrow(
      'The tlon command "version" is not supported by the harness driver.'
    );
    expect(() => harnessDriver.model.imageSearch('cats')).toThrow(
      'imageSearch is not supported by the harness driver.'
    );
  });
});

describe('Harness scheduled jobs', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const job = {
    name: 'shared-cron-job',
    firedPrompt: '[tlon-test:fired] Reply with the marker.',
    finalText: 'Scheduled.',
  };

  function schedule(overrides: Partial<HarnessSchedule>): HarnessSchedule {
    return {
      id: '0v1',
      prompt: job.firedPrompt,
      state: 'active',
      clearable: false,
      ...overrides,
    };
  }

  test('schedules a one-shot run of the exact prompt in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 12, 12));
    const script = harnessDriver.model.createCronJob(job);
    expect(script.steps).toEqual([
      {
        kind: 'tool_call',
        name: 'schedule_once',
        args: { at: '2026-11-12T12:01:00.000Z', prompt: job.firedPrompt },
      },
      { kind: 'text', content: 'Scheduled.' },
    ]);
    expect(script.expectations?.advertisedTools).toEqual({
      include: ['schedule_once', 'tlon'],
    });
  });

  test('finds the job by its prompt, since Harness jobs have no name', () => {
    expect(harnessDriver.cronJobs?.listingName(job)).toBe(job.firedPrompt);
    expect(harnessScheduleSnapshot(schedule({ id: '0v2' }))).toEqual({
      id: '0v2',
      name: job.firedPrompt,
      finished: false,
    });
  });

  test('a job is finished only once it has completed and settled', () => {
    const finished = (overrides: Partial<HarnessSchedule>) =>
      harnessScheduleSnapshot(schedule(overrides)).finished;
    expect(finished({ state: 'complete', clearable: true })).toBe(true);
    expect(finished({ state: 'complete', clearable: false })).toBe(false);
    expect(finished({ state: 'cancelled', clearable: true })).toBe(false);
    expect(finished({ state: 'active', clearable: false })).toBe(false);
  });

  test('clears a settled job without cancelling it', async () => {
    const call = fakeAcp([[schedule({ state: 'complete', clearable: true })]]);
    await removeHarnessSchedule(call, '0v1', Date.now() + 1_000);
    expect(call.methods()).toEqual(['harness/cron', 'harness/cron/clear']);
  });

  test('cancels a live job and clears it once its run settles', async () => {
    vi.useFakeTimers();
    const call = fakeAcp([
      [schedule({ state: 'active' })],
      [schedule({ state: 'cancelled' })],
      [schedule({ state: 'cancelled', clearable: true })],
    ]);
    const removal = removeHarnessSchedule(call, '0v1', Date.now() + 5_000);
    await vi.advanceTimersByTimeAsync(500);
    await removal;
    expect(call.methods()).toEqual([
      'harness/cron',
      'harness/cron/cancel',
      'harness/cron',
      'harness/cron',
      'harness/cron/clear',
    ]);
  });

  test('does nothing for a job that is already gone', async () => {
    const call = fakeAcp([[schedule({ id: '0v9' })]]);
    await removeHarnessSchedule(call, '0v1', Date.now() + 1_000);
    expect(call.methods()).toEqual(['harness/cron']);
  });

  test('fails at the deadline when a cancelled run never settles', async () => {
    vi.useFakeTimers();
    const call = fakeAcp([[schedule({ state: 'cancelled' })]]);
    const removal = removeHarnessSchedule(call, '0v1', Date.now() + 1_000);
    const rejected = expect(removal).rejects.toThrow(
      'Harness schedule 0v1 still has work in flight'
    );
    await vi.advanceTimersByTimeAsync(1_000);
    await rejected;
    expect(call.methods()).not.toContain('harness/cron/clear');
  });
});

// Answers each harness/cron listing with the next entry of `listings`,
// repeating the last, and records every method called.
function fakeAcp(listings: HarnessSchedule[][]) {
  const calls: string[] = [];
  let listed = 0;
  const call = async (method: string) => {
    calls.push(method);
    if (method !== 'harness/cron') {
      return [];
    }
    return listings[Math.min(listed++, listings.length - 1)];
  };
  return Object.assign(call, { methods: () => calls });
}

describe('Harness DM grant', () => {
  test('adds a ship that was not allowed and revokes only that ship', () => {
    const grant = dmGrant(['~bus'], '~mug');
    expect(grant.allowed).toEqual(['~bus', '~mug']);
    expect(grant.undo?.(['~bus', '~mug', '~zod'])).toEqual(['~bus', '~zod']);
  });

  test('grants on an empty list and revokes back to empty', () => {
    const grant = dmGrant([], '~mug');
    expect(grant.allowed).toEqual(['~mug']);
    expect(grant.undo?.(grant.allowed)).toEqual([]);
  });

  test('leaves an already allowed ship in place on revoke', () => {
    const grant = dmGrant(['~mug', '~bus'], '~mug');
    expect(grant.allowed).toEqual(['~mug', '~bus']);
    expect(grant.undo).toBeUndefined();
  });
});
