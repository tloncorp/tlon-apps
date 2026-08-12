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
  ensureDeterministicCronOutputNest,
  normalizeIanaTimezone,
  onboardingCompletionSequenceBlocker,
  onboardingResearchSequenceBlocker,
  parseDeterministicResearchDraft,
  removeOrphanedDeterministicCronJobs,
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

  test('preserves a freeform purpose through deterministic setup', () => {
    const purpose = 'Watch city council agendas for zoning changes';
    const description = buildAwaitingTimezoneDescription({
      purposeId: 'agent-custom',
      purpose,
      topics: 'Downtown and waterfront',
      agentShip: '~bot',
    });
    const parsed = deterministicSetupFromDescription(description)!;
    expect(parsed.purposeId).toBe('agent-custom');
    expect(parsed.purpose).toBe(purpose);
    expect(JSON.parse(description)[0].purpose).toBe(purpose);
    const scheduled = JSON.parse(
      buildDeterministicSetupDescription({
        ...parsed,
        timezone: 'America/New_York',
        record: {
          state: 'awaiting-notebook',
          topics: parsed.topics,
          timezone: 'America/New_York',
          cronJobId: 'cron-custom',
        },
      })
    )[0];
    expect(scheduled.jobs[0].prompt).toContain(purpose);
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
    expect(complete.jobs[0].prompt).toContain(
      'Configured notebook output nest: notes/~zod/daily'
    );
  });

  test('rejects invalid persisted onboarding scalar fields and states', () => {
    const valid = JSON.parse(
      buildAwaitingTimezoneDescription({
        purposeId: 'agent-research',
        topics: 'Mycology',
        agentShip: '~bot',
      })
    );
    const invalidValues: Array<[string, unknown]> = [
      ['state', 'unknown'],
      ['timezone', 123],
      ['cronJobId', 123],
      ['notebookNest', 123],
      ['noteBaseline', 123],
      ['noteId', 123],
    ];

    for (const [field, value] of invalidValues) {
      const description = structuredClone(valid);
      description[0].onboarding[field] = value;
      expect(
        deterministicSetupFromDescription(JSON.stringify(description))
      ).toBe(null);
    }
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
      enabled: false,
      sessionTarget: 'isolated',
      delivery: { mode: 'none' },
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
    expect(addedPayload.message).toContain('Scheduled update complete.');
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

  test('does not mutate the scheduler after the monitor aborts', async () => {
    const controller = new AbortController();
    const service = {
      list: vi.fn(async () => []),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    setCronServiceAccessor(() => service as never);
    controller.abort();

    await expect(
      ensureDeterministicCronJob({
        nest: 'chat/~zod/home-group-chat',
        purposeId: 'agent-research',
        topics: 'Mycology',
        timezone: 'America/New_York',
        abortSignal: controller.signal,
      })
    ).rejects.toThrow('aborted with monitor');
    expect(service.list).not.toHaveBeenCalled();
    expect(service.add).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  test('repairs a matching cron whose schedule or prompt is stale', async () => {
    const jobs: PluginHookGatewayCronJob[] = [];
    const update = vi.fn(async (id: string, patch: unknown) => {
      Object.assign(jobs.find((job) => job.id === id)!, patch);
    });
    const service = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input: PluginHookGatewayCronCreateInput) => {
        jobs.push({ id: 'cron-stale', ...input } as PluginHookGatewayCronJob);
      }),
      update,
      remove: vi.fn(),
    };
    setCronServiceAccessor(() => service as never);
    const params = {
      nest: 'chat/~zod/home-group-chat',
      purposeId: 'agent-research',
      topics: 'Mycology',
      timezone: 'America/New_York',
    };

    await ensureDeterministicCronJob(params);
    Object.assign(jobs[0]!, {
      enabled: false,
      schedule: { kind: 'cron', expr: '0 1 * * *', tz: 'UTC' },
      payload: { kind: 'agentTurn', text: 'old prompt', message: 'old prompt' },
    });

    await expect(ensureDeterministicCronJob(params)).resolves.toBe(
      'cron-stale'
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(jobs[0]).toMatchObject({
      enabled: false,
      schedule: {
        kind: 'cron',
        expr: PURPOSE_JOBS['agent-research'].schedule,
        tz: 'America/New_York',
      },
      payload: {
        message: expect.stringContaining('Mycology'),
      },
    });
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

  test('updates the stored recurring prompt with the discovered notebook nest', async () => {
    const jobs: PluginHookGatewayCronJob[] = [
      {
        id: 'cron-1',
        payload: {
          kind: 'agentTurn',
          text: PURPOSE_JOBS['agent-research'].prompt.replace(
            '{{topics}}',
            'Mycology'
          ),
        },
      },
    ];
    const update = vi.fn(async (id: string, patch: unknown) => {
      const job = jobs.find((candidate) => candidate.id === id)!;
      Object.assign(job, patch);
    });
    setCronServiceAccessor(
      () =>
        ({
          list: vi.fn(async () => jobs),
          add: vi.fn(),
          update,
          remove: vi.fn(),
        }) as never
    );

    const params = {
      cronJobId: 'cron-1',
      nest: 'chat/~zod/home-group-chat',
      purposeId: 'agent-research',
      topics: 'Mycology',
      timezone: 'America/New_York',
      outputNest: 'notes/~zod/research',
    };
    await expect(ensureDeterministicCronOutputNest(params)).resolves.toBe(
      'cron-1'
    );
    await expect(ensureDeterministicCronOutputNest(params)).resolves.toBe(
      'cron-1'
    );

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      'cron-1',
      expect.objectContaining({
        enabled: true,
        delivery: { mode: 'none' },
        payload: expect.objectContaining({
          text: expect.stringContaining(
            'Configured notebook output nest: notes/~zod/research'
          ),
          message: expect.stringContaining(
            'Configured notebook output nest: notes/~zod/research'
          ),
        }),
      })
    );
  });

  test('does not repair cron output after the monitor aborts', async () => {
    const controller = new AbortController();
    const service = {
      list: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    setCronServiceAccessor(() => service as never);
    controller.abort();

    await expect(
      ensureDeterministicCronOutputNest({
        cronJobId: 'cron-1',
        nest: 'chat/~zod/home-group-chat',
        purposeId: 'agent-research',
        topics: 'Mycology',
        timezone: 'America/New_York',
        outputNest: 'notes/~zod/research',
        abortSignal: controller.signal,
      })
    ).rejects.toThrow('aborted with monitor');
    expect(service.list).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  test('verifies an output-nest update whose response was lost', async () => {
    const jobs: PluginHookGatewayCronJob[] = [
      { id: 'cron-1', payload: { kind: 'agentTurn', text: 'old prompt' } },
    ];
    setCronServiceAccessor(
      () =>
        ({
          list: vi.fn(async () => jobs),
          add: vi.fn(),
          update: vi.fn(async (_id: string, patch: unknown) => {
            Object.assign(jobs[0], patch);
            throw new Error('response lost');
          }),
          remove: vi.fn(),
        }) as never
    );

    await expect(
      ensureDeterministicCronOutputNest({
        cronJobId: 'cron-1',
        nest: 'chat/~zod/home-group-chat',
        purposeId: 'agent-research',
        topics: 'Mycology',
        timezone: 'America/New_York',
        outputNest: 'notes/~zod/research',
      })
    ).resolves.toBe('cron-1');
  });

  test('recreates and routes a missing persisted cron job', async () => {
    const jobs: PluginHookGatewayCronJob[] = [];
    const service = {
      list: vi.fn(async () => jobs),
      add: vi.fn(async (input: PluginHookGatewayCronCreateInput) => {
        jobs.push({
          id: 'cron-replacement',
          ...input,
        } as PluginHookGatewayCronJob);
      }),
      update: vi.fn(async (id: string, patch: unknown) => {
        Object.assign(jobs.find((job) => job.id === id)!, patch);
      }),
      remove: vi.fn(),
    };
    setCronServiceAccessor(() => service as never);

    await expect(
      ensureDeterministicCronOutputNest({
        cronJobId: 'cron-missing',
        nest: 'chat/~zod/home-group-chat',
        purposeId: 'agent-research',
        topics: 'Mycology',
        timezone: 'America/New_York',
        outputNest: 'notes/~zod/research',
      })
    ).resolves.toBe('cron-replacement');
    expect(service.add).toHaveBeenCalledTimes(1);
    expect(jobs[0]).toMatchObject({
      id: 'cron-replacement',
      enabled: true,
      payload: {
        message: expect.stringContaining(
          'Configured notebook output nest: notes/~zod/research'
        ),
      },
    });
  });

  test('removes only onboarding cron jobs whose chats disappeared', async () => {
    const jobs: PluginHookGatewayCronJob[] = [
      {
        id: 'live-cron',
        description: 'tlon-agent-onboarding:chat/~zod/live:agent-research',
      },
      {
        id: 'orphan-cron',
        description: 'tlon-agent-onboarding:chat/~zod/deleted:agent-research',
      },
      {
        id: 'retained-cron',
        description:
          'tlon-agent-onboarding:chat/~zod/deleted-chat:agent-research',
      },
      {
        id: 'other-account-cron',
        description:
          'tlon-agent-onboarding:chat/~nec/deleted-chat:agent-research',
      },
      { id: 'ordinary-cron', description: 'something else' },
    ];
    const remove = vi.fn(async (id: string) => {
      jobs.splice(
        jobs.findIndex((job) => job.id === id),
        1
      );
      return { removed: true };
    });
    setCronServiceAccessor(
      () =>
        ({
          list: vi.fn(async () => jobs),
          add: vi.fn(),
          update: vi.fn(),
          remove,
        }) as never
    );

    await expect(
      removeOrphanedDeterministicCronJobs({
        ownerShip: '~zod',
        liveChatNests: ['chat/~zod/live'],
        retainedCronJobIds: ['retained-cron'],
      })
    ).resolves.toEqual(['orphan-cron']);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('orphan-cron');
    expect(jobs.map((job) => job.id)).toEqual([
      'live-cron',
      'retained-cron',
      'other-account-cron',
      'ordinary-cron',
    ]);
  });
});

describe('research directive', () => {
  test('requests structured prose and leaves every side effect with the coordinator', () => {
    const directive = renderDeterministicResearchDirective({
      nest: 'chat/~zod/home-group-chat',
      purposeId: 'agent-research',
      topics: 'Mycology',
    });
    expect(directive).toContain('{"title":"concise title"');
    expect(directive).toContain('Return only valid JSON');
    expect(directive).toContain('Do not create or update a group');
    expect(directive).not.toContain('groups update');
    expect(directive).not.toContain('note-create');
    expect(directive).not.toContain('tlon_onboarding_draft');
  });

  test('includes a custom purpose in the research task', () => {
    const directive = renderDeterministicResearchDirective({
      nest: 'chat/~zod/home-group-chat',
      purposeId: 'agent-custom',
      purpose: 'Watch city council agendas',
      topics: 'Downtown zoning',
    });
    expect(directive).toContain('Watch city council agendas');
    expect(directive).toContain('Downtown zoning');
  });

  test('parses and trims a structured research draft', () => {
    expect(
      parseDeterministicResearchDraft(
        JSON.stringify({ title: ' Today ', markdown: ' # Findings\n\nSource ' })
      )
    ).toEqual({ title: 'Today', markdown: '# Findings\n\nSource' });
  });

  test('rejects malformed and oversized research drafts', () => {
    expect(() => parseDeterministicResearchDraft('not json')).toThrow(
      'invalid JSON'
    );
    expect(() =>
      parseDeterministicResearchDraft(
        JSON.stringify({ title: '', markdown: 'Body' })
      )
    ).toThrow('draft title');
    expect(() =>
      parseDeterministicResearchDraft(
        JSON.stringify({ title: 'Title', markdown: 'x'.repeat(50_001) })
      )
    ).toThrow('Markdown draft');
  });
});
