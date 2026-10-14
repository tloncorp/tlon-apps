import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import { afterEach, expect, it, vi } from 'vitest';
import { createBudgetHoldObserver } from './cron-budget-observability.js';
import {
  emptyBudgetHoldState,
  type BudgetHoldChange,
} from './cron-budget-hold.js';

const telemetry = vi.hoisted(() => ({
  captureCronBudgetSnapshot: vi.fn(),
  captureCronBudgetChanged: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./telemetry.js', () => ({ createTlonTelemetry: () => telemetry }));
afterEach(() => vi.clearAllMocks());

const config: OpenClawPluginApi['config'] = {
  channels: {
    tlon: {
      ship: '~zod',
      ownerShip: '~nec',
      url: 'http://zod',
      code: 'test',
      telemetry: { enabled: true, apiKey: 'phc_test' },
    },
  },
};
const transition: BudgetHoldChange = {
  eventId: 'event',
  occurredAtMs: 100,
  episodeId: 'episode',
  jobId: 'job',
  action: 'paused',
  reason: 'credit_budget',
  source: 'startup',
};

it('delivers pending startup changes and a snapshot with account identity, then stays quiet', async () => {
  const logger = { info: vi.fn(), warn: vi.fn() };
  const observer = createBudgetHoldObserver(logger);
  const state = {
    ...emptyBudgetHoldState(),
    limited: true,
    episodeId: 'episode',
    holds: {
      job: { description: '', revision: 1 },
      intent: { description: '' },
    },
    pendingTelemetryChanges: [transition],
  };
  expect(observer.observe(config, 'limited', state)).toBe(true);
  expect(telemetry.captureCronBudgetChanged).toHaveBeenCalledWith({
    ...transition,
    accountId: 'default',
    botShip: '~zod',
    ownerShip: '~nec',
  });
  expect(telemetry.captureCronBudgetSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({
      budgetPausedCronCount: 1,
      reason: 'gateway_start',
    })
  );
  state.pendingTelemetryChanges = [];
  observer.observe(config, 'limited', state);
  expect(logger.info).toHaveBeenCalledTimes(2);
  expect(telemetry.captureCronBudgetSnapshot).toHaveBeenCalledTimes(1);
  observer.observe(config, 'unknown', state);
  expect(telemetry.captureCronBudgetSnapshot).toHaveBeenLastCalledWith(
    expect.objectContaining({
      budgetState: 'unknown',
      budgetPausedCronCount: 1,
      reason: 'state_change',
    })
  );
  await observer.close();
  expect(telemetry.close).toHaveBeenCalledOnce();
});

it('preserves structured logs and does not throw when analytics fails', async () => {
  const logger = { info: vi.fn(), warn: vi.fn() };
  const observer = createBudgetHoldObserver(logger);
  telemetry.captureCronBudgetChanged.mockImplementationOnce(() => {
    throw new Error('analytics failed');
  });
  expect(
    observer.observe(config, 'limited', {
      ...emptyBudgetHoldState(),
      pendingTelemetryChanges: [transition],
    })
  ).toBe(true);
  expect(logger.info).toHaveBeenCalledTimes(2);
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('analytics failed')
  );
  await observer.close();
});

it('does not acknowledge startup changes before a runnable account exists', async () => {
  const logger = { info: vi.fn(), warn: vi.fn() };
  const observer = createBudgetHoldObserver(logger);
  const state = {
    ...emptyBudgetHoldState(),
    pendingTelemetryChanges: [transition],
  };
  expect(observer.observe({}, 'limited', state)).toBe(false);
  expect(logger.info).not.toHaveBeenCalled();
  expect(telemetry.captureCronBudgetChanged).not.toHaveBeenCalled();
  expect(state.pendingTelemetryChanges).toEqual([transition]);
  await observer.close();
});
