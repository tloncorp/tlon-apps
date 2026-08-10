import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import type {
  PluginHookGatewayContext,
  PluginHookGatewayCronService,
} from 'openclaw/plugin-sdk/types';

import { submitStewardAutomationProject } from './steward-automation-adapter.js';
import { normalizeStewardAutomationProject } from './steward-automation-projection.js';

type StewardAutomationCronService = Pick<PluginHookGatewayCronService, 'list'>;

type StewardAutomationCronAccessor =
  | (() => StewardAutomationCronService | undefined)
  | undefined;

export class StewardAutomationCronUnavailableError extends Error {
  readonly retryable = true;

  constructor(reason: 'missing-accessor' | 'missing-service') {
    const detail =
      reason === 'missing-accessor'
        ? 'the gateway hook context did not provide getCron'
        : 'getCron did not provide a cron service';
    super(
      `Steward automation reconciliation is temporarily unavailable: ${detail}`
    );
    this.name = 'StewardAutomationCronUnavailableError';
  }
}

/** Read and submit one complete snapshot from the pinned gateway cron API. */
export async function reconcileStewardAutomation(
  getCron: StewardAutomationCronAccessor
): Promise<void> {
  if (!getCron) {
    throw new StewardAutomationCronUnavailableError('missing-accessor');
  }

  const cron = getCron();
  if (!cron) {
    throw new StewardAutomationCronUnavailableError('missing-service');
  }

  const jobs = await cron.list({ includeDisabled: true });
  const action = normalizeStewardAutomationProject(jobs);
  await submitStewardAutomationProject(action);
}

/**
 * Register complete-snapshot triggers. Errors deliberately reject the hook
 * promise so task 3.5 can retry them; the eventual index wrapper owns logging
 * and isolation from other hook consumers.
 */
export function registerStewardAutomationReconciliationHooks(
  api: Pick<OpenClawPluginApi, 'on'>
): void {
  const reconcile = (ctx: Pick<PluginHookGatewayContext, 'getCron'>) =>
    reconcileStewardAutomation(ctx.getCron);

  api.on('gateway_start', (_event, ctx) => reconcile(ctx));
  api.on('cron_changed', (_event, ctx) => reconcile(ctx));
}
