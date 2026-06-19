import { describeAccountSnapshot } from 'openclaw/plugin-sdk/account-helpers';
import { createHybridChannelConfigAdapter } from 'openclaw/plugin-sdk/channel-config-helpers';
import type { ChannelPlugin } from 'openclaw/plugin-sdk/core';
import {
  DEFAULT_ACCOUNT_ID,
  createChatChannelPlugin,
} from 'openclaw/plugin-sdk/core';
import { createLazyRuntimeModule } from 'openclaw/plugin-sdk/lazy-runtime';
import { createRuntimeOutboundDelegates } from 'openclaw/plugin-sdk/outbound-runtime';
import { createLegacyPrivateNetworkDoctorContract } from 'openclaw/plugin-sdk/ssrf-runtime';
import {
  createComputedAccountStatusAdapter,
  createDefaultChannelRuntimeState,
} from 'openclaw/plugin-sdk/status-helpers';

import { tlonMessageActions } from './actions.js';
import { tlonChannelConfigSchema } from './config-schema.js';
import {
  applyTlonSetupConfig,
  createTlonSetupWizardBase,
  resolveTlonSetupConfigured,
  tlonSetupAdapter,
} from './setup-core.js';
import { resolveTlonOutboundSessionRoute } from './session-route.js';
import { formatTargetHint, normalizeShip, parseTlonTarget } from './targets.js';
import { listTlonAccountIds, resolveTlonAccount } from './types.js';

const TLON_CHANNEL_ID = 'tlon' as const;

const loadTlonChannelRuntime = createLazyRuntimeModule(
  () => import('./channel.runtime.js')
);

const tlonSetupWizardProxy = createTlonSetupWizardBase({
  resolveConfigured: async ({ cfg }) =>
    await (
      await loadTlonChannelRuntime()
    ).tlonSetupWizard.status.resolveConfigured({ cfg }),
  resolveStatusLines: async ({ cfg, configured }) =>
    (await (
      await loadTlonChannelRuntime()
    ).tlonSetupWizard.status.resolveStatusLines?.({
      cfg,
      configured,
    })) ?? [],
  finalize: async (params) =>
    await (
      await loadTlonChannelRuntime()
    ).tlonSetupWizard.finalize!(params),
}) satisfies NonNullable<ChannelPlugin['setupWizard']>;

const tlonLegacyPrivateNetworkDoctor = createLegacyPrivateNetworkDoctorContract(
  {
    channelKey: TLON_CHANNEL_ID,
  }
);

const tlonConfigAdapter = createHybridChannelConfigAdapter({
  sectionKey: TLON_CHANNEL_ID,
  listAccountIds: listTlonAccountIds,
  resolveAccount: resolveTlonAccount,
  defaultAccountId: () => DEFAULT_ACCOUNT_ID,
  clearBaseFields: ['ship', 'code', 'url', 'name'],
  preserveSectionOnDefaultDelete: true,
  resolveAllowFrom: (account) => (account.ownerShip ? [account.ownerShip] : []),
  formatAllowFrom: (allowFrom) =>
    allowFrom.map((entry) => normalizeShip(String(entry))).filter(Boolean),
});

