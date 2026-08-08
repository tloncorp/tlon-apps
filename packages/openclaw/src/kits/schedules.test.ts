import type { Kit } from '@tloncorp/api';
import type {
  PluginHookGatewayCronCreateInput,
  PluginHookGatewayCronJob,
  PluginHookGatewayCronService,
} from 'openclaw/plugin-sdk/types';
import { describe, expect, it, vi } from 'vitest';

import type { InstalledKitConfig } from './group-config.js';
import {
  buildDesiredKitCronJobs,
  kitCronJobName,
  reconcileKitCronJobs,
} from './schedules.js';

const GROUP = '~zod/book-club';

function makeKit(): Kit {
  return {
    manifest: {
      id: 'book-club',
      name: 'Book Club',
      version: '0.1.0',
      publisher: '~zod',
      description: 'a club',
      image: null,
      scope: 'group',
      places: [],
      bindings: [
        {
          file: 'instructions/monthly-pick.md',
          scope: 'group',
          trigger: 'schedule.monthly-pick',
          load: 'on-trigger',
        },
        {
          file: 'instructions/weekly-nudge.md',
          scope: 'group',
          trigger: 'schedule.weekly-nudge',
          load: 'on-trigger',
        },
      ],
      schedules: [],
      scaffolds: [],
      policy: null,
    },
    files: {
      'instructions/monthly-pick.md': '# Pick a book',
      'instructions/weekly-nudge.md': '# Nudge the room',
    },
  };
}

function makeEntry(): InstalledKitConfig {
  return {
    installId: 'book-club-0',
    kit: { id: 'book-club', version: '0.1.0', publisher: '~zod' },
    places: {
      discussion: 'chat/~zod/discussion',
      picks: 'chat/~zod/picks',
    },
    schedules: [
      { id: 'monthly-pick', cron: '0 17 1 * *' },
      { id: 'weekly-nudge', cron: '0 17 * * 5' },
    ],
    agents: ['~zod'],
    setup: 'done',
  };
}

function buildDesired() {
  return buildDesiredKitCronJobs({
    groupFlag: GROUP,
    entries: [{ entry: makeEntry(), kit: makeKit() }],
    resolveSessionKey: (nest) => `agent:main:tlon:group:${nest}`,
  });
}

/** Minimal in-memory stand-in for the gateway cron service. */
function makeFakeCron(seed: PluginHookGatewayCronJob[] = []) {
  const jobs = new Map<string, PluginHookGatewayCronJob>(
    seed.map((job) => [job.id, job])
  );
  let nextId = 1;
  const service: PluginHookGatewayCronService = {
    list: vi.fn(async () => [...jobs.values()]),
    add: vi.fn(async (input: PluginHookGatewayCronCreateInput) => {
      const id = `job-${nextId++}`;
      jobs.set(id, { id, ...input } as unknown as PluginHookGatewayCronJob);
      return { id };
    }),
    update: vi.fn(async (id: string, patch) => {
      const existing = jobs.get(id);
      if (existing) {
        jobs.set(id, { ...existing, ...patch } as PluginHookGatewayCronJob);
      }
      return jobs.get(id);
    }),
    remove: vi.fn(async (id: string) => {
      const removed = jobs.delete(id);
      return { removed };
    }),
  };
  return { service, jobs };
}

