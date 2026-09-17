import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import {
  type AgentChoiceToolParams,
  agentChoiceToolParameters,
  createAgentChoiceToolExecutor,
} from './agent-choice-tool.js';
import {
  type AgentTaskPlanToolParams,
  agentTaskPlanToolParameters,
  createAgentTaskPlanToolExecutor,
  resolveTaskPlanGroupId,
} from './agent-task-plan-tool.js';
import { tlonChannelConfigSchema } from './config-schema.js';
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
    // These tools belong to the Tlon conversation surface. Registering them
    // as channel tools avoids the host's plugin-id/core-tool name collision
    // for the existing `tlon` CLI tool and keeps them available in every Tlon
    // owner turn.
    agentTools: ({ cfg }) => {
      const account = resolveTlonAccount(cfg ?? {});
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
      const tlonBinary = resolveTlonBinary({
        moduleDir: packageDir,
        resolveModule: require.resolve,
      });
      const postSurface = (
        target: string,
        fallbackText: string,
        blob: string
      ) =>
        runTlonCommand(
          tlonBinary,
          ['posts', 'send', target, fallbackText, '--blob', blob],
          credentials,
          { timeoutMs }
        );
      const executeChoice = createAgentChoiceToolExecutor({
        postChoice: ({ target, fallbackQuestion, blob }) =>
          postSurface(target, fallbackQuestion, blob),
      });
      const executeTaskPlan = createAgentTaskPlanToolExecutor({
        resolveGroupId: async (target) =>
          resolveTaskPlanGroupId(
            await runTlonCommand(
              tlonBinary,
              ['channels', 'groups'],
              credentials,
              { timeoutMs }
            ),
            target
          ),
        postPlan: ({ target, fallbackSummary, blob }) =>
          postSurface(target, fallbackSummary, blob),
      });

      return [
        {
          name: 'tlon_agent_choice',
          label: 'Tlon Agent Choice',
          description:
            'Ask the owner one question using a Tlon A2UI choice control with model-authored options and a free-form answer path. Use it for a low-effort topic-specific discovery question before recurrence consent, or to establish a concrete focus, daily delivery time, topic-specific approach, or another material task detail after consent.',
          promptSnippet:
            '`tlon_agent_choice`: ask one concise question with selectable answers and a write-your-own option',
          promptGuidelines: [
            'For a concrete topic with a vague goal, one topic-specific discovery choice may learn the owner’s context, experience, or useful outcome without implying recurrence. During first-run recurring-task onboarding, ask each narrowing question with `tlon_agent_choice`; never invent a missing topic, daily time, approach, or material preference; include one topic-specific approach question before planning; after any choice posts successfully, return NO_REPLY and wait for the owner.',
          ],
          parameters: agentChoiceToolParameters,
          execute: (id, params) =>
            executeChoice(id, params as AgentChoiceToolParams),
        },
        {
          name: 'tlon_agent_task_plan',
          label: 'Tlon Agent Task Plan',
          description:
            'Post one automatically provisioned daily recurring-task plan during first-run onboarding. ' +
            'Call only after the owner supplied a concrete focus, daily clock time, and topic-specific approach. The trusted client and coordinator create it without a confirmation gate. Use this instead of hand-authoring A2UI or calling cron directly.',
          promptSnippet:
            '`tlon_agent_task_plan`: automatically provision the finished daily recurring task during first-run onboarding',
          promptGuidelines: [
            'During first-run recurring-task onboarding, use `tlon_agent_task_plan` only after the owner supplied a concrete focus, daily clock time, and topic-specific approach; never invent those required values and do not call `cron` directly; after it posts successfully, return NO_REPLY because the deterministic coordinator owns all activation and result status.',
          ],
          parameters: agentTaskPlanToolParameters,
          execute: (id, params) =>
            executeTaskPlan(id, params as AgentTaskPlanToolParams),
        },
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
          'IMPORTANT: media= accepts a public https URL only (normally the URL returned by `tlon upload`).',
          'Local file paths are NOT accepted on this channel (unlike other channels) — upload the file first, then pass the returned https URL.',
          'Media that cannot be fetched will fail the send — never claim an image was delivered unless the tool call succeeded.'
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