export const tlonPlugin = createChatChannelPlugin({
  base: {
    id: TLON_CHANNEL_ID,
    meta: {
      id: TLON_CHANNEL_ID,
      label: 'Tlon',
      selectionLabel: 'Tlon (Urbit)',
      docsPath: '/channels/tlon',
      docsLabel: 'tlon',
      blurb: 'Decentralized messaging on Urbit',
      aliases: ['urbit'],
      order: 90,
    },
    capabilities: {
      chatTypes: ['direct', 'group', 'thread'],
      media: true,
      reply: true,
      threads: true,
      reactions: true,
    },
    threading: {
      resolveReplyToMode: () => 'all',
      buildToolContext: ({ context, hasRepliedRef }) => {
        const threadId = context.MessageThreadId ?? context.ReplyToId;
        return {
          currentChannelId: context.To?.trim() || undefined,
          currentThreadTs: threadId != null ? String(threadId) : undefined,
          hasRepliedRef,
        };
      },
    },
    setup: tlonSetupAdapter,
    setupWizard: tlonSetupWizardProxy,
    reload: { configPrefixes: ['channels.tlon'] },
    configSchema: tlonChannelConfigSchema,
    config: {
      ...tlonConfigAdapter,
      isConfigured: (account) => account.configured,
      describeAccount: (account) =>
        describeAccountSnapshot({
          account,
          configured: account.configured,
          extra: {
            ship: account.ship,
            url: account.url,
          },
        }),
    },
    messaging: {
      targetPrefixes: ['tlon'],
      normalizeTarget: (target) => {
        const parsed = parseTlonTarget(target);
        if (!parsed) {
          return target.trim();
        }
        if (parsed.kind === 'dm') {
          return parsed.ship;
        }
        return parsed.nest;
      },
      parseExplicitTarget: ({ raw }) => {
        const parsed = parseTlonTarget(raw);
        if (!parsed) {
          return null;
        }
        return parsed.kind === 'dm'
          ? { to: parsed.ship, chatType: 'direct' }
          : { to: parsed.nest, chatType: 'group' };
      },
      targetResolver: {
        looksLikeId: (target) => Boolean(parseTlonTarget(target)),
        hint: formatTargetHint(),
      },
      resolveOutboundSessionRoute: (params) =>
        resolveTlonOutboundSessionRoute(params),
    },
    actions: tlonMessageActions,
    agentPrompt: {
      messageToolHints: ({ cfg, accountId }) => {
        const account = resolveTlonAccount(cfg, accountId ?? undefined);
        const hints: string[] = [];

        hints.push(
          '',
          'Tlon gallery channels (heap/~host/name) are for collecting images, links, and media.',
          '- To post to a gallery: use action=send, to=heap/~host/name, message=<text or URL>',
          '- For image posts, include media=<imageUrl> with an optional message=<caption>',
          '- To react to a gallery comment: use action=react, to=heap/~host/name, messageId=<commentId>, parentId=<postId>, emoji=<emoji>'
        );

        const level = account.reactionLevel ?? 'minimal';
        if (level !== 'off' && level !== 'ack') {
          if (level === 'extensive') {
            hints.push(
              '',
              'Reactions are enabled for Tlon in EXTENSIVE mode.',
              'Feel free to react liberally:',
              '- Acknowledge messages with appropriate emojis',
              '- Express sentiment and personality through reactions',
              '- React to interesting content, humor, or notable events',
              '- Use reactions to confirm understanding or agreement',
              '- Use action=react with emoji, messageId, and target (channel nest or DM ship)',
              'Guideline: react whenever it feels natural.'
            );
          } else {
            hints.push(
              '',
              'Reactions are enabled for Tlon in MINIMAL mode.',
              'React ONLY when truly relevant:',
              '- Acknowledge important user requests or confirmations',
              '- Express genuine sentiment (humor, appreciation) sparingly',
              '- Avoid reacting to routine messages or your own replies',
              '- Use action=react with emoji, messageId, and target (channel nest or DM ship)',
              'Guideline: at most 1 reaction per 5-10 exchanges.'
            );
          }
        }

        return hints;
      },
    },
    status: createComputedAccountStatusAdapter<
      ReturnType<typeof resolveTlonAccount>
    >({
      defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID),
      collectStatusIssues: (accounts) => {
        return accounts.flatMap((account) => {
          if (!account.configured) {
            return [
              {
                channel: TLON_CHANNEL_ID,
                accountId: account.accountId,
                kind: 'config',
                message: 'Account not configured (missing ship, code, or url)',
              },
            ];
          }
          return [];
        });
      },
      buildChannelSummary: ({ snapshot }) => {
        const s = snapshot as {
          configured?: boolean;
          ship?: string;
          url?: string;
        };
        return {
          configured: s.configured ?? false,
          ship: s.ship ?? null,
          url: s.url ?? null,
        };
      },
      probeAccount: async ({ account }) => {
        if (
          !account.configured ||
          !account.ship ||
          !account.url ||
          !account.code
        ) {
          return { ok: false, error: 'Not configured' };
        }
        return await (
          await loadTlonChannelRuntime()
        ).probeTlonAccount(account as never);
      },
      resolveAccountSnapshot: ({ account }) => ({
        accountId: account.accountId,
        name: account.name ?? undefined,
        enabled: account.enabled,
        configured: account.configured,
        extra: {
          ship: account.ship,
          url: account.url,
        },
      }),
    }),
    gateway: {
      startAccount: async (ctx) =>
        await (await loadTlonChannelRuntime()).startTlonGatewayAccount(ctx),
    },
    doctor: {
      legacyConfigRules: tlonLegacyPrivateNetworkDoctor.legacyConfigRules,
      normalizeCompatibilityConfig:
        tlonLegacyPrivateNetworkDoctor.normalizeCompatibilityConfig,
    },
  },
  outbound: {
    deliveryMode: 'direct',
    textChunkLimit: 10000,
    resolveTarget: ({ to }) => {
      const parsed = parseTlonTarget(to ?? '');
      if (!parsed) {
        return {
          ok: false,
          error: new Error(`Invalid Tlon target. Use ${formatTargetHint()}`),
        };
      }
      if (parsed.kind === 'dm') {
        return { ok: true, to: parsed.ship };
      }
      return { ok: true, to: parsed.nest };
    },
    ...createRuntimeOutboundDelegates({
      getRuntime: loadTlonChannelRuntime,
      sendText: { resolve: (runtime) => runtime.tlonRuntimeOutbound.sendText },
      sendMedia: {
        resolve: (runtime) => runtime.tlonRuntimeOutbound.sendMedia,
      },
    }),
  },
});
