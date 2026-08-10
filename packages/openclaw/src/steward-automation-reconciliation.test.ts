import type {
  PluginHookCronChangedEvent,
  PluginHookGatewayContext,
  PluginHookGatewayCronJob,
} from 'openclaw/plugin-sdk/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitStewardAutomationProject } from './steward-automation-adapter.js';
import {
  StewardAutomationCronUnavailableError,
  reconcileStewardAutomation,
  registerStewardAutomationReconciliationHooks,
} from './steward-automation-reconciliation.js';

vi.mock('./steward-automation-adapter.js', () => ({
  submitStewardAutomationProject: vi.fn(),
}));

type HookHandler = (event: unknown, context: unknown) => unknown;

function createFakeHookApi() {
  const handlers = new Map<string, HookHandler[]>();
  return {
    on: vi.fn((name: string, handler: HookHandler) => {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    }),
    fire: async (name: string, event: unknown, context: unknown) => {
      for (const handler of handlers.get(name) ?? []) {
        await handler(event, context);
      }
    },
  };
}

function cronContext(jobs: PluginHookGatewayCronJob[]) {
  const list = vi.fn().mockResolvedValue(jobs);
  const context: Pick<PluginHookGatewayContext, 'getCron'> = {
    getCron: () => ({ list }),
  };
  return { context, list };
}

const jobs = [
  {
    id: 'disabled-job',
    agentId: 'main',
    name: 'Nightly status',
    enabled: false,
    schedule: { kind: 'cron', expr: '0 1 * * *', tz: 'UTC' },
    payload: { kind: 'agentTurn', text: 'check status' },
    state: { lastRunStatus: 'ok', lastRunAtMs: 1_777_000_000_000 },
    createdAtMs: 1_700_000_000_000,
  },
] satisfies PluginHookGatewayCronJob[];

beforeEach(() => {
  vi.mocked(submitStewardAutomationProject).mockReset();
  vi.mocked(submitStewardAutomationProject).mockResolvedValue(undefined);
});

describe('reconcileStewardAutomation', () => {
  it('reads the complete list including disabled jobs and submits its normalized project', async () => {
    const { context, list } = cronContext(jobs);

    await reconcileStewardAutomation(context.getCron);

    expect(list).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledWith({ includeDisabled: true });
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
    expect(submitStewardAutomationProject).toHaveBeenCalledWith({
      project: {
        tasks: [
          {
            id: 'disabled-job',
            agentId: 'main',
            name: 'Nightly status',
            enabled: false,
            schedule: { kind: 'cron', expr: '0 1 * * *', tz: 'UTC' },
            payload: { kind: 'agentTurn', text: 'check status' },
            createdAtMs: 1_700_000_000_000,
          },
        ],
      },
    });
  });

  it('submits an empty complete project after a successful empty read', async () => {
    const { context } = cronContext([]);

    await reconcileStewardAutomation(context.getCron);

    expect(submitStewardAutomationProject).toHaveBeenCalledWith({
      project: { tasks: [] },
    });
  });

  it.each([
    ['missing getCron', undefined],
    ['unready cron service', () => undefined],
  ])('fails clearly for %s without submitting', async (_label, getCron) => {
    await expect(reconcileStewardAutomation(getCron)).rejects.toMatchObject({
      name: 'StewardAutomationCronUnavailableError',
      retryable: true,
    });
    await expect(reconcileStewardAutomation(getCron)).rejects.toBeInstanceOf(
      StewardAutomationCronUnavailableError
    );
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('propagates read failures without submitting an empty project', async () => {
    const readError = new Error('cron list unavailable');
    const list = vi.fn().mockRejectedValue(readError);

    await expect(reconcileStewardAutomation(() => ({ list }))).rejects.toBe(
      readError
    );
    expect(submitStewardAutomationProject).not.toHaveBeenCalled();
  });

  it('propagates submission failures for later retry', async () => {
    const submissionError = new Error('poke nack');
    const { context } = cronContext(jobs);
    vi.mocked(submitStewardAutomationProject).mockRejectedValue(
      submissionError
    );

    await expect(reconcileStewardAutomation(context.getCron)).rejects.toBe(
      submissionError
    );
  });
});

describe('registerStewardAutomationReconciliationHooks', () => {
  it('reconciles after gateway_start', async () => {
    const api = createFakeHookApi();
    const { context, list } = cronContext(jobs);
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0]
    );

    await api.fire('gateway_start', { port: 3000 }, context);

    expect(list).toHaveBeenCalledWith({ includeDisabled: true });
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
  });

  it.each<PluginHookCronChangedEvent['action']>([
    'added',
    'updated',
    'removed',
    'started',
    'finished',
  ])('reconciles after the %s cron_changed action', async (action) => {
    const api = createFakeHookApi();
    const { context, list } = cronContext(jobs);
    registerStewardAutomationReconciliationHooks(
      api as unknown as Parameters<
        typeof registerStewardAutomationReconciliationHooks
      >[0]
    );

    await api.fire('cron_changed', { action, jobId: 'disabled-job' }, context);

    expect(list).toHaveBeenCalledWith({ includeDisabled: true });
    expect(submitStewardAutomationProject).toHaveBeenCalledOnce();
  });
});
