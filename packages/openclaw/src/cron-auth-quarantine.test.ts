import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type {
  PluginHookCronChangedEvent,
  PluginHookGatewayCronJob,
  PluginHookGatewayCronService,
} from 'openclaw/plugin-sdk/types';

import {
  CRON_AUTH_QUARANTINE_THRESHOLD,
  _testing,
  formatCronAuthQuarantineNotice,
  handleCronAuthQuarantine,
  setCronAuthQuarantineNotifier,
} from './cron-auth-quarantine.js';

type ForwardCompatibleJob = PluginHookGatewayCronJob & {
  delivery?: { accountId?: string };
  state: NonNullable<PluginHookGatewayCronJob['state']> & {
    consecutiveErrors?: number;
    lastErrorReason?: string;
  };
};

function makeJob(
  overrides: Partial<ForwardCompatibleJob> = {}
): ForwardCompatibleJob {
  return {
    id: 'job-1',
    name: 'daily update',
    enabled: true,
    schedule: { kind: 'cron', expr: '0 9 * * *' },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: { kind: 'agentTurn', text: 'run the update' },
    updatedAtMs: 1,
    state: {
      consecutiveErrors: CRON_AUTH_QUARANTINE_THRESHOLD,
      lastError: '401 User not found',
      lastErrorReason: 'auth',
    },
    ...overrides,
  };
}

function makeEvent(
  overrides: Partial<PluginHookCronChangedEvent> = {}
): PluginHookCronChangedEvent {
  return {
    action: 'finished',
    jobId: 'job-1',
    status: 'error',
    error: '401 User not found',
    ...overrides,
  };
}

function makeCronService(job = makeJob()): {
  service: PluginHookGatewayCronService;
  list: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const list = vi.fn(async () => [job]);
  const update = vi.fn(async (_id: string, patch: { enabled?: boolean }) => {
    if (typeof patch.enabled === 'boolean') {
      job.enabled = patch.enabled;
    }
    job.updatedAtMs = (job.updatedAtMs ?? 0) + 1;
    return job;
  });
  return {
    service: {
      list,
      add: vi.fn(),
      update,
      remove: vi.fn(),
    },
    list,
    update,
  };
}

