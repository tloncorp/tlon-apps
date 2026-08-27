import {
  createChannelApprovalNativeRuntimeAdapter,
  resolvePreparedApprovalAccountId,
} from 'openclaw/plugin-sdk/approval-handler-runtime';
import type {
  ExecApprovalRequest,
  PluginApprovalRequest,
} from 'openclaw/plugin-sdk/approval-runtime';
import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';

import { buildTlonNativeApprovalPayload } from './approval-presentation.js';
import { normalizeShip, parseTlonTarget } from './targets.js';
import { resolveTlonAccount } from './types.js';
import { withAuthenticatedTlonApi } from './urbit/api-client.js';
import { sendChannelPost, sendDm } from './urbit/send.js';
import { markdownToStory } from './urbit/story.js';

const log = createSubsystemLogger('tlon/approvals');
type ApprovalRequest = ExecApprovalRequest | PluginApprovalRequest;
type ApprovalPayload = { text: string; blob?: string };
type ApprovalTarget = { to: string; accountId: string };
type PendingApproval = ApprovalTarget & { messageId: string };

async function deliver(params: {
  cfg: Parameters<typeof resolveTlonAccount>[0];
  target: ApprovalTarget;
  payload: ApprovalPayload;
  replyToId?: string;
}) {
  const account = resolveTlonAccount(params.cfg, params.target.accountId);
  if (
    !account.enabled ||
    !account.configured ||
    !account.ship ||
    !account.url ||
    !account.code
  ) {
    throw new Error(
      `Tlon account ${params.target.accountId} is not configured`
    );
  }
  const target = parseTlonTarget(params.target.to);
  if (!target) throw new Error(`Invalid Tlon target: ${params.target.to}`);

  return await withAuthenticatedTlonApi(
    {
      url: account.url,
      code: account.code,
      ship: account.ship,
      allowPrivateNetwork: account.allowPrivateNetwork ?? undefined,
    },
    async () => {
      const fromShip = normalizeShip(account.ship ?? '');
      if (!fromShip) throw new Error('Configured Tlon ship is empty');
      if (target.kind === 'dm') {
        return await sendDm({
          fromShip,
          toShip: target.ship,
          text: params.payload.text,
          blob: params.payload.blob,
          replyToId: params.replyToId,
        });
      }
      return await sendChannelPost({
        fromShip,
        nest: target.nest,
        story: markdownToStory(params.payload.text),
        blob: params.payload.blob,
        replyToId: params.replyToId,
      });
    }
  );
}

export const tlonApprovalNativeRuntime =
  createChannelApprovalNativeRuntimeAdapter<
    ApprovalPayload,
    ApprovalTarget,
    PendingApproval,
    never,
    ApprovalPayload
  >({
    eventKinds: ['exec', 'plugin'],
    availability: {
      isConfigured: ({ context }) => Boolean(context),
      shouldHandle: ({ context, request }) =>
        Boolean(context) &&
        (request as ApprovalRequest).request.turnSourceChannel
          ?.trim()
          .toLowerCase() === 'tlon',
    },
    presentation: {
      buildPendingPayload: ({ view }) => buildTlonNativeApprovalPayload(view),
      buildResolvedResult: ({ view }) => ({
        kind: 'update',
        payload: buildTlonNativeApprovalPayload(view),
      }),
      buildExpiredResult: ({ view }) => ({
        kind: 'update',
        payload: buildTlonNativeApprovalPayload(view),
      }),
    },
    transport: {
      prepareTarget: ({ plannedTarget, accountId }) => {
        const parsed = parseTlonTarget(plannedTarget.target.to);
        if (!parsed) return null;
        const target: ApprovalTarget = {
          to: parsed.kind === 'dm' ? parsed.ship : parsed.nest,
          accountId:
            resolvePreparedApprovalAccountId({
              plannedAccountId: (
                plannedTarget.target as { accountId?: string | null }
              ).accountId,
              contextAccountId: accountId,
              fallbackAccountId: 'default',
            }) ?? 'default',
        };
        return {
          dedupeKey: `${target.accountId}:${target.to}`,
          target,
        };
      },
      deliverPending: async ({ cfg, preparedTarget, pendingPayload }) => {
        const result = await deliver({
          cfg,
          target: preparedTarget,
          payload: pendingPayload,
        });
        return result.messageId
          ? { ...preparedTarget, messageId: result.messageId }
          : null;
      },
      updateEntry: async ({ cfg, entry, payload }) => {
        await deliver({
          cfg,
          target: entry,
          payload,
          replyToId: entry.messageId,
        });
      },
    },
    observe: {
      onDeliveryError: ({ error, request }) =>
        log.error(`failed to deliver approval ${request.id}: ${String(error)}`),
    },
  });
