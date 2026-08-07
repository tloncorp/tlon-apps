import type {
  PluginHookGatewayCronCreateInput,
  PluginHookGatewayCronJob,
} from 'openclaw/plugin-sdk/types';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  clearCronServiceAccessor,
  setCronServiceAccessor,
} from '../cron-telemetry.js';
import { PURPOSE_JOBS } from './agent-onboarding-config.js';
import {
  buildAwaitingTimezoneDescription,
  buildAwaitingTopicsDescription,
  buildDeterministicSetupDescription,
  createOnboardingWriteQueue,
  deterministicSetupFromDescription,
  ensureDeterministicCronJob,
  normalizeIanaTimezone,
  onboardingCompletionSequenceBlocker,
  onboardingResearchSequenceBlocker,
  renderDeterministicResearchDirective,
} from './agent-onboarding-coordinator.js';

afterEach(() => clearCronServiceAccessor());

describe('deterministic onboarding config', () => {
  test('persists the selected purpose before the topics reply', () => {
    const description = buildAwaitingTopicsDescription({
      purposeId: 'agent-research',
      agentShip: '~bot',
    });
    const parsed = deterministicSetupFromDescription(description)!;
    expect(parsed.record.state).toBe('awaiting-topics');
    expect(parsed.purposeId).toBe('agent-research');
    expect(JSON.parse(description)[0].jobs).toEqual([]);
  });

  test('persists topics before timezone without claiming a configured job', () => {
    const description = buildAwaitingTimezoneDescription({
      purposeId: 'agent-research',
      topics: 'Mycology',
      agentShip: '~bot',
    });
    const parsed = deterministicSetupFromDescription(description)!;
    expect(parsed.record.state).toBe('awaiting-timezone');
    expect(parsed.topics).toBe('Mycology');
    expect(JSON.parse(description)[0].jobs).toEqual([]);
  });

  test('records verified cron identity separately from the declarative job', () => {
    const description = buildDeterministicSetupDescription({
      purposeId: 'agent-daily-digest',
      topics: 'Coffee',
      timezone: 'America/New_York',
      agentShip: '~bot',
      record: {
        state: 'awaiting-notebook',
        topics: 'Coffee',
        timezone: 'America/New_York',
        cronJobId: 'cron-123',
      },
    });
    const entry = JSON.parse(description)[0];
    expect(entry.jobs[0].cronJobId).toBe('cron-123');
    expect(entry.jobs[0].schedule.tz).toBe('America/New_York');
    expect(entry.onboarding.state).toBe('awaiting-notebook');
    expect(entry.jobs[0].outputNest).toBe('');

    const complete = JSON.parse(
      buildDeterministicSetupDescription({
        ...deterministicSetupFromDescription(description)!,
        record: {
          ...deterministicSetupFromDescription(description)!.record,
          state: 'complete',
          notebookNest: 'notes/~zod/daily',
        },
      })
    )[0];
    expect(complete.jobs[0].outputNest).toBe('notes/~zod/daily');
  });
});

describe('onboarding sequence guards', () => {
  const readyForNotebook = () =>
    deterministicSetupFromDescription(
      buildDeterministicSetupDescription({
        purposeId: 'agent-research',
        topics: 'Mycology',
        timezone: 'America/New_York',
        agentShip: '~bot',
        record: {
          state: 'awaiting-notebook',
          topics: 'Mycology',
          timezone: 'America/New_York',
          cronJobId: 'cron-123',
        },
      })
    )!;

  test('does not research while purpose, topics, or timezone are still pending', () => {
    const awaitingTopics = deterministicSetupFromDescription(
      buildAwaitingTopicsDescription({
        purposeId: 'agent-research',
        agentShip: '~bot',
      })
    )!;
    const awaitingTimezone = deterministicSetupFromDescription(
      buildAwaitingTimezoneDescription({
        purposeId: 'agent-research',
        topics: 'Mycology',
        agentShip: '~bot',
      })
    )!;

    expect(onboardingResearchSequenceBlocker(awaitingTopics)).toBe(
      'state_awaiting-topics_not_ready'
    );
    expect(onboardingResearchSequenceBlocker(awaitingTimezone)).toBe(
      'state_awaiting-timezone_not_ready'
    );
  });

  test('requires the verified cron identity before notebook provisioning', () => {
    const setup = readyForNotebook();
    setup.record.cronJobId = undefined;
    expect(onboardingResearchSequenceBlocker(setup)).toBe('cron_job_missing');
  });

  test('allows research only after the cron-backed config is complete', () => {
    expect(onboardingResearchSequenceBlocker(readyForNotebook())).toBeNull();
  });

  test('allows closing only after notebook and note identities are persisted', () => {
    const setup = readyForNotebook();
    setup.record.state = 'complete';
    expect(onboardingCompletionSequenceBlocker(setup)).toBe('notebook_missing');
    setup.record.notebookNest = 'notes/~zod/research';
    expect(onboardingCompletionSequenceBlocker(setup)).toBe('note_missing');
    setup.record.noteId = '42';
    expect(onboardingCompletionSequenceBlocker(setup)).toBeNull();
  });
});