describe('cron auth quarantine', () => {
  const temporaryDirs: string[] = [];

  beforeEach(() => {
    _testing.clear();
  });

  afterEach(async () => {
    _testing.clear();
    await Promise.all(
      temporaryDirs
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it('pauses the job at the threshold and sends one actionable notice', async () => {
    const { service, update } = makeCronService();
    const notify = vi.fn(async () => true);
    setCronAuthQuarantineNotifier('default', notify);

    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    const result = await handleCronAuthQuarantine(makeEvent(), {
      getCron: () => service,
    });

    expect(result).toEqual({
      status: 'quarantined',
      jobId: 'job-1',
      consecutiveErrors: 3,
    });
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith('job-1', { enabled: false });
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0]?.[0]).toContain('daily update');
    expect(notify.mock.calls[0]?.[0]).toContain('model settings');
    expect(notify.mock.calls[0]?.[0]).toContain('re-enable the schedule');
  });

  it('does nothing before three consecutive failures', async () => {
    const job = makeJob({
      state: { consecutiveErrors: 2, lastErrorReason: 'auth' },
    });
    const { service, update } = makeCronService(job);
    const notify = vi.fn(async () => true);
    setCronAuthQuarantineNotifier('default', notify);

    await expect(
      handleCronAuthQuarantine(makeEvent(), { getCron: () => service })
    ).resolves.toEqual({ status: 'ignored', reason: 'below-threshold' });
    expect(update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('ignores non-authentication failures', async () => {
    const job = makeJob({
      state: {
        consecutiveErrors: 7,
        lastError: 'upstream timed out',
        lastErrorReason: 'timeout',
      },
    });
    const { service, update } = makeCronService(job);
    const notify = vi.fn(async () => true);
    setCronAuthQuarantineNotifier('default', notify);

    await expect(
      handleCronAuthQuarantine(makeEvent({ error: 'upstream timed out' }), {
        getCron: () => service,
      })
    ).resolves.toEqual({
      status: 'ignored',
      reason: 'not-authentication-failure',
    });
    expect(update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('honors a structured non-auth reason over nested 401 text', async () => {
    const job = makeJob({
      state: {
        consecutiveErrors: 7,
        lastError: 'timeout after previous provider response: 401 Unauthorized',
        lastErrorReason: 'timeout',
      },
    });
    const { service, update } = makeCronService(job);
    setCronAuthQuarantineNotifier('default', async () => true);

    await expect(
      handleCronAuthQuarantine(
        makeEvent({
          error: 'timeout after previous provider response: 401 Unauthorized',
          provider: 'openrouter',
        }),
        { getCron: () => service }
      )
    ).resolves.toEqual({
      status: 'ignored',
      reason: 'not-authentication-failure',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('clears a non-auth streak even when the job was disabled concurrently', async () => {
    const job = makeJob();
    const { service, update } = makeCronService(job);
    setCronAuthQuarantineNotifier('default', async () => true);
    await handleCronAuthQuarantine(makeEvent({ runAtMs: 100 }), {
      getCron: () => service,
    });
    await handleCronAuthQuarantine(makeEvent({ runAtMs: 200 }), {
      getCron: () => service,
    });
    job.enabled = false;
    job.state = {
      consecutiveErrors: 3,
      lastError: 'upstream timed out',
      lastErrorReason: 'timeout',
    };
    await handleCronAuthQuarantine(
      makeEvent({ error: 'upstream timed out', runAtMs: 300 }),
      { getCron: () => service }
    );
    job.enabled = true;
    job.state = {
      consecutiveErrors: 4,
      lastError: '401 User not found',
      lastErrorReason: 'auth',
    };

    await expect(
      handleCronAuthQuarantine(makeEvent({ runAtMs: 400 }), {
        getCron: () => service,
      })
    ).resolves.toEqual({ status: 'ignored', reason: 'below-threshold' });
    expect(update).not.toHaveBeenCalled();
  });

  it('does not quarantine before an owner notifier is connected', async () => {
    const { service, update } = makeCronService();

    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await expect(
      handleCronAuthQuarantine(makeEvent(), { getCron: () => service })
    ).resolves.toEqual({
      status: 'ignored',
      reason: 'owner-notifier-unavailable',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('does not notify again for a duplicate event after disabling', async () => {
    const { service, update } = makeCronService();
    const notify = vi.fn(async () => true);
    setCronAuthQuarantineNotifier('default', notify);
    const ctx = { getCron: () => service };

    await handleCronAuthQuarantine(makeEvent(), ctx);
    await handleCronAuthQuarantine(makeEvent(), ctx);
    await handleCronAuthQuarantine(makeEvent(), ctx);
    await expect(handleCronAuthQuarantine(makeEvent(), ctx)).resolves.toEqual({
      status: 'ignored',
      reason: 'already-disabled',
    });
    expect(update).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
  });

  it('leaves the schedule safely paused when the owner notice cannot be delivered', async () => {
    const job = makeJob();
    const { service, update } = makeCronService(job);
    const notify = vi.fn(async () => false);
    setCronAuthQuarantineNotifier('default', notify);

    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await expect(
      handleCronAuthQuarantine(makeEvent(), { getCron: () => service })
    ).resolves.toEqual({
      status: 'notification-failed',
      jobId: 'job-1',
      consecutiveErrors: 3,
      restored: false,
    });
    expect(update.mock.calls).toEqual([['job-1', { enabled: false }]]);
    expect(job.enabled).toBe(false);
  });

  it('uses a local auth streak on hosts without structured counters', async () => {
    const job = makeJob({
      state: {
        lastError: '401 User not found',
      },
    });
    const { service, update } = makeCronService(job);
    setCronAuthQuarantineNotifier('default', async () => true);

    const event = makeEvent({
      error: '401 User not found',
      provider: 'openrouter',
    });
    await handleCronAuthQuarantine(event, { getCron: () => service });
    await handleCronAuthQuarantine(event, { getCron: () => service });
    await handleCronAuthQuarantine(event, { getCron: () => service });
    expect(update).toHaveBeenCalledWith('job-1', { enabled: false });
  });

  it('uses run time before a reusable main-session id for event identity', async () => {
    const { service, update } = makeCronService();
    setCronAuthQuarantineNotifier('default', async () => true);
    const ctx = { getCron: () => service };

    await handleCronAuthQuarantine(
      makeEvent({ sessionId: 'main', runAtMs: 100 }),
      ctx
    );
    await handleCronAuthQuarantine(
      makeEvent({ sessionId: 'main', runAtMs: 100 }),
      ctx
    );
    await handleCronAuthQuarantine(
      makeEvent({ sessionId: 'main', runAtMs: 200 }),
      ctx
    );
    expect(update).not.toHaveBeenCalled();
    await handleCronAuthQuarantine(
      makeEvent({ sessionId: 'main', runAtMs: 300 }),
      ctx
    );
    expect(update).toHaveBeenCalledWith('job-1', { enabled: false });
  });

  it('continues an authentication streak after a gateway restart', async () => {
    const workspaceDir = await mkdtemp(
      path.join(tmpdir(), 'tlon-cron-auth-quarantine-')
    );
    temporaryDirs.push(workspaceDir);
    const { service, update } = makeCronService();
    setCronAuthQuarantineNotifier('default', async () => true);
    const ctx = { getCron: () => service, workspaceDir };

    await handleCronAuthQuarantine(makeEvent({ runAtMs: 100 }), ctx);
    _testing.clearMemoryOnly();
    await handleCronAuthQuarantine(makeEvent({ runAtMs: 200 }), ctx);
    _testing.clearMemoryOnly();
    await handleCronAuthQuarantine(makeEvent({ runAtMs: 300 }), ctx);

    expect(update).toHaveBeenCalledWith('job-1', { enabled: false });
  });

  it('does not erase persisted streaks when the store is malformed', async () => {
    const workspaceDir = await mkdtemp(
      path.join(tmpdir(), 'tlon-cron-auth-quarantine-')
    );
    temporaryDirs.push(workspaceDir);
    const storeDir = path.join(workspaceDir, '.openclaw');
    const storePath = path.join(storeDir, 'tlon-cron-auth-streaks.json');
    await mkdir(storeDir, { recursive: true });
    await writeFile(storePath, '{truncated', 'utf8');
    const { service } = makeCronService();
    setCronAuthQuarantineNotifier('default', async () => true);

    await expect(
      handleCronAuthQuarantine(makeEvent({ runAtMs: 100 }), {
        getCron: () => service,
        workspaceDir,
      })
    ).rejects.toThrow();
    await expect(readFile(storePath, 'utf8')).resolves.toBe('{truncated');
  });

  it('formats unnamed jobs with their stable id', () => {
    expect(formatCronAuthQuarantineNotice({ id: 'job-7' }, 4)).toContain(
      '“job-7”'
    );
  });

  it('does not let stale monitor cleanup clear a replacement notifier', async () => {
    const first = vi.fn(async () => true);
    const second = vi.fn(async () => true);
    const clearFirst = setCronAuthQuarantineNotifier('default', first);
    setCronAuthQuarantineNotifier('default', second);

    clearFirst();
    const { service } = makeCronService();
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('counts consecutive auth failures instead of generic cron errors', async () => {
    const job = makeJob();
    const { service, update } = makeCronService(job);
    const notify = vi.fn(async () => true);
    setCronAuthQuarantineNotifier('default', notify);

    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    job.state = {
      consecutiveErrors: 3,
      lastError: 'upstream timed out',
      lastErrorReason: 'timeout',
    };
    await handleCronAuthQuarantine(makeEvent({ error: 'upstream timed out' }), {
      getCron: () => service,
    });
    job.state = {
      consecutiveErrors: 4,
      lastError: '401 User not found',
      lastErrorReason: 'auth',
    };

    await expect(
      handleCronAuthQuarantine(makeEvent(), { getCron: () => service })
    ).resolves.toEqual({ status: 'ignored', reason: 'below-threshold' });
    expect(update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('resets the auth streak after a successful run', async () => {
    const { service, update } = makeCronService();
    setCronAuthQuarantineNotifier('default', async () => true);
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(
      makeEvent({ status: 'ok', error: undefined }),
      { getCron: () => service }
    );

    await expect(
      handleCronAuthQuarantine(makeEvent(), { getCron: () => service })
    ).resolves.toEqual({ status: 'ignored', reason: 'below-threshold' });
    expect(update).not.toHaveBeenCalled();
  });

  it('does not treat an unrelated API 401 as model authentication', async () => {
    const job = makeJob({
      state: { lastError: '401 Unauthorized from calendar API' },
    });
    const { service, update } = makeCronService(job);
    setCronAuthQuarantineNotifier('default', async () => true);

    await expect(
      handleCronAuthQuarantine(
        makeEvent({ error: '401 Unauthorized from calendar API' }),
        { getCron: () => service }
      )
    ).resolves.toEqual({
      status: 'ignored',
      reason: 'not-authentication-failure',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('routes a projected delivery account to its matching notifier', async () => {
    const job = makeJob({ delivery: { accountId: 'second' } });
    const { service } = makeCronService(job);
    const first = vi.fn(async () => true);
    const second = vi.fn(async () => true);
    setCronAuthQuarantineNotifier('first', first);
    setCronAuthQuarantineNotifier('second', second);

    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('fails closed when multiple account notifiers cannot be routed', async () => {
    const { service, update } = makeCronService();
    const first = vi.fn(async () => true);
    const second = vi.fn(async () => true);
    setCronAuthQuarantineNotifier('first', first);
    setCronAuthQuarantineNotifier('second', second);

    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await expect(
      handleCronAuthQuarantine(makeEvent(), { getCron: () => service })
    ).resolves.toEqual({
      status: 'ignored',
      reason: 'owner-notifier-unavailable',
    });
    expect(update).not.toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('does not re-enable a job changed while notification is in flight', async () => {
    const job = makeJob();
    const { service, update } = makeCronService(job);
    setCronAuthQuarantineNotifier('default', async () => {
      job.enabled = false;
      job.updatedAtMs = (job.updatedAtMs ?? 0) + 1;
      return false;
    });

    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });
    await expect(
      handleCronAuthQuarantine(makeEvent(), { getCron: () => service })
    ).resolves.toEqual({
      status: 'notification-failed',
      jobId: 'job-1',
      consecutiveErrors: 3,
      restored: false,
    });
    expect(update.mock.calls).toEqual([['job-1', { enabled: false }]]);
    expect(job.enabled).toBe(false);
  });
});
