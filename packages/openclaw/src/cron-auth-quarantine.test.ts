import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    _testing.clear();
  });

  afterEach(() => {
    _testing.clear();
  });

  it('pauses the job at the threshold and sends one actionable notice', async () => {
    const { service, update } = makeCronService();
    const notify = vi.fn(async () => true);
    setCronAuthQuarantineNotifier(notify);

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
    setCronAuthQuarantineNotifier(notify);

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
    setCronAuthQuarantineNotifier(notify);

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

  it('does not quarantine before an owner notifier is connected', async () => {
    const { service, update } = makeCronService();

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
    setCronAuthQuarantineNotifier(notify);
    const ctx = { getCron: () => service };

    await handleCronAuthQuarantine(makeEvent(), ctx);
    await expect(handleCronAuthQuarantine(makeEvent(), ctx)).resolves.toEqual({
      status: 'ignored',
      reason: 'already-disabled',
    });
    expect(update).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
  });

  it('restores the schedule when the owner notice cannot be delivered', async () => {
    const job = makeJob();
    const { service, update } = makeCronService(job);
    const notify = vi.fn(async () => false);
    setCronAuthQuarantineNotifier(notify);

    await expect(
      handleCronAuthQuarantine(makeEvent(), { getCron: () => service })
    ).resolves.toEqual({
      status: 'notification-failed',
      jobId: 'job-1',
      consecutiveErrors: 3,
    });
    expect(update.mock.calls).toEqual([
      ['job-1', { enabled: false }],
      ['job-1', { enabled: true }],
    ]);
    expect(job.enabled).toBe(true);
  });

  it('falls back to known 401 text on hosts without structured reasons', async () => {
    const job = makeJob({
      state: {
        consecutiveErrors: 3,
        lastError: '401 User not found',
      },
    });
    const { service, update } = makeCronService(job);
    setCronAuthQuarantineNotifier(async () => true);

    await handleCronAuthQuarantine(makeEvent({ error: '401 User not found' }), {
      getCron: () => service,
    });
    expect(update).toHaveBeenCalledWith('job-1', { enabled: false });
  });

  it('formats unnamed jobs with their stable id', () => {
    expect(formatCronAuthQuarantineNotice({ id: 'job-7' }, 4)).toContain(
      '“job-7”'
    );
  });

  it('does not let stale monitor cleanup clear a replacement notifier', async () => {
    const first = vi.fn(async () => true);
    const second = vi.fn(async () => true);
    const clearFirst = setCronAuthQuarantineNotifier(first);
    setCronAuthQuarantineNotifier(second);

    clearFirst();
    const { service } = makeCronService();
    await handleCronAuthQuarantine(makeEvent(), { getCron: () => service });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