describe('onboarding description write serialization', () => {
  test('does not let a delayed older transition overwrite a newer one', async () => {
    const queue = createOnboardingWriteQueue();
    let releaseOlder!: () => void;
    const olderCanFinish = new Promise<void>((resolve) => {
      releaseOlder = resolve;
    });
    let storedState = 'initial';
    const executionOrder: string[] = [];

    const older = queue.run('~zod/home', async () => {
      executionOrder.push('older-started');
      await olderCanFinish;
      storedState = 'awaiting-notebook';
      executionOrder.push('older-finished');
    });
    await Promise.resolve();
    const newer = queue.run('~zod/home', async () => {
      executionOrder.push('newer-started');
      storedState = 'researching';
      executionOrder.push('newer-finished');
    });

    expect(queue.has('~zod/home')).toBe(true);
    expect(executionOrder).toEqual(['older-started']);
    releaseOlder();
    await Promise.all([older, newer]);

    expect(storedState).toBe('researching');
    expect(executionOrder).toEqual([
      'older-started',
      'older-finished',
      'newer-started',
      'newer-finished',
    ]);
    expect(queue.has('~zod/home')).toBe(false);
  });

  test('continues after a failed write and does not block other groups', async () => {
    const queue = createOnboardingWriteQueue();
    let releaseFailure!: () => void;
    const failureCanFinish = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    const otherGroup = vi.fn(async () => 'other-group');

    const failed = queue.run('~zod/home', async () => {
      await failureCanFinish;
      throw new Error('timed out after the poke landed');
    });
    const recovered = queue.run('~zod/home', async () => 'recovered');
    await expect(queue.run('~nec/home', otherGroup)).resolves.toBe(
      'other-group'
    );
    expect(otherGroup).toHaveBeenCalledOnce();

    releaseFailure();
    await expect(failed).rejects.toThrow('timed out');
    await expect(recovered).resolves.toBe('recovered');
    expect(queue.has('~zod/home')).toBe(false);
  });
});

describe('scheduled job templates', () => {
  test('run daily and keep setup-only instructions out of recurring prompts', () => {
    for (const [purposeId, job] of Object.entries(PURPOSE_JOBS)) {
      const [, , dayOfMonth, month, dayOfWeek] = job.schedule.split(' ');
      expect(
        [dayOfMonth, month, dayOfWeek],
        `${purposeId} should run every day`
      ).toEqual(['*', '*', '*']);
      for (const phrase of [
        'during this build',
        'separate directive',
        'Tlon watches',
        'outputNest" empty',
      ]) {
        expect(job.prompt).not.toContain(phrase);
      }
      expect(job.prompt).toContain('outputNest');
    }
  });
});

describe('timezone normalization', () => {
  test('accepts client replies and rejects prose guesses', () => {
    expect(normalizeIanaTimezone('Timezone: America/New_York')).toBe(
      'America/New_York'
    );
    expect(normalizeIanaTimezone('UTC')).toBe('UTC');
    expect(normalizeIanaTimezone('eastern time')).toBeNull();
  });
});

describe('cron creation', () => {
  test('adds once and verifies the stored scheduler job id', async () => {
    const jobs: PluginHookGatewayCronJob[] = [];
    const service = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input: PluginHookGatewayCronCreateInput) => {
        jobs.push({ id: 'cron-1', ...input } as PluginHookGatewayCronJob);
      }),
      update: vi.fn(),
      remove: vi.fn(),
    };
    setCronServiceAccessor(() => service as never);

    const trace = vi.fn();
    const params = {
      nest: 'chat/~zod/home-group-chat',
      purposeId: 'agent-research',
      topics: 'Mycology',
      timezone: 'America/New_York',
      trace,
    };
    await expect(ensureDeterministicCronJob(params)).resolves.toBe('cron-1');
    await expect(ensureDeterministicCronJob(params)).resolves.toBe('cron-1');
    expect(service.add).toHaveBeenCalledTimes(1);
    expect(service.add.mock.calls[0]![0]).toMatchObject({
      sessionTarget: 'isolated',
      payload: {
        kind: 'agentTurn',
        text: expect.stringContaining('Mycology'),
        message: expect.stringContaining('Mycology'),
      },
    });
    const addedPayload = service.add.mock.calls[0]![0].payload as {
      text?: string;
      message?: string;
    };
    expect(addedPayload.message).toBe(addedPayload.text);
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'add_job',
        outcome: 'succeeded',
      })
    );
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'verify_job',
        outcome: 'succeeded',
        cronJobId: 'cron-1',
        totalCronJobCount: 1,
      })
    );
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'reuse_existing',
        outcome: 'succeeded',
        cronJobId: 'cron-1',
      })
    );
  });

  test('accepts a stored job when the add response itself fails', async () => {
    const jobs: PluginHookGatewayCronJob[] = [];
    setCronServiceAccessor(
      () =>
        ({
          list: async () => jobs,
          add: async (input: PluginHookGatewayCronCreateInput) => {
            jobs.push({
              id: 'cron-after-timeout',
              ...input,
            } as PluginHookGatewayCronJob);
            throw new Error('response lost');
          },
          update: vi.fn(),
          remove: vi.fn(),
        }) as never
    );
    await expect(
      ensureDeterministicCronJob({
        nest: 'chat/~zod/home-group-chat',
        purposeId: 'agent-research',
        topics: 'Mycology',
        timezone: 'America/New_York',
      })
    ).resolves.toBe('cron-after-timeout');
  });
});

describe('research directive', () => {
  test('leaves every side effect with the coordinator', () => {
    const directive = renderDeterministicResearchDirective({
      nest: 'chat/~zod/home-group-chat',
      purposeId: 'agent-research',
      topics: 'Mycology',
    });
    expect(directive).toContain('tlon_onboarding_draft');
    expect(directive).toContain('Do not create or update a group');
    expect(directive).not.toContain('groups update');
    expect(directive).not.toContain('note-create');
  });
});
