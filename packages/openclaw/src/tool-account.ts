import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import {
  isMonolithicTlonDeployment,
  listRunnableTlonAccountIds,
  resolveTlonAccount,
} from './types.js';

type DeliveryContextLike = {
  channel?: string;
  accountId?: string;
};

export type ResolveTlonToolAccountInput = {
  cfg: OpenClawConfig;
  agentId?: string | null;
  deliveryContext?: DeliveryContextLike | null;
};

function normalizeId(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function exactBoundAccountIds(cfg: OpenClawConfig, agentId: string): string[] {
  const ids = new Set<string>();
  for (const binding of cfg.bindings ?? []) {
    if (
      binding.type === 'acp' ||
      normalizeId(binding.agentId) !== agentId ||
      normalizeId(binding.match.channel) !== 'tlon'
    ) {
      continue;
    }
    const accountId = binding.match.accountId?.trim();
    if (!accountId || accountId === '*') {
      continue;
    }
    if (resolveTlonAccount(cfg, accountId).configured) {
      ids.add(accountId);
    }
  }
  return [...ids];
}

/**
 * Resolve the only Tlon account a tool run is authorized to use.
 *
 * The model cannot supply an account id. A live Tlon delivery route is the
 * strongest signal; cron/internal runs fall back to the active agent's exact
 * account binding. Legacy single-account installs remain usable without an
 * explicit binding. Any multitenant ambiguity fails closed.
 */
export function resolveTlonToolAccountId(
  input: ResolveTlonToolAccountInput
): string | null {
  const monolithic = isMonolithicTlonDeployment(input.cfg);
  const runnable = listRunnableTlonAccountIds(input.cfg);
  if (runnable.length === 0) {
    if (monolithic) {
      throw new Error(
        'Monolithic Tlon mode requires a configured account and exact agent binding.'
      );
    }
    // Preserve env-credential CLI installs. This is safe only because no
    // configured account exists whose credentials could be selected.
    return null;
  }

  const agentId = normalizeId(input.agentId);
  const bound = agentId ? exactBoundAccountIds(input.cfg, agentId) : [];
  const deliveryAccount =
    normalizeId(input.deliveryContext?.channel) === 'tlon'
      ? input.deliveryContext?.accountId?.trim()
      : undefined;

  if (deliveryAccount) {
    if (!runnable.includes(deliveryAccount)) {
      throw new Error('The active Tlon account is not configured.');
    }
    if (bound.includes(deliveryAccount)) {
      return deliveryAccount;
    }
    if (!monolithic && runnable.length === 1 && bound.length === 0) {
      return deliveryAccount;
    }
    throw new Error('The active agent is not bound to this Tlon account.');
  }

  if (bound.length === 1) {
    return bound[0];
  }
  if (bound.length > 1) {
    throw new Error('The active agent is bound to multiple Tlon accounts.');
  }
  if (!monolithic && runnable.length === 1) {
    return runnable[0];
  }
  throw new Error('Cannot resolve a unique Tlon account for this tool run.');
}