describe('buildDesiredKitCronJobs', () => {
  it('builds one job per schedule with payload from the on-trigger binding', () => {
    const desired = buildDesired();
    expect(desired).toHaveLength(2);
    const monthly = desired.find((job) => job.name.endsWith(':monthly-pick'))!;
    expect(monthly.name).toBe(kitCronJobName(GROUP, 'monthly-pick'));
    expect(monthly.scheduleExpr).toBe('0 17 1 * *');
    expect(monthly.sessionTarget).toBe(
      'session:agent:main:tlon:group:chat/~zod/discussion'
    );
    expect(monthly.payloadText).toContain('# Pick a book');
    // One line of context: kit, group, places legend.
    const firstLine = monthly.payloadText.split('\n')[0];
    expect(firstLine).toContain('book-club');
    expect(firstLine).toContain(GROUP);
    expect(firstLine).toContain('discussion → chat/~zod/discussion');
  });

  it('skips schedules with no matching on-trigger binding', () => {
    const log = vi.fn();
    const entry = makeEntry();
    entry.schedules.push({ id: 'mystery', cron: '0 0 * * *' });
    const desired = buildDesiredKitCronJobs({
      groupFlag: GROUP,
      entries: [{ entry, kit: makeKit() }],
      resolveSessionKey: () => 'session-key',
      log,
    });
    expect(desired).toHaveLength(2);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('schedule.mystery')
    );
  });

  it('skips all schedules when the kit has no chat place', () => {
    const entry = makeEntry();
    entry.places = { log: 'diary/~zod/log' };
    const desired = buildDesiredKitCronJobs({
      groupFlag: GROUP,
      entries: [{ entry, kit: makeKit() }],
      resolveSessionKey: () => 'session-key',
    });
    expect(desired).toHaveLength(0);
  });
});

describe('reconcileKitCronJobs', () => {
  it('adds missing jobs', async () => {
    const { service, jobs } = makeFakeCron();
    const result = await reconcileKitCronJobs({
      cron: service,
      desired: buildDesired(),
    });
    expect(result).toEqual({ added: 2, updated: 0, removed: 0, kept: 0 });
    expect([...jobs.values()].map((job) => job.name).sort()).toEqual([
      kitCronJobName(GROUP, 'monthly-pick'),
      kitCronJobName(GROUP, 'weekly-nudge'),
    ]);
    const added = (service.add as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(added.schedule).toEqual(expect.objectContaining({ kind: 'cron' }));
    expect(added.payload.kind).toBe('systemEvent');
  });

  it('is idempotent: a second run with the same desired set writes nothing', async () => {
    const { service } = makeFakeCron();
    await reconcileKitCronJobs({ cron: service, desired: buildDesired() });
    const result = await reconcileKitCronJobs({
      cron: service,
      desired: buildDesired(),
    });
    expect(result).toEqual({ added: 0, updated: 0, removed: 0, kept: 2 });
    expect(service.add).toHaveBeenCalledTimes(2); // only from the first run
    expect(service.update).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('removes orphaned tlon:kit:* jobs for uninstalled kits', async () => {
    const { service, jobs } = makeFakeCron();
    await reconcileKitCronJobs({ cron: service, desired: buildDesired() });
    // Kit uninstalled → desired set is empty.
    const result = await reconcileKitCronJobs({ cron: service, desired: [] });
    expect(result.removed).toBe(2);
    expect(jobs.size).toBe(0);
  });

  it('leaves non-kit jobs alone', async () => {
    const { service, jobs } = makeFakeCron([
      {
        id: 'other-1',
        name: 'daily-standup',
      } as PluginHookGatewayCronJob,
    ]);
    await reconcileKitCronJobs({ cron: service, desired: [] });
    expect(jobs.has('other-1')).toBe(true);
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('updates a job whose schedule drifted from the config', async () => {
    const { service, jobs } = makeFakeCron();
    await reconcileKitCronJobs({ cron: service, desired: buildDesired() });
    const drifted = buildDesired().map((job) =>
      job.name.endsWith(':monthly-pick')
        ? { ...job, scheduleExpr: '0 9 2 * *' }
        : job
    );
    const result = await reconcileKitCronJobs({
      cron: service,
      desired: drifted,
    });
    expect(result).toEqual({ added: 0, updated: 1, removed: 0, kept: 1 });
    const monthly = [...jobs.values()].find((job) =>
      job.name?.endsWith(':monthly-pick')
    );
    expect(monthly?.schedule).toEqual(
      expect.objectContaining({ expr: '0 9 2 * *' })
    );
  });
});
