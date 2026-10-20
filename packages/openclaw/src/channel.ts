import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeAccountSnapshot } from 'openclaw/plugin-sdk/account-helpers';
import { createHybridChannelConfigAdapter } from 'openclaw/plugin-sdk/channel-config-helpers';
import { createRuntimeOutboundDelegates } from 'openclaw/plugin-sdk/channel-outbound';
import type { ChannelPlugin } from 'openclaw/plugin-sdk/core';
import {
  DEFAULT_ACCOUNT_ID,
  createChatChannelPlugin,
} from 'openclaw/plugin-sdk/core';
import { createLazyRuntimeModule } from 'openclaw/plugin-sdk/lazy-runtime';
import { createLegacyPrivateNetworkDoctorContract } from 'openclaw/plugin-sdk/ssrf-runtime';
import {
  createComputedAccountStatusAdapter,
  createDefaultChannelRuntimeState,
} from 'openclaw/plugin-sdk/status-helpers';

import { tlonMessageActions } from './actions.js';
import {
  type AgentChoiceToolParams,
  agentChoiceToolMetadata,
  agentChoiceToolParameters,
  createAgentChoiceToolExecutor,
} from './agent-choice-tool.js';
import {
  type AgentServiceSetupToolParams,
  agentServiceSetupToolMetadata,
  agentServiceSetupToolParameters,
  createAgentServiceSetupToolExecutor,
} from './agent-service-setup-tool.js';
import {
  type AgentTaskPlanToolParams,
  agentTaskPlanToolMetadata,
  agentTaskPlanToolParameters,
  createAgentTaskPlanToolExecutor,
  resolveOnboardingDmGroupId,
  resolveTaskPlanGroupId,
} from './agent-task-plan-tool.js';
import { tlonChannelConfigSchema } from './config-schema.js';
import {
  connectableServicesToolMetadata,
  connectableServicesToolParameters,
  createConnectableServicesToolExecutor,
  loadConnectableServices,
  resolveConnectableServicesUrl,
} from './connectable-services.js';
import {
  assertTlonChoiceCallCurrent,
  assertTlonServiceSetupCallCurrent,
  finishTlonChoiceCall,
  assertTlonTaskPlanCallCurrent,
  finishTlonTaskPlanCall,
  getTlonTaskPlanEvidence,
} from './onboarding-tool-boundary.js';
import { resolveTlonOutboundSessionRoute } from './session-route.js';
import {
  applyTlonSetupConfig,
  createTlonSetupWizardBase,
  resolveTlonSetupConfigured,
  tlonSetupAdapter,
} from './setup-core.js';
import { formatTargetHint, normalizeShip, parseTlonTarget } from './targets.js';
import { resolveTlonBinary } from './tlon-binary.js';
import {
  DEFAULT_TLON_CLI_TIMEOUT_MS,
  runTlonCommand,
} from './tlon-command-runner.js';
import {
  getActiveTlonTurnAccountId,
  observeActiveTlonTurnDelivery,
} from './turn-recorder.js';
import { listTlonAccountIds, resolveTlonAccount } from './types.js';

