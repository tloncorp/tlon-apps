import { createApproverRestrictedNativeApprovalCapability } from 'openclaw/plugin-sdk/approval-delivery-runtime';
import { createLazyChannelApprovalNativeRuntimeAdapter } from 'openclaw/plugin-sdk/approval-handler-adapter-runtime';
import type { ChannelApprovalNativeRuntimeAdapter } from 'openclaw/plugin-sdk/approval-handler-runtime';
import type {
  ExecApprovalRequest,
  PluginApprovalRequest,
} from 'openclaw/plugin-sdk/approval-runtime';
import type { ChannelApprovalCapability } from 'openclaw/plugin-sdk/channel-contract';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-contracts';

import { getEffectiveOwnerShip } from './effective-owner.js';
import { normalizeShip, parseTlonTarget } from './targets.js';
import { listTlonAccountIds, resolveTlonAccount } from './types.js';

type ApprovalRequest = ExecApprovalRequest | PluginApprovalRequest;

function resolveApprovalOwner(
  cfg: OpenClawConfig,
  accountId?: string | null
): string | null {
  const resolvedAccountId = accountId?.trim() || 'default';
  const account = resolveTlonAccount(cfg, resolvedAccountId);
  return normalizeShip(
    getEffectiveOwnerShip(resolvedAccountId) ?? account.ownerShip ?? ''
  );
}

function isConfiguredWithOwner(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): boolean {
  const account = resolveTlonAccount(params.cfg, params.accountId);
  return Boolean(
    account.enabled &&
    account.configured &&
    resolveApprovalOwner(params.cfg, params.accountId)
  );
}

function isOwner(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
  senderId?: string | null;
}): boolean {
  const owner = resolveApprovalOwner(params.cfg, params.accountId);
  return Boolean(owner && normalizeShip(params.senderId ?? '') === owner);
}

function isTlonOriginRequest(request: ApprovalRequest): boolean {
  return request.request.turnSourceChannel?.trim().toLowerCase() === 'tlon';
}

function resolveOriginTarget(params: {
  request: ApprovalRequest;
}): { to: string; threadId?: string | number | null } | null {
  if (!isTlonOriginRequest(params.request)) {
    return null;
  }
  const parsed = parseTlonTarget(params.request.request.turnSourceTo ?? '');
  if (!parsed) {
    return null;
  }
  return {
    to: parsed.kind === 'dm' ? parsed.ship : parsed.nest,
    threadId: params.request.request.turnSourceThreadId ?? undefined,
  };
}

function describeApprovalSetup({
  accountId,
}: {
  accountId?: string | null;
}): string {
  const prefix =
    accountId && accountId !== 'default'
      ? `channels.tlon.accounts.${accountId}`
      : 'channels.tlon';
  return `Tlon approval delivery requires a configured \`${prefix}.ownerShip\` and a running Tlon account monitor.`;
}

export const tlonApprovalCapability: ChannelApprovalCapability =
  createApproverRestrictedNativeApprovalCapability({
    channel: 'tlon',
    channelLabel: 'Tlon',
    listAccountIds: listTlonAccountIds,
    hasApprovers: ({ cfg, accountId }) =>
      Boolean(resolveApprovalOwner(cfg, accountId)),
    isExecAuthorizedSender: isOwner,
    isPluginAuthorizedSender: isOwner,
    isNativeDeliveryEnabled: isConfiguredWithOwner,
    resolveNativeDeliveryMode: () => 'dm',
    requireMatchingTurnSourceChannel: true,
    resolveSuppressionAccountId: ({ target, request }) =>
      target.accountId?.trim() ||
      request.request.turnSourceAccountId?.trim() ||
      undefined,
    resolveOriginTarget: ({ request }) => resolveOriginTarget({ request }),
    resolveApproverDmTargets: ({ cfg, accountId }) => {
      const owner = resolveApprovalOwner(cfg, accountId);
      return owner ? [{ to: owner }] : [];
    },
    notifyOriginWhenDmOnly: true,
    describeExecApprovalSetup: describeApprovalSetup,
    describePluginApprovalSetup: describeApprovalSetup,
    nativeRuntime: createLazyChannelApprovalNativeRuntimeAdapter({
      eventKinds: ['exec', 'plugin'],
      isConfigured: ({ cfg, accountId, context }) =>
        Boolean(context) && isConfiguredWithOwner({ cfg, accountId }),
      shouldHandle: ({ cfg, accountId, context, request }) =>
        Boolean(context) &&
        isConfiguredWithOwner({ cfg, accountId }) &&
        isTlonOriginRequest(request),
      load: async () =>
        (await import('./approval-handler.runtime.js'))
          .tlonApprovalNativeRuntime as unknown as ChannelApprovalNativeRuntimeAdapter,
    }),
  });