const TLON_CHANNEL_ID = 'tlon' as const;
const require = createRequire(import.meta.url);
const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

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
      inferTargetChatType: ({ to }) => {
        const parsed = parseTlonTarget(to);
        return parsed?.kind === 'dm' ? 'direct' : parsed ? 'group' : undefined;
      },
      targetResolver: {
        looksLikeId: (target) => Boolean(parseTlonTarget(target)),
        hint: formatTargetHint(),
        resolveTarget: async ({ input, normalized }) => {
          const parsed = parseTlonTarget(normalized) ?? parseTlonTarget(input);
          if (!parsed) {
            return null;
          }
          const to = parsed.kind === 'dm' ? parsed.ship : parsed.nest;
          return {
            to,
            kind: parsed.kind === 'dm' ? 'user' : 'group',
            display: to,
            source: to === normalized ? 'normalized' : 'directory',
          };
        },
      },
      resolveOutboundSessionRoute: (params) =>
        resolveTlonOutboundSessionRoute(params),
    },
    actions: tlonMessageActions,
    // These tools belong to the Tlon conversation surface. Registering them
    // as channel tools avoids the host's plugin-id/core-tool name collision
    // for the existing `tlon` CLI tool and keeps them available in every Tlon
    // owner turn.
    agentTools: ({ cfg }) => {
      const tlonBinary = resolveTlonBinary({
        moduleDir: packageDir,
        resolveModule: require.resolve,
      });
      const runForActiveAccount = (args: string[]) => {
        const account = resolveTlonAccount(
          cfg ?? {},
          getActiveTlonTurnAccountId() ?? undefined
        );
        const credentials =
          account.configured && account.url && account.ship && account.code
            ? {
                url: account.url,
                ship: account.ship,
                code: account.code,
              }
            : undefined;
        const timeoutMs =
          account.lifecycle.toolTimeoutMs ?? DEFAULT_TLON_CLI_TIMEOUT_MS;
        return runTlonCommand(tlonBinary, args, credentials, { timeoutMs });
      };
      const postSurface = (
        target: string,
        fallbackText: string,
        blob: string
      ) =>
        observeActiveTlonTurnDelivery(() =>
          runForActiveAccount([
            'posts',
            'send',
            target,
            fallbackText,
            '--blob',
            blob,
          ])
        );
      const executeChoice = createAgentChoiceToolExecutor({
        assertCurrent: assertTlonChoiceCallCurrent,
        finish: finishTlonChoiceCall,
        postChoice: ({ target, fallbackQuestion, blob }) =>
          postSurface(target, fallbackQuestion, blob),
      });
      const listServices = () => loadConnectableServices();
      const executeServiceSetup = createAgentServiceSetupToolExecutor({
        assertCurrent: assertTlonServiceSetupCallCurrent,
        postSetup: ({ target, fallbackMessage, blob }) =>
          postSurface(target, fallbackMessage, blob),
        listServices,
      });
      const executeConnectableServices = createConnectableServicesToolExecutor({
        listServices,
      });
      const executeTaskPlan = createAgentTaskPlanToolExecutor({
        getEvidence: getTlonTaskPlanEvidence,
        assertCurrent: assertTlonTaskPlanCallCurrent,
        finish: finishTlonTaskPlanCall,
        resolveGroupId: async (target, evidence) => {
          if (target.startsWith('~')) {
            return resolveOnboardingDmGroupId(target, evidence);
          }
          return resolveTaskPlanGroupId(
            await runForActiveAccount(['channels', 'groups']),
            target
          );
        },
        postPlan: ({ target, fallbackSummary, blob }) =>
          postSurface(target, fallbackSummary, blob),
      });

      return [
        {
          ...agentChoiceToolMetadata,
          parameters: agentChoiceToolParameters,
          execute: (id, params) =>
            executeChoice(id, params as AgentChoiceToolParams),
        },
        {
          ...agentTaskPlanToolMetadata,
          parameters: agentTaskPlanToolParameters,
          execute: (id, params) =>
            executeTaskPlan(id, params as AgentTaskPlanToolParams),
        },
        {
          ...agentServiceSetupToolMetadata,
          parameters: agentServiceSetupToolParameters,
          execute: (id, params) =>
            executeServiceSetup(id, params as AgentServiceSetupToolParams),
        },
        // Only hosted bots have a Connected services screen to answer from.
        ...(resolveConnectableServicesUrl()
          ? [
              {
                ...connectableServicesToolMetadata,
                parameters: connectableServicesToolParameters,
                execute: () => executeConnectableServices(),
              },
            ]
          : []),
      ];
    },
    agentPrompt: {
      messageToolHints: ({ cfg, accountId }) => {
        const account = resolveTlonAccount(cfg, accountId ?? undefined);
        const hints: string[] = [];

        hints.push(
          '',
          'When the owner changes or cancels recurring work, reconcile the complete set of cron jobs for that same user intent.',
          '- List all jobs, including disabled jobs, and inspect every job whose name, description, or payload matches the requested subject. Do not stop after the first broad match.',
          '- Update or remove every obsolete declaration so no duplicate or related job keeps the superseded cadence or behavior. If the intended scope is genuinely ambiguous, ask before changing jobs.',
          '- List the jobs again after writing and only claim completion after verifying that no matching job retains the old cadence or behavior.',
          '',
          'Tlon gallery channels (heap/~host/name) are for collecting images, links, and media.',
          '- When you were triggered from a gallery post, your normal reply is posted as a comment on that post. Use action=send only when you intend to create a separate NEW top-level gallery item.',
          '- To post to a gallery: use action=send, to=heap/~host/name, message=<text or URL>',
          '- For image posts, include media=<imageUrl> with an optional message=<caption>',
          '- To react to a gallery comment: use action=react, to=heap/~host/name, messageId=<commentId>, parentId=<postId>, emoji=<emoji>',
          '',
          'media= accepts a public https URL. With TLON_HOSTING enabled, local files in the allowed media directories are uploaded automatically; otherwise upload with `tlon upload` first.',
          'Media that cannot be fetched will fail the send — never claim an image was delivered unless the tool call succeeded.',
          '',
          'On Tlon, action=react and action=delete only work on messages in the current conversation.',
          '- To react, unreact, or delete in any other conversation, use the tlon tool instead: `tlon posts react|unreact|delete <channel> <postId> ...` for channels, `tlon dms react|unreact|delete ~ship <postId> ...` for DMs.',
          '- If a reaction or delete call returns an error, say it failed; never claim it succeeded.',
          '',
          "Mentions: ~ship mentions a person; @role-id (the id shown when reading, e.g. @admin) mentions a group role and @all every member; DMs support @all only. An @word that is not a role of the channel's group is sent as plain text. Mentions notify only in plain text (not inside bold, quotes or headings). Use @all only when asked.",
          '',
          'When you act in another channel (a note, a post, a new group or channel, a cron job that posts elsewhere), include the returned Ref: path in your reply here. A bare reference path on its own line renders as a card; do not wrap it in a link or bold. The messageId a send returns is not the post ID — read the ID back before referencing a post: `tlon messages channel <nest>` for /1/chan/<nest>/msg/<id>, or `tlon messages post <nest> <parent>` for a thread reply at /1/chan/<nest>/msg/<parent>/<id>.'
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
              '- Use action=react with emoji, messageId, and target (the current channel nest or DM ship)',
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
              '- Use action=react with emoji, messageId, and target (the current channel nest or DM ship)',
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
      sendPayload: {
        resolve: (runtime) => runtime.tlonRuntimeOutbound.sendPayload,
      },
      sendText: { resolve: (runtime) => runtime.tlonRuntimeOutbound.sendText },
      sendMedia: {
        resolve: (runtime) => runtime.tlonRuntimeOutbound.sendMedia,
      },
    }),
  },
});
