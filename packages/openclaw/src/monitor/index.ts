import type { Story } from '@tloncorp/api';
import { randomUUID } from 'node:crypto';
import { format } from 'node:util';
import { createTypingCallbacks } from 'openclaw/plugin-sdk/channel-runtime';
import type { OpenClawConfig, ReplyPayload } from 'openclaw/plugin-sdk/core';
import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import {
  type TlonAuthPhase,
  authRetryDelayMs,
  authRetryStateKey,
  clearAuthRetryState,
  recordAuthRetryFailure,
} from '../auth-retry-state.js';
import {
  findRecentContextLensById,
  publishContextLensEvent,
  setContextLensEventCapacity,
} from '../context-lens-events.js';
import {
  isContextLensEffectivelyEnabled,
  resolveLensOwner,
} from '../context-lens-ship-sync.js';
import { getContextLensStore } from '../context-lens-store.js';
import {
  type ContextLensTrigger,
  bindContextLensToSession,
  buildRetryDispatch,
  createContextLensRegistry,
  unbindContextLensFromSession,
} from '../context-lens.js';
import { scheduleCronSnapshot } from '../cron-telemetry.js';
import {
  getEffectiveOwnerShip,
  setEffectiveOwnerShip,
} from '../effective-owner.js';
import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
  gateGatewayStatusActivation,
  getGatewayStatusCoordinator,
} from '../gateway-status.js';
import { handleOwnerListenCommand } from '../owner-listen-command.js';
import {
  type PendingNudge,
  clearPendingNudge,
  getPendingNudge,
  isNudgeEligible,
  registerPersistCallback,
  setPendingNudge,
  syncPendingNudgeFromStore,
} from '../pending-nudge.js';
import { emitTlonPluginErrorTelemetry } from '../plugin-error-observability.js';
import { getTlonRuntime } from '../runtime.js';
import { setSessionRole } from '../session-roles.js';
import {
  DM_INVITE_PREVIEW,
  type TlonSettingsStore,
  createSettingsManager,
} from '../settings.js';
import {
  armSetupProgress,
  disarmSetupProgress,
  isSetupProgressLine,
} from '../setup-progress.js';
import { sharedSlot } from '../shared-state.js';
import {
  canonicalizeNest,
  normalizeShip,
  parseChannelNest,
} from '../targets.js';
import {
  type TlonDeliverySkipReason,
  type TlonPluginErrorEvent,
  type TlonPluginErrorSource,
  createTlonTelemetry,
  formatTlonTelemetryErrorText,
  setCronTelemetryReporter,
  setDebugTelemetryReporter,
  setErrorTelemetryReporter,
  setOutboundRouteReporter,
  setSessionTelemetryReporter,
} from '../telemetry.js';
import {
  type TlonAgentTurnSummary,
  observeActiveTlonTurnDelivery,
  recordActiveTlonTurnSourceReply,
  startTlonAgentTurn,
} from '../turn-recorder.js';
import { resolveTlonAccount } from '../types.js';
import { configureTlonApiWithPoke } from '../urbit/api-client.js';
import {
  authenticate,
  isPermanentAuthenticationFailure,
} from '../urbit/auth.js';
import {
  serializeBlobField,
  serializeContextLensReferenceBlob,
} from '../urbit/blob.js';
import { ssrfPolicyFromAllowPrivateNetwork } from '../urbit/context.js';
import { describeError } from '../urbit/errors.js';
import type { DmInvite, Foreigns } from '../urbit/foreigns.js';
import { type BotProfile, sendChannelPost, sendDm } from '../urbit/send.js';
import { UrbitSSEClient } from '../urbit/sse-client.js';
import { markdownToStory } from '../urbit/story.js';
import {
  formatTlonVersionIdentity,
  resolveTlonSkillVersion,
} from '../version.js';
import {
  GROUP_INTRO_MESSAGE,
  INVITE_CARD_LEAD,
  INVITE_FOLLOWUP_MESSAGE,
  PURPOSE_PICKER_PROMPT,
  SERVICES_CARD_LEAD,
  TOPICS_PICKER_PROMPT,
} from './agent-onboarding-config.js';
import {
  agentHasAdminSeat,
  brokenConfigDescriptionError,
  buildInviteCardBlob,
  buildPurposePickerBlob,
  buildServicesCardBlob,
  buildTopicsPickerBlob,
  channelHasNoPosts,
  derivePendingPurposeFromHistory,
  descriptionHasConfiguredJob,
  findAgentGroupsAwaitingOpening,
  findChatNestForGroup,
  findGroupForChannel,
  homeGroupAwaitingOpening,
  homeGroupChatNestFor,
  homeGroupFlagFor,
  inviteCardFallbackText,
  isFirstConfiguredSetup,
  isHomeGroupFlag,
  isPurposePickerChoice,
  purposePickerFallbackText,
  renderSetupDirective,
  servicesCardFallbackText,
  setupOutputNotebookNest,
  shouldOfferPickerOnJoin,
  shouldOfferPurposePicker,
  shouldOfferTopicsPicker,
  topicsPickerAnswered,
  topicsPickerFallbackText,
} from './agent-onboarding.js';
import {
  type DisplayContext,
  type PendingApproval,
  buildApprovalA2UIBlob,
  buildPendingApprovalsResponse,
  createPendingApproval,
  emojiToApprovalAction,
  findPendingApproval,
  formatApprovalConfirmation,
  formatApprovalRequestNotification,
  formatBlockedList,
  isExpired,
  normalizeNotificationId,
  pruneExpired,
  removePendingApproval,
} from './approval.js';
import {
  handleChannelReaction,
  processChannelReactionSnapshot,
} from './channel-reactions.js';
import { buildReplayMessageText, resolveCites } from './cite.js';
import {
  type ApprovalCommandBridge,
  removeBridge,
  setBridge,
} from './command-bridge.js';
import { createComputingPresenceTracker } from './computing-presence.js';
import { fetchAllChannels, fetchInitData } from './discovery.js';
import { dmReactionReplyParentId } from './dm-reactions.js';
import {
  buildThreadContextMessage,
  cacheMessage,
  fetchChannelHistory,
  fetchParentPostAuthor,
  fetchThreadContextHistory,
  getChannelHistory,
  lookupCachedMessage,
  lookupOrFetchCachedChannelMessage,
  renderHistoryContent,
} from './history.js';
import {
  downloadBlobAttachments,
  downloadMessageImages,
  formatBlobAnnotations,
  parseBlobData,
} from './media.js';
import { createNudgeRunner, shouldStartNudgeRunner } from './nudge-runner.js';
import {
  clearShadowsForAccount,
  getLastNudgeStageShadow,
  getLastOwnerActivity,
  ownerActivityFromSettings,
  setLastNudgeStageShadow,
  setLastOwnerActivity,
} from './nudge-state.js';
import { recordSentTlonReply } from './output.js';
import { createOwnerReplyPersistenceQueue } from './owner-reply-persistence.js';
import { createPendingNudgePersistenceQueue } from './pending-nudge-persistence.js';
import { createProcessedMessageTracker } from './processed-messages.js';
import {
  type TlonInboundRouteRecord,
  isRouteDebugEnabled,
  recordTlonRouteAndDispatch,
  routeUpdateWillSkipByPin,
  tlonDeliveryContext,
} from './session-routing.js';
import { resolveSettingsMirrorSync } from './settings-sync.js';
import { resolveTlonSourceReplyDeliveryMode } from './source-reply-delivery.js';
import {
  parseSseStaleThresholdMs,
  parseSseWatchdogIntervalMs,
} from './sse-watchdog-config.js';
import {
  extractCites,
  formatModelName,
  isChannelRestricted,
  isDmAllowed,
  isOwnerListenSlashCommand,
  isSummarizationRequest,
  prepareInboundText,
  sanitizeMessageText,
  shouldEngageInGroup,
  stripBotMentionOutsidePlaceholders,
} from './utils.js';
import { probeWebSearchBootStatus } from './web-search-status.js';

// Local structural types — @tloncorp/api defines these internally but
// does not export them from its public entrypoint.
type Author = string | { ship: string };
type Essay = {
  content: Story;
  author: Author;
  sent: number;
  blob?: string | null;
};
type Seal = { 'parent-id'?: string; parent?: string; [k: string]: unknown };
type ChannelResponse = {
  post?: {
    id?: string;
    'r-post'?: {
      set?: { essay?: Essay; seal?: Seal } | null;
      reply?: {
        id?: string;
        'r-reply'?: {
          set?: { 'reply-essay'?: Essay; seal?: Seal };
          reacts?: Record<string, unknown>;
        };
      };
      reacts?: Record<string, unknown>;
    };
  };
};
type WritResponseDelta =
  | {
      add?: { essay?: Essay };
      reply?: never;
      'add-react'?: never;
      'del-react'?: never;
    }
  | {
      reply?: {
        id?: string;
        delta?: { add?: { 'reply-essay'?: Essay; id?: string } };
      };
      add?: never;
      'add-react'?: never;
      'del-react'?: never;
    }
  | {
      'add-react'?: { react: string; author: string; ship?: string };
      add?: never;
      reply?: never;
      'del-react'?: never;
    }
  | {
      'del-react'?: { author?: string; ship?: string };
      add?: never;
      reply?: never;
      'add-react'?: never;
    };
type WritResponse = { whom: string; id: string; response: WritResponseDelta };
/**
 * How long a reply may take before the run is abandoned.
 *
 * This is a backstop against a wedged turn, not a pace the agent should have
 * to keep. A turn that actually does something — searching the web, creating
 * a channel, writing a note, scheduling a job — spends minutes in tool calls,
 * and the old two-minute cap killed those turns mid-way: the owner saw "Give
 * me a few seconds" and then silence, with the work half-applied and no
 * closing message. Ten minutes leaves room for real work while still
 * bounding a run that has stopped making progress. Override per account with
 * `channels.tlon.runTimeoutMs`.
 */
const DEFAULT_RUN_TIMEOUT_MS = 600_000;

function normalizeRunTimeoutMs(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1_000
    ? Math.floor(value)
    : DEFAULT_RUN_TIMEOUT_MS;
}

// Holds the data needed for any module-loader context to (re)configure its
// own @tloncorp/api singleton — see gateway-status.ts for why this is
// necessary under OpenClaw >=2026.4.27 plugin module isolation.
const apiClientParamsSlot = sharedSlot<SharedApiClientParams>(
  API_CLIENT_PARAMS_SLOT
);

export type MonitorTlonOpts = {
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  accountId?: string | null;
  /**
   * Channel-start config snapshot (the gateway adapter's `ctx.cfg`), used
   * instead of an independent `core.config.loadConfig()` call so
   * gateway-status eligibility (Fix B) reads the SAME config OpenClaw used
   * to enumerate/start accounts, avoiding a transient mismatch if a second
   * config write races. Falls back to `loadConfig()` when absent (e.g. a
   * caller that doesn't thread a snapshot through).
   */
  cfg?: OpenClawConfig;
};

type ChannelAuthorization = {
  // "allowlist" is what the app saves (and Solaris stores); "restricted" is the
  // legacy value still written by the approval flow. Both gate senders; only
  // "open" is unrestricted. See isChannelRestricted.
  mode?: 'restricted' | 'allowlist' | 'open';
  allowedShips?: string[];
};

/**
 * Channel firehose event structure (subscription to /v4 on channels agent)
 */
interface ChannelFirehoseEvent {
  nest: string;
  response: ChannelResponse;
}

/**
 * Chat/DM firehose can be an array of DM invites or a WritResponse
 */
type ChatFirehoseEvent = DmInvite[] | WritResponse;

/** Refresh stale settings subscription state periodically as a fallback for silently-dead SSE subscriptions. */
const SETTINGS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function classifyPluginError(error: unknown): string {
  if (error instanceof Error) {
    return error.name || 'Error';
  }
  return typeof error;
}

/**
 * Extract ship from author field, handling both string (ship) and object (bot-meta) formats.
 */
function extractAuthorShip(author: Author | undefined | null): string {
  if (typeof author === 'object' && author !== null && 'ship' in author) {
    return author.ship;
  }
  return typeof author === 'string' ? author : '';
}

/**
 * Resolve channel authorization by merging file config with settings store.
 * Settings store takes precedence for fields it defines.
 */
function resolveChannelAuthorization(
  cfg: OpenClawConfig,
  channelNest: string,
  settings?: TlonSettingsStore
): { mode: 'restricted' | 'allowlist' | 'open'; allowedShips: string[] } {
  const tlonConfig = cfg.channels?.tlon as
    | {
        authorization?: { channelRules?: Record<string, ChannelAuthorization> };
        defaultAuthorizedShips?: string[];
      }
    | undefined;

  // Merge channel rules: settings override file config
  const fileRules = tlonConfig?.authorization?.channelRules ?? {};
  const settingsRules = settings?.channelRules ?? {};
  const rule = settingsRules[channelNest] ?? fileRules[channelNest];

  // Merge default authorized ships: settings override file config
  const defaultShips =
    settings?.defaultAuthorizedShips ??
    tlonConfig?.defaultAuthorizedShips ??
    [];

  const allowedShips = rule?.allowedShips ?? defaultShips;
  const mode = rule?.mode ?? 'restricted';
  return { mode, allowedShips };
}

export async function monitorTlonProvider(
  opts: MonitorTlonOpts = {}
): Promise<void> {
  const core = getTlonRuntime();
  // Prefer the channel-start config snapshot (Fix B) over an independent
  // load: see the MonitorTlonOpts.cfg doc comment.
  const cfg = opts.cfg ?? core.config.loadConfig();
  if (cfg.channels?.tlon?.enabled === false) {
    return;
  }

  const logger = core.logging.getChildLogger({ module: 'tlon-auto-reply' });
  const formatRuntimeMessage = (...args: Parameters<RuntimeEnv['log']>) =>
    format(...args);
  const runtime: RuntimeEnv = opts.runtime ?? {
    log: (...args) => {
      logger.info(formatRuntimeMessage(...args));
    },
    error: (...args) => {
      logger.error(formatRuntimeMessage(...args));
    },
    exit: (code: number): never => {
      throw new Error(`exit ${code}`);
    },
  };

  const account = resolveTlonAccount(cfg, opts.accountId ?? undefined);
  if (!account.enabled) {
    return;
  }
  if (!account.configured || !account.ship || !account.url || !account.code) {
    throw new Error('Tlon account not configured (ship/url/code required)');
  }

  // Capture validated values for use in nested functions
  const accountUrl = account.url;
  const accountCode = account.code;

  const botShipName = normalizeShip(account.ship);
  if (!botShipName) {
    throw new Error('Tlon account ship is empty after normalization');
  }
  const tlonSkillVersion = await resolveTlonSkillVersion();
  let effectiveOwnerShip: string | null = account.ownerShip
    ? normalizeShip(account.ownerShip)
    : null;
  setEffectiveOwnerShip(account.accountId, effectiveOwnerShip);
  const telemetry = createTlonTelemetry({
    config: account.telemetry,
    runtime,
  });
  const currentTelemetryOwnerShip = () =>
    getEffectiveOwnerShip(account.accountId) ?? effectiveOwnerShip;
  const capturePluginError = (
    pluginErrorSource: TlonPluginErrorSource,
    error: unknown,
    extra?: {
      errorKind?: string | null;
      attempt?: number | null;
      downMs?: number | null;
      authPhase?: TlonAuthPhase | null;
    }
  ) => {
    const event: TlonPluginErrorEvent = {
      harness: 'openclaw',
      pluginErrorSource,
      accountId: account.accountId,
      ownerShip: currentTelemetryOwnerShip(),
      botShip: botShipName,
      errorKind: extra?.errorKind ?? classifyPluginError(error),
      errorText: formatTlonTelemetryErrorText(error),
      attempt: extra?.attempt ?? null,
      downMs: extra?.downMs ?? null,
      authPhase: extra?.authPhase ?? null,
    };
    emitTlonPluginErrorTelemetry(event, { postHog: telemetry });
  };
  runtime.log?.(`[tlon] Starting monitor for ${botShipName}`);
  runtime.log?.(
    `[tlon] version: ${formatTlonVersionIdentity({
      markdown: false,
      harnessVersion: core.version,
      tlonSkillVersion,
    }).replace(/\n/g, ' | ')}`
  );

  const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(
    account.allowPrivateNetwork
  );

  // Helper to authenticate with retry logic
  async function authenticateWithRetry(
    source: 'auth' | 're_auth' = 'auth'
  ): Promise<string> {
    const authPhase: TlonAuthPhase = source === 'auth' ? 'startup' : 're_auth';
    const retryStateKey = authRetryStateKey({
      accountId: account.accountId,
      botShip: botShipName,
    });

    for (let attempt = 1; ; attempt++) {
      if (opts.abortSignal?.aborted) {
        throw new Error('Aborted while waiting to authenticate');
      }
      try {
        runtime.log?.(`[tlon] Attempting authentication to ${accountUrl}...`);
        const cookie = await authenticate(accountUrl, accountCode, {
          ssrfPolicy,
        });
        clearAuthRetryState(retryStateKey);
        return cookie;
      } catch (error: any) {
        const failure = recordAuthRetryFailure(retryStateKey);
        const permanentAuthFailure = isPermanentAuthenticationFailure(error);
        const errorKind = classifyPluginError(error);
        const errorText = formatTlonTelemetryErrorText(error);

        if (permanentAuthFailure || failure.shouldCapturePluginError) {
          capturePluginError(source, error, {
            attempt: failure.attempt,
            downMs: failure.downMs,
            authPhase,
          });
          runtime.error?.(
            `[tlon] Failed to authenticate after ${Math.round(failure.downMs / 1000)}s (${authPhase}, attempt ${failure.attempt}): ${error?.message ?? String(error)}`
          );
        } else {
          telemetry?.captureAuthAttemptFailed({
            harness: 'openclaw',
            pluginErrorSource: source,
            authPhase,
            accountId: account.accountId,
            ownerShip: currentTelemetryOwnerShip(),
            botShip: botShipName,
            errorKind,
            errorText,
            attempt: failure.attempt,
            downMs: failure.downMs,
          });
          runtime.log?.(
            `[tlon] Waiting for moon (${authPhase}, attempt ${failure.attempt}, ${Math.round(failure.downMs / 1000)}s elapsed): ${error?.message ?? String(error)}`
          );
        }

        // Permanent login failures should be actionable immediately. Transient
        // failures stay in this monitor until the grace window has produced a
        // Plugin Error, rather than relying on a fixed attempt count that can
        // expire before three minutes when failures return quickly.
        if (permanentAuthFailure || failure.shouldCapturePluginError) {
          throw error;
        }
        const delay = authRetryDelayMs(attempt);
        runtime.log?.(`[tlon] Retrying authentication in ${delay}ms...`);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          if (opts.abortSignal) {
            const onAbort = () => {
              clearTimeout(timer);
              reject(new Error('Aborted'));
            };
            opts.abortSignal.addEventListener('abort', onAbort, { once: true });
          }
        });
      }
    }
  }

  // Map a subscription's gall app (+ path where one app carries several
  // subscriptions) onto the telemetry error-source vocabulary.
  const subscriptionErrorSource = (
    app: string,
    path: string
  ): TlonPluginErrorSource => {
    switch (app) {
      case 'chat':
        return 'chat_firehose';
      case 'channels':
        return 'channels_firehose';
      case 'contacts':
        return 'contacts_subscription';
      case 'steward':
        return 'steward_subscription';
      case 'groups':
        return path === '/v1/foreigns'
          ? 'foreigns_subscription'
          : 'groups_ui_subscription';
      default:
        return 'settings_refresh';
    }
  };

  let api: UrbitSSEClient | null = null;
  let cookie: string;
  // Stream-watchdog thresholds are normally hardcoded defaults in the client.
  // The E2E harness overrides them via env so a detached-network fault surfaces
  // within the scenario's wait window (see TLON_NUDGE_TICK_INTERVAL_MS for the
  // same harness-knob precedent). Only applied when they parse to a safe value;
  // the stale parser rejects negative/whitespace typos so they can't silently
  // disable the watchdog (only an explicit 0 does).
  const sseStaleOverride = parseSseStaleThresholdMs(
    process.env.TLON_SSE_STALE_THRESHOLD_MS
  );
  const sseWatchdogOverride = parseSseWatchdogIntervalMs(
    process.env.TLON_SSE_WATCHDOG_INTERVAL_MS
  );
  try {
    cookie = await authenticateWithRetry();
    api = new UrbitSSEClient(account.url, cookie, {
      ship: botShipName,
      ssrfPolicy,
      ...(sseStaleOverride !== undefined
        ? { streamStaleThresholdMs: sseStaleOverride }
        : {}),
      ...(sseWatchdogOverride !== undefined
        ? { streamWatchdogIntervalMs: sseWatchdogOverride }
        : {}),
      logger: {
        log: (message) => runtime.log?.(message),
        error: (message) => runtime.error?.(message),
      },
      // Re-authenticate on reconnect in case the session expired
      onReconnect: async (client) => {
        runtime.log?.('[tlon] Re-authenticating on SSE reconnect...');
        const newCookie = await authenticateWithRetry('re_auth');
        client.updateCookie(newCookie);
        runtime.log?.('[tlon] Re-authentication successful');
      },
      // A dead inbound subscription means silently lost messages (incident
      // 2026-07-07: chat firehose died for 5.5h with zero telemetry), so
      // surface recovery progress to PostHog. Sampled: first failure, then
      // every 5th, plus a marker event once the subscription recovers.
      onSubscriptionRecovery: (event) => {
        const source = subscriptionErrorSource(event.app, event.path);
        if (event.phase === 'retrying') {
          if (event.attempt === 1 || event.attempt % 5 === 0) {
            capturePluginError(source, event.error ?? 'resubscribe failed', {
              errorKind: 'resubscribe_failed',
              attempt: event.attempt,
              downMs: event.downMs,
            });
          }
          return;
        }
        runtime.log?.(
          `[tlon] Subscription ${event.app}${event.path} ${event.phase} after ${event.attempt} failed attempt(s), down ${event.downMs}ms`
        );
        if (event.attempt > 0) {
          capturePluginError(
            source,
            `subscription recovered (${event.phase}) after ${event.attempt} failed attempt(s)`,
            {
              errorKind: 'resubscribe_recovered',
              attempt: event.attempt,
              downMs: event.downMs,
            }
          );
        }
      },
      // Stream-level drops/stalls/reconnects. Distinct from per-subscription
      // recovery above: this is the whole SSE channel going down. Without it,
      // a stream that drops and cleanly reconnects (or a watchdog-detected
      // hung socket) is invisible in PostHog — only stdout.
      onStreamRecovery: (event) => {
        if (event.phase === 'reconnected') {
          if (event.attempt > 0 || (event.downtimeMs ?? 0) > 0) {
            capturePluginError(
              'sse_stream',
              `SSE stream reconnected after ${event.attempt} attempt(s)`,
              {
                errorKind: 'stream_reconnected',
                attempt: event.attempt,
                downMs: event.downtimeMs ?? null,
              }
            );
          }
          return;
        }
        if (event.phase === 'watchdog_stale') {
          capturePluginError(
            'sse_stream',
            `SSE stream stale (${event.idleMs}ms idle); forcing reconnect`,
            { errorKind: 'stream_stale', downMs: event.idleMs ?? null }
          );
          return;
        }
        // reconnect_failed — sample like the subscription retries.
        if (event.attempt === 1 || event.attempt % 5 === 0) {
          capturePluginError(
            'sse_stream',
            event.error ?? 'stream reconnect failed',
            { errorKind: 'stream_reconnect_failed', attempt: event.attempt }
          );
        }
      },
    });
  } catch (error) {
    await telemetry?.close();
    throw error;
  }

  // Configure @tloncorp/api's global client to use the SSE client's poke for all send operations
  configureTlonApiWithPoke(api.poke.bind(api), botShipName, account.url);

  // Publish the SSE-bound poke + ship coords so other module contexts (e.g.
  // the gateway-status heartbeat) can configure their own @tloncorp/api
  // singletons before pokeing. We store data here, not a closure, because
  // closures capture their creating context's module imports.
  // Capture the published object so the abort handler can do a
  // reference-equality check before clearing — under a config-reload
  // restart, a replacement monitor may publish fresh params before the
  // old monitor's abort fires, and we must not clobber the new params.
  const myApiClientParams = {
    poke: api.poke.bind(api),
    shipName: botShipName,
    shipUrl: accountUrl,
  };
  apiClientParamsSlot.set(myApiClientParams);

  // gsCoordinator is hoisted here (from its prior location at the
  // gateway-status activation block below) so cleanupGatewayStatus can
  // close over it. getGatewayStatusCoordinator() returns the
  // process-lifetime coordinator index.ts's registerFull publishes on
  // every load pass (tool discovery, full activation, and the 6.11+
  // prewarm) — it is created unconditionally, independent of Tlon account
  // count; see gateway-status.ts. Per-monitor eligibility (exactly one
  // account) is checked below, from THIS monitor's config snapshot.
  const gsCoordinator = getGatewayStatusCoordinator();

  // Monitor-local heartbeat handle (Fix C): each activation owns its own
  // interval, so a stale monitor's cleanup can never kill a replacement
  // monitor's heartbeat by construction. Populated once activation
  // actually starts the heartbeat; cleared/cleared-out on teardown.
  let stopGatewayHeartbeat: (() => void) | null = null;

  // Monitor-local abort for the gateway-status ACTIVATION ORCHESTRATION
  // only (the waitForStartedLifecycle() wait, the start watchdog, and the
  // retry backoff) — NOT the in-flight pokes (that abort is the deferred
  // Fix D). Aborting this from cleanupGatewayStatus() lets teardown cancel
  // a pending wait even when the host abortSignal never fires (e.g.
  // bootstrap throws because api.connect() failed), so the coordinator does
  // not retain the waiter + monitor closure and the watchdog can't emit
  // telemetry after teardown.
  const gatewayStatusActivationAbort = new AbortController();

  // Idempotent gateway-status teardown. Called from every path that
  // can leave this monitor: (a) synchronous abort already raised at
  // entry, (b) abort fired during the long bootstrap window before the
  // main try/finally is reached, (c) the late abort listener inside
  // the main try, (d) the existing inner finally, (e) the outer
  // try/finally below that wraps everything from publish onward.
  // Idempotency makes every combination of these firing produce one
  // effect.
  let gatewayStatusCleanupRan = false;
  const cleanupGatewayStatus = (): void => {
    if (gatewayStatusCleanupRan) {
      return;
    }
    gatewayStatusCleanupRan = true;
    stopGatewayHeartbeat?.();
    stopGatewayHeartbeat = null;
    // Cancel any pending activation wait/watchdog/backoff (orchestration
    // only — never the in-flight poke requests).
    gatewayStatusActivationAbort.abort();
    // Deliberately do NOT call gsCoordinator.markStopped() here. The
    // coordinator is process-lifetime (created once, reused across BOTH
    // registerFull passes and in-process monitor restarts). markStopped()
    // latches a specific GENERATION stopped and is the gateway_stop hook's
    // job; if monitor teardown called it, a config-reload's replacement
    // monitor would find its generation already stopped and bail, leaving
    // gateway-status dead until the next real %gateway-start. Zombie-
    // heartbeat prevention is monitor-local via gatewayStatusCleanupRan
    // (checked by the activation task, and by every heartbeat tick's own
    // validity predicate).
    if (apiClientParamsSlot.get() === myApiClientParams) {
      apiClientParamsSlot.set(null);
    }
  };

  // If the signal was already aborted before we reached this line,
  // addEventListener("abort", ..., { once: true }) won't fire (abort
  // events only deliver on transitions). Run cleanup synchronously and
  // throw out so the caller knows monitor startup didn't complete.
  if (opts.abortSignal?.aborted) {
    cleanupGatewayStatus();
    throw new Error('Tlon monitor startup aborted before bootstrap');
  }
  // Register the abort listener IMMEDIATELY, before any of the long
  // bootstrap work below. The late listener inside the main try block
  // covers the heartbeat-running phase; this one covers the long
  // bootstrap window between slot publication and the inner try.
  // Idempotent with the late listener via cleanupGatewayStatus's flag.
  opts.abortSignal?.addEventListener('abort', cleanupGatewayStatus, {
    once: true,
  });

  // Outer try/finally wraps everything from slot publication onward.
  // A synchronous throw between slot publication and the inner try
  // (constructor, queue setup, bridge setup, channel discovery, future
  // edits in this large pre-try region) would leave the shared slot
  // orphaned. This outer finally catches all of those and runs cleanup
  // unconditionally.
  try {
    const computingPresence = createComputingPresenceTracker({ runtime });
    const contextLensConfig = account.contextLens;
    const contextLensEnabled = isContextLensEffectivelyEnabled(
      cfg,
      opts.accountId ?? undefined
    );
    const contextLenses = createContextLensRegistry({
      ttlMs: contextLensConfig.ttlMs ?? undefined,
      maxEntries: contextLensConfig.maxEntries ?? undefined,
      visibilityDefault: contextLensConfig.visibilityDefault,
      disabled: !contextLensEnabled,
    });
    setContextLensEventCapacity(contextLensConfig.maxEntries);
    const logContextLens = (
      lensId: string,
      phase: string,
      detail?: Parameters<typeof publishContextLensEvent>[2]
    ) => {
      const snapshot = contextLenses.get(lensId);
      if (snapshot) {
        runtime.log?.(
          `[tlon] ContextLens ${JSON.stringify({ phase, detail, ...snapshot })}`
        );
        publishContextLensEvent(phase, snapshot, detail);
      }
    };

    const processedTracker = createProcessedMessageTracker(2000);
    let groupChannels: string[] = [];
    const channelToGroup = new Map<string, string>();
    /** Channels already offered the agent-onboarding purpose picker. */
    const onboardingPickerOffered = new Set<string>();
    const onboardingTopicsOffered = new Set<string>();
    /**
     * Channels whose topic pills are awaiting the owner reply, by purpose.
     * The reply message carries the rendered setup directive to the model,
     * so the cron payload comes from config instead of model prose.
     */
    const onboardingSetupPending = new Map<string, string>();
    /**
     * Channels whose setup has been asked for but not yet closed with the
     * invite card. The card goes last, so this outlives the turn that issued
     * the directive.
     */
    const onboardingInvitePending = new Set<string>();
    /** Channels checked (or paid): don't re-fetch history for them. */
    const inviteSettled = new Set<string>();
    /**
     * The agent session whose tool calls narrate each in-flight setup, so
     * settling the closing can disarm the status lines.
     */
    const setupProgressSessionForNest = new Map<string, string>();
    /**
     * Channels whose setup directive turn is running right now. The config
     * write lands partway through the build (the confirmation run comes
     * after it), so the sweep must not settle a closing mid-turn — the
     * invite card would butt in while the agent is still writing the first
     * entry. Cleared when the turn returns, however it returns; a restart
     * clears it implicitly, and a dead turn's closing is then settled by
     * the next sweep tick.
     */
    const onboardingSetupTurnInFlight = new Set<string>();
    let botNickname: string | null = null;
    let botAvatar: string | null = null;

    /**
     * Post markdown to a channel as the bot. Every outbound channel post
     * shares this envelope; only the text and the extras differ.
     */
    const postToChannel = (
      nest: string,
      text: string,
      extra?: { blob?: string; replyToId?: string }
    ) =>
      sendChannelPost({
        botProfile: getBotProfile(),
        fromShip: botShipName,
        nest,
        story: markdownToStory(text),
        ...extra,
      });

    // Helper to get bot profile for outbound messages
    const getBotProfile = (): BotProfile | undefined =>
      botNickname || botAvatar
        ? { nickname: botNickname || '', avatar: botAvatar || '' }
        : undefined;

    /**
     * Open a group with the agent's introduction and then the purpose
     * picker, as two posts: the introduction is about the agent, the picker
     * is a question, and one post carrying both reads as a wall of text.
     * Sequential so they land in that order.
     *
     * Idempotent on the intro: a previous opening can half-land (intro
     * posted, picker send failed), and the retry path re-enters here on the
     * owner's next message. Without the check the owner would get a second
     * introduction stacked on the first; with it, the retry sends only the
     * missing picker. Openings happen once per group, so the extra history
     * read costs nothing in steady state.
     */
    const postOnboardingOpening = async (nest: string): Promise<void> => {
      const recentPosts = await fetchChannelHistory(api, nest, 10, runtime);
      const introAlreadyPosted = recentPosts.some(
        (entry) =>
          entry.author === botShipName &&
          entry.content.startsWith(GROUP_INTRO_MESSAGE)
      );
      if (!introAlreadyPosted) {
        await postToChannel(nest, GROUP_INTRO_MESSAGE);
      }
      await postToChannel(nest, purposePickerFallbackText(), {
        blob: serializeBlobField(buildPurposePickerBlob(nest)),
      });
    };

    /**
     * Close a finished setup: the invite card, the connected-services card
     * (initial onboarding only), and the hand-back follow-up — last, after
     * the group has been named, configured and shown to do its job.
     *
     * Gated on the written config rather than on the turn returning: a setup
     * spans however many turns the conversation needs, and a turn that timed
     * out or stalled returns normally. The job in the group's config is the
     * build's final artifact, so its presence is what "finished" means.
     *
     * Idempotent against the transcript: each closing post is sent only if
     * history doesn't already show it, and the channel settles only once
     * every piece has landed. A transient send failure (or a restart at any
     * point) leaves the channel unsettled, and the next turn re-reads the
     * transcript and posts only what's missing — no piece is ever lost, and
     * none is ever doubled. An unreadable transcript settles nothing, since
     * to this decision it would look identical to an empty one.
     */
    /**
     * A setup that stored an unparseable config is worse than one that
     * stored none: the description *looks* written, the model believes it
     * finished, and every "is the setup done?" check silently answers no —
     * the owner sits in locked chrome with no cards and no error, forever
     * (observed live twice, both times a shell-mangled JSON argument).
     * Turn that dead end into a repair: tell the model's session exactly
     * what is broken and how to rewrite it. Once per distinct broken write
     * (a genuine repair produces different bytes), capped per channel so a
     * model that keeps mangling can't loop, and only while a setup owes
     * its closing — a random group with a weird description is not ours to
     * touch. The repair turn posts nothing, so no channel event follows to
     * re-run the closing check — the bounded poll below stands in for it.
     */
    const configRepairNudgedFor = new Map<string, string>();
    const configRepairNudgeCounts = new Map<string, number>();
    const maybeNudgeConfigRepair = (
      nest: string,
      groupFlag: string,
      description: string
    ): void => {
      if (!onboardingInvitePending.has(nest)) {
        return;
      }
      const parseError = brokenConfigDescriptionError(description);
      if (!parseError) {
        return;
      }
      if (configRepairNudgedFor.get(nest) === description) {
        return;
      }
      const nudges = configRepairNudgeCounts.get(nest) ?? 0;
      if (nudges >= 3) {
        return;
      }
      // Recorded only after the enqueue is accepted: a missing route or a
      // throwing enqueue would otherwise burn the single nudge these bytes
      // get, leaving the setup locked with no retry.
      try {
        const route = core.channel.routing.resolveAgentRoute({
          cfg,
          channel: 'tlon',
          accountId: opts.accountId ?? undefined,
          peer: { kind: 'group', id: nest },
        });
        if (!route?.sessionKey) {
          return;
        }
        core.system.enqueueSystemEvent(
          [
            '[Tlon setup repair directive — not written by the owner]',
            `The description stored on ${groupFlag} is not valid JSON`,
            `(${parseError}). The app therefore reads the group as having no`,
            'agent config at all: the setup chrome stays locked and the',
            'setup cannot finish, even though every other step landed.',
            'Rebuild the complete config array exactly as the setup',
            'directive specified, JSON.stringify it into',
            '/tmp/tlon-group-config.json (a flat .json file in /tmp is the',
            'only path the tool will read), parse the file back to prove',
            'it is valid, then re-write it with',
            `\`tlon groups update ${groupFlag} --description`,
            '"$(cat /tmp/tlon-group-config.json)"` — never inline',
            'hand-escaped JSON in a shell argument; that is what mangled',
            'it. Repair this silently: post no message about it, and do',
            'not repeat any earlier announcement.',
          ].join(' '),
          {
            sessionKey: route.sessionKey,
            contextKey: `tlon:config-repair:${nest}:${nudges + 1}`,
            // Route any resulting turn back to Tlon.
            deliveryContext: tlonDeliveryContext(
              `tlon:${nest}`,
              route.accountId
            ),
          }
        );
        configRepairNudgedFor.set(nest, description);
        configRepairNudgeCounts.set(nest, nudges + 1);
        runtime.log?.(
          `[tlon] Nudged a config repair in ${nest}: ${parseError}`
        );
        void (async () => {
          for (let i = 0; i < 9 && !opts.abortSignal?.aborted; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20_000));
            await postInviteCardIfSetupComplete(nest);
            if (inviteSettled.has(nest)) {
              return;
            }
          }
        })();
      } catch (error) {
        runtime.log?.(
          `[tlon] Could not nudge a config repair in ${nest}: ${String(error)}`
        );
      }
    };

    /**
     * Whether the closing should wait for the setup's output notebook to
     * hold its first entry. The cards say the setup is done; a notebook the
     * owner opens to find empty says otherwise (observed live — and the
     * directive's own "verify the entry landed" instruction is a promise,
     * not a check). Read from the bot's ship, which hosts the notebook, so
     * a real entry answers immediately. Bounded: an entry that never
     * materializes stops holding the cards hostage after ~5 minutes, and a
     * setup with no notebook (chat-fallback, freeform) never waits at all.
     */
    const emptyNotebookWaits = new Map<string, number>();
    const MAX_EMPTY_NOTEBOOK_WAITS = 15;
    const closingAwaitsNotebookEntry = async (
      nest: string,
      group: { flag: string; description: string }
    ): Promise<boolean> => {
      const waits = emptyNotebookWaits.get(nest) ?? 0;
      if (waits >= MAX_EMPTY_NOTEBOOK_WAITS) {
        return false;
      }
      let notesNest: string | null = null;
      try {
        notesNest = await setupOutputNotebookNest(
          api,
          group.flag,
          group.description,
          runtime
        );
      } catch {
        // Unreadable groups state: wait a tick rather than guess.
        emptyNotebookWaits.set(nest, waits + 1);
        return true;
      }
      if (!notesNest) {
        return false;
      }
      try {
        // Counted from the raw outline rather than extracted messages: an
        // entry whose text extraction comes up empty is still an entry.
        const data: any = await api.scry(
          `/channels/v4/${notesNest}/posts/newest/1/outline.json`
        );
        const posts = Array.isArray(data) ? data : data?.posts ?? data ?? {};
        const count = Array.isArray(posts)
          ? posts.length
          : Object.keys(posts).length;
        if (count > 0) {
          emptyNotebookWaits.delete(nest);
          return false;
        }
      } catch {
        // Fall through to waiting: unreadable and empty must not look alike
        // to the cards.
      }
      emptyNotebookWaits.set(nest, waits + 1);
      runtime.log?.(
        `[tlon] Holding the closing in ${nest}: the output notebook has no entry yet (${waits + 1}/${MAX_EMPTY_NOTEBOOK_WAITS})`
      );
      return true;
    };

    const postInviteCardIfSetupComplete = async (
      nest: string
    ): Promise<void> => {
      // `onboardingInvitePending` is the cheap in-memory record of the debt;
      // the transcript scan below recovers it after a restart (the prompt
      // tells the model Tlon posts the link, so nobody else ever will).
      // `inviteSettled` keeps the work to once per channel per process.
      if (!onboardingInvitePending.has(nest) && inviteSettled.has(nest)) {
        return;
      }
      try {
        const group = await findGroupForChannel(api, nest, runtime);
        if (!group) {
          return;
        }
        if (!descriptionHasConfiguredJob(group.description)) {
          maybeNudgeConfigRepair(nest, group.flag, group.description);
          return;
        }
        if (await closingAwaitsNotebookEntry(nest, group)) {
          return;
        }
        // 100 posts bounds the recovery window: a setup conversation runs a
        // couple dozen posts, so the opening picker is comfortably inside
        // it, while an unbounded backscan would re-read every legacy
        // configured channel's full history once per process. A restart
        // after a setup that somehow ran past this window reads as
        // pre-existing and settles without the closing — accepted, since it
        // stacks two rarities (restart mid-setup, and a transcript four
        // times longer than any observed).
        const history = await fetchChannelHistory(api, nest, 100, runtime, {
          throwOnError: true,
        });
        const botPosted = (needle: string) =>
          history.some(
            (entry) =>
              entry.author === botShipName && entry.content.startsWith(needle)
          );
        if (!onboardingInvitePending.has(nest)) {
          // The opening picker marks every onboarding, including the
          // freeform path that never sees the topic pills — a freeform
          // setup owes its closing too. Pre-existing configured groups
          // never had a picker posted, so they can't match.
          if (
            !botPosted(PURPOSE_PICKER_PROMPT) &&
            !botPosted(TOPICS_PICKER_PROMPT)
          ) {
            inviteSettled.add(nest);
            return;
          }
        }
        // Matched on the shared leads: each card's *story* is its standalone
        // fallback text, which starts with the same sentence as the blob's
        // prompt. The invite fallback is posted even when the resolved
        // @tloncorp/api predates the invite-link control and no blob can be
        // built — the text stands alone, telling the owner to invite from
        // the group's info screen.
        if (!botPosted(INVITE_CARD_LEAD)) {
          const blob = buildInviteCardBlob(nest, group.flag);
          await postToChannel(
            nest,
            inviteCardFallbackText(),
            blob ? { blob: serializeBlobField(blob) } : {}
          );
        }
        // Initial onboarding only: the account's first setup gets the
        // connected-services tour. A user creating their third agent group
        // already knows — and may already have services connected. The home
        // group is that first setup on hosted accounts (free to check, so it
        // goes first); everywhere else the question is whether any other
        // group is already configured. Posted as plain text when the card
        // can't be built; the fallback names the settings path in words.
        if (!botPosted(SERVICES_CARD_LEAD)) {
          const isHomeGroup = isHomeGroupFlag(group.flag, effectiveOwnerShip);
          const isFirstSetup = isHomeGroup
            ? true
            : await isFirstConfiguredSetup(api, runtime, group.flag);
          if (isFirstSetup === null) {
            // Inconclusive scry: guessing "not the first" would settle the
            // channel below and permanently skip the tour for a genuine
            // first setup. Leave the closing unfinished — everything already
            // posted is skipped by the transcript checks on the retry.
            runtime.log?.(
              `[tlon] Could not classify the setup in ${nest} — retrying its closing next turn`
            );
            return;
          }
          if (isFirstSetup) {
            const servicesBlob = buildServicesCardBlob(nest);
            await postToChannel(
              nest,
              servicesCardFallbackText(),
              servicesBlob ? { blob: serializeBlobField(servicesBlob) } : {}
            );
          }
        }
        // Hands the conversation back, after the cards so it can't land
        // before them. Posted even when the invite card couldn't be built:
        // on a client that can't render the invite slot, this is the whole
        // ending.
        if (!botPosted(INVITE_FOLLOWUP_MESSAGE)) {
          await postToChannel(nest, INVITE_FOLLOWUP_MESSAGE);
        }
        onboardingInvitePending.delete(nest);
        inviteSettled.add(nest);
        const progressSession = setupProgressSessionForNest.get(nest);
        if (progressSession) {
          disarmSetupProgress(progressSession);
          setupProgressSessionForNest.delete(nest);
        }
      } catch (error) {
        runtime.error?.(
          `[tlon] Failed to close the setup in ${nest}: ${String(error)}`
        );
      }
    };

    /**
     * Channels whose transcript has been scanned to rebuild the in-memory
     * onboarding state. Once per process: the scan only exists to survive
     * restarts — live state is kept by the handlers as it changes.
     */
    const onboardingRecoveryChecked = new Set<string>();

    /**
     * Restart recovery: the offered/pending records above are in-memory, so
     * a process restart between posting a picker and the owner's reply loses
     * them — and, left alone, the offer block would re-post the opening on
     * top of the answered picker, while the owner-listen gate would drop the
     * very reply the pills are waiting for. The transcript survives
     * restarts; rebuild the state from it.
     *
     * `currentMessageText` is the owner message being handled right now,
     * passed so the scan can exclude it — the reply in hand must not count
     * as its own evidence. `knownGroup` skips the group lookup when the
     * caller already has one.
     *
     * Returns `'inconclusive'` when a transient scry failure prevented the
     * scan from deciding anything. Callers must not act as if nothing was
     * offered — offering again over an unread transcript would stack a
     * second picker on the answered one and swallow the reply in hand.
     * Retried on the next message; the checked-set isn't burned.
     */
    const recoverOnboardingState = async (
      nest: string,
      senderShip: string,
      currentMessageText: string,
      knownGroup?: { host: string; description: string | null } | null
    ): Promise<'ok' | 'inconclusive'> => {
      if (
        onboardingRecoveryChecked.has(nest) ||
        onboardingSetupPending.has(nest)
      ) {
        return 'ok';
      }
      const group =
        knownGroup ?? (await findGroupForChannel(api, nest, runtime));
      if (!group) {
        // Null is also what a transient groups-scry failure looks like.
        return 'inconclusive';
      }
      if (group.host !== effectiveOwnerShip) {
        onboardingRecoveryChecked.add(nest);
        return 'ok';
      }
      if (descriptionHasConfiguredJob(group.description)) {
        // A restart after the job was written but before the closing
        // posted would otherwise strand the owed invite/services cards
        // behind the owner-listen drop below — the closing normally runs
        // at the end of an engaged turn, and a muted channel never has
        // one. The check is idempotent and settles itself.
        void postInviteCardIfSetupComplete(nest);
        onboardingRecoveryChecked.add(nest);
        return 'ok';
      }
      // Deliberately NOT the has-any-setup predicate: a purpose-only config
      // is a setup that wrote its intent and then stopped — likely mid-build
      // with a follow-up question pending — and its transcript still needs
      // the scan below so the owner's answer is heard.
      let recentPosts;
      try {
        // An unreadable transcript is not an empty one: deciding "nothing
        // was offered" from a failed scry would burn the once-per-process
        // scan on bad data.
        recentPosts = await fetchChannelHistory(api, nest, 20, runtime, {
          throwOnError: true,
        });
      } catch (error) {
        runtime.log?.(
          `[tlon] Onboarding recovery scan for ${nest} failed: ${String(error)}`
        );
        return 'inconclusive';
      }
      onboardingRecoveryChecked.add(nest);
      // A picker that survives in the transcript was already offered:
      // without remembering that, a restart followed by a freeform reply
      // (not a card title) would re-post the opening over the answered
      // picker and swallow the actual request.
      if (
        recentPosts.some(
          (entry) =>
            entry.author === botShipName &&
            entry.content.startsWith(PURPOSE_PICKER_PROMPT)
        )
      ) {
        onboardingPickerOffered.add(nest);
      }
      const recoveredPurpose = derivePendingPurposeFromHistory(
        recentPosts,
        botShipName,
        normalizeShip(senderShip),
        currentMessageText
      );
      if (recoveredPurpose) {
        runtime.log?.(
          `[tlon] Recovered pending onboarding purpose '${recoveredPurpose}' for ${nest} from history`
        );
        onboardingSetupPending.set(nest, recoveredPurpose);
        onboardingPickerOffered.add(nest);
        onboardingTopicsOffered.add(nest);
        return 'ok';
      }
      if (
        topicsPickerAnswered(
          recentPosts,
          botShipName,
          normalizeShip(senderShip),
          currentMessageText
        )
      ) {
        // Answered pills with no job yet: a setup directive turn already ran
        // and the build is in flight — the very state `invitePending` marks
        // live. Restoring it keeps the owner-listen gate hearing the
        // follow-up answers the build asks for (a timezone, a first entry)
        // and re-arms the owed closing, both of which a restart would
        // otherwise orphan. The closing still fires only once the config
        // carries the job, so a stale restore costs nothing.
        runtime.log?.(
          `[tlon] Recovered an in-flight setup for ${nest} from history`
        );
        onboardingInvitePending.add(nest);
        onboardingPickerOffered.add(nest);
        onboardingTopicsOffered.add(nest);
      }
      return 'ok';
    };

    /**
     * A newly created group the owner hosts: the agent opens the
     * conversation itself, so the client never has to post an opening line
     * on the user's behalf. The channel lands moments after the join ack,
     * so poll for it (bounded); every other case — established group,
     * unreadable state — stays silent and lets the message-driven offer
     * handle it.
     *
     * Called from three triggers, all funneled through the same guards:
     * accepting an owner's group invite, the periodic sweep over groups
     * awaiting an opening, and groups-ui discovery of the hosted home group
     * — whose moon is force-joined by provisioning and so never produces
     * the invite event the first trigger needs.
     *
     * The verdict tells the sweep whether to come back: 'retry' means the
     * refusal was transient (channel not visible yet, probe unanswered,
     * post failed), everything else is a fact about the group that
     * re-checking won't change. Concurrent calls for the same flag share
     * one run — the triggers overlap by design, and racing them past the
     * guards would double-post the opening.
     */
    const onboardingOffersInFlight = new Map<
      string,
      Promise<'opened' | 'settled' | 'retry'>
    >();
    const offerOnboardingInNewOwnerGroup = (
      groupFlag: string
    ): Promise<'opened' | 'settled' | 'retry'> => {
      const inFlight = onboardingOffersInFlight.get(groupFlag);
      if (inFlight) {
        return inFlight;
      }
      const run = runOnboardingOffer(groupFlag).finally(() => {
        onboardingOffersInFlight.delete(groupFlag);
      });
      onboardingOffersInFlight.set(groupFlag, run);
      return run;
    };
    const runOnboardingOffer = async (
      groupFlag: string
    ): Promise<'opened' | 'settled' | 'retry'> => {
      try {
        const deadline = Date.now() + 45_000;
        let info: Awaited<ReturnType<typeof findChatNestForGroup>> = null;
        while (Date.now() < deadline && !opts.abortSignal?.aborted) {
          info = await findChatNestForGroup(api, groupFlag, runtime);
          if (info) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (!info) {
          runtime.log?.(
            `[tlon] Joined ${groupFlag} but never saw its chat channel — skipping onboarding offer`
          );
          return 'retry';
        }
        // The newness probe races %channels: right after the join ack the
        // posts scry can still fail, and a null answer is fail-closed —
        // which would silently skip the offer for a group that *is* new.
        // Poll until the probe answers, on the same deadline.
        let isNew: boolean | null = null;
        while (Date.now() < deadline && !opts.abortSignal?.aborted) {
          isNew = await channelHasNoPosts(api, info.nest, runtime);
          if (isNew !== null) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        // The home group gets a softer probe: provisioning historically
        // posted a legacy welcome into it *as the bot*, and a message can't
        // be unsent — the strict empty-channel line would permanently block
        // the opening for every already-provisioned account. Bot-authored
        // posts alone don't make it a conversation; anyone else speaking
        // (or an opening already present) still keeps this out. Unreadable
        // history reads as blocked — another trigger retries.
        let channelOpenable = isNew;
        let probeUnreadable = false;
        if (
          channelOpenable === false &&
          effectiveOwnerShip &&
          isHomeGroupFlag(groupFlag, effectiveOwnerShip)
        ) {
          try {
            const history = await fetchChannelHistory(
              api,
              info.nest,
              20,
              runtime,
              { throwOnError: true }
            );
            channelOpenable = homeGroupAwaitingOpening(history, botShipName);
          } catch (error) {
            runtime.log?.(
              `[tlon] Could not read the home group transcript for ${groupFlag}: ${String(error)}`
            );
            channelOpenable = false;
            probeUnreadable = true;
          }
        }
        const shouldOffer = shouldOfferPickerOnJoin({
          groupHostIsOwner: info.host === effectiveOwnerShip,
          groupDescription: info.description,
          channelHasNoPosts: channelOpenable,
          groupHasSingleChannel: info.channelCount <= 1,
          alreadyOffered: onboardingPickerOffered.has(info.nest),
        });
        if (!shouldOffer) {
          runtime.log?.(
            `[tlon] No onboarding offer for ${groupFlag}: hostIsOwner=${info.host === effectiveOwnerShip}, channelHasNoPosts=${isNew}, alreadyOffered=${onboardingPickerOffered.has(info.nest)}`
          );
          return channelOpenable === null || probeUnreadable
            ? 'retry'
            : 'settled';
        }
        onboardingPickerOffered.add(info.nest);
        runtime.log?.(
          `[tlon] Opening new group ${groupFlag} with the purpose picker`
        );
        try {
          await postOnboardingOpening(info.nest);
        } catch (error) {
          onboardingPickerOffered.delete(info.nest);
          runtime.error?.(
            `[tlon] Failed to open ${groupFlag} with purpose picker: ${String(error)}`
          );
          return 'retry';
        }
        return 'opened';
      } catch (error) {
        runtime.error?.(
          `[tlon] Onboarding offer for ${groupFlag} failed: ${String(error)}`
        );
        return 'retry';
      }
    };

    // Settings store manager for hot-reloading config
    const settingsManager = createSettingsManager(api, {
      log: (msg) => runtime.log?.(msg),
      error: (msg) => runtime.error?.(msg),
    });

    // Reactive state that can be updated via settings store
    let effectiveDmAllowlist: string[] = account.dmAllowlist;
    let effectiveShowModelSig: boolean = account.showModelSignature ?? false;
    let effectiveAutoAcceptDmInvites: boolean =
      account.autoAcceptDmInvites ?? false;
    let effectiveAutoAcceptGroupInvites: boolean =
      account.autoAcceptGroupInvites ?? false;
    let effectiveGroupInviteAllowlist: string[] = account.groupInviteAllowlist;
    let effectiveAutoDiscoverChannels: boolean =
      account.autoDiscoverChannels ?? false;
    let effectiveOwnerListenEnabled: boolean =
      account.ownerListenEnabled ?? true;
    // Canonicalize on every read so an entry stored from a slightly-off user
    // input (e.g. missing "~" or wrong case) still matches incoming nest events.
    const canonicalizeNestList = (list: readonly string[]): string[] => {
      const out = new Set<string>();
      for (const raw of list) {
        const canonical = canonicalizeNest(raw);
        if (canonical) {
          out.add(canonical);
        }
      }
      return [...out];
    };
    let effectiveOwnerListenDisabled: Set<string> = new Set(
      canonicalizeNestList(account.ownerListenDisabledChannels ?? [])
    );
    let pendingApprovals: PendingApproval[] = [];
    let currentSettings: TlonSettingsStore = {};
    // Tracks whether pendingNudge has been successfully rehydrated from the settings
    // store (or locally set/cleared). While false, refresh is allowed to recover a
    // persisted pendingNudge that was missed due to a transient startup scry failure.
    // Once true, the in-memory state is authoritative and refresh cannot clobber it.
    let pendingNudgeRehydrated = false;

    /** Set pending nudge and take ownership so refresh cannot clobber. */
    const setLocalPendingNudge = (accountId: string, nudge: PendingNudge) => {
      setPendingNudge(accountId, nudge);
      pendingNudgeRehydrated = true;
    };

    /** Clear pending nudge and take ownership so refresh cannot resurrect stale store data. */
    const clearLocalPendingNudge = (accountId: string) => {
      clearPendingNudge(accountId);
      pendingNudgeRehydrated = true;
    };

    // Bridge route-resolution telemetry from the global `message_sending` hook
    // to this account's telemetry client. Reports every route-dependent send so
    // we can measure how often a reply lands on webchat instead of Tlon.
    setOutboundRouteReporter((event) =>
      telemetry?.captureOutboundRoute({
        ...event,
        ownerShip:
          getEffectiveOwnerShip(account.accountId) ?? effectiveOwnerShip,
        botShip: botShipName,
      })
    );
    setSessionTelemetryReporter((report) => {
      switch (report.kind) {
        case 'lifecycle':
          telemetry?.captureSessionLifecycle(report.event);
          break;
        case 'watchdog':
          telemetry?.captureSessionWatchdog(report.event);
          break;
        case 'recovery':
          telemetry?.captureSessionRecovery(report.event);
          break;
      }
    });
    setDebugTelemetryReporter((event) => {
      telemetry?.captureHarnessDebug({
        ...event,
        accountId: event.accountId ?? account.accountId,
        ownerShip: event.ownerShip ?? currentTelemetryOwnerShip(),
        botShip: event.botShip || botShipName,
      });
    });
    // Bridge cron lifecycle/run telemetry from the global `cron_changed` hook
    // to this account's telemetry client. Cron jobs are gateway-global, so
    // events are attributed to this account's owner (same last-writer-wins
    // semantics as the other global-hook reporters above).
    setCronTelemetryReporter((report) => {
      const identity = {
        accountId: account.accountId,
        ownerShip: currentTelemetryOwnerShip(),
        botShip: botShipName,
      };
      switch (report.kind) {
        case 'jobChanged':
          telemetry?.captureCronJobChanged({ ...report.event, ...identity });
          break;
        case 'run':
          telemetry?.captureCronRun({ ...report.event, ...identity });
          break;
        case 'snapshot':
          telemetry?.captureCronSnapshot({ ...report.event, ...identity });
          break;
      }
    });
    setErrorTelemetryReporter((report) => {
      switch (report.kind) {
        case 'harness':
          telemetry?.captureHarnessError({
            ...report.event,
            accountId: report.event.accountId ?? account.accountId,
            ownerShip: report.event.ownerShip ?? currentTelemetryOwnerShip(),
            botShip: report.event.botShip || botShipName,
          });
          break;
        case 'plugin':
          telemetry?.capturePluginError({
            harness: 'openclaw',
            pluginErrorSource: report.event.pluginErrorSource,
            accountId: report.event.accountId ?? account.accountId,
            ownerShip: report.event.ownerShip ?? currentTelemetryOwnerShip(),
            botShip: report.event.botShip ?? botShipName,
            errorKind: report.event.errorKind ?? null,
            errorText: report.event.errorText,
            attempt: report.event.attempt ?? null,
            downMs: report.event.downMs ?? null,
            authPhase: report.event.authPhase ?? null,
          });
          break;
        case 'telemetry':
          telemetry?.captureTelemetryError({
            harness: 'openclaw',
            telemetrySource: report.event.telemetrySource,
            sourceEventName: report.event.sourceEventName ?? null,
            sessionKey: report.event.sessionKey ?? null,
            sessionId: report.event.sessionId ?? null,
            runId: report.event.runId ?? null,
            accountId: report.event.accountId ?? account.accountId,
            agentId: report.event.agentId ?? null,
            ownerShip: report.event.ownerShip ?? currentTelemetryOwnerShip(),
            botShip: report.event.botShip ?? botShipName,
            errorKind: report.event.errorKind ?? null,
            errorText: report.event.errorText,
          });
          break;
      }
    });

    // Track threads we've participated in (by parentId) - respond without mention requirement
    const participatedThreads = new Set<string>();

    // Track consecutive bot responses per channel/DM for rate limiting
    // Key: channel nest or dm partner ship, Value: count of consecutive bot messages
    const consecutiveBotMessages = new Map<string, number>();
    // Known bot ships (ships that have sent messages with BotProfile author)
    const knownBotShips = new Set<string>();
    const maxBotResponses = account.maxConsecutiveBotResponses ?? 3;

    // Track DM senders per session to detect shared sessions (security warning)
    const dmSendersBySession = new Map<string, Set<string>>();
    let sharedSessionWarningSent = false;

    // Nickname cache for all known contacts (ship -> nickname)
    const nicknameCache = new Map<string, string>();

    // Sanitize nickname to prevent format injection
    function sanitizeNickname(nickname: string): string {
      return nickname
        .replace(/[[\]()]/g, '') // Remove format-breaking chars
        .slice(0, 50); // Reasonable length limit
    }

    // Format a ship with nickname if available
    function formatShipWithNickname(ship: string): string {
      const nickname = nicknameCache.get(ship);
      if (!nickname) {
        return ship;
      }
      const sanitized = sanitizeNickname(nickname);
      return sanitized ? `${ship} (${sanitized})` : ship;
    }

    // Fetch bot's nickname and all contacts
    try {
      const selfProfile = await api.scry('/contacts/v1/self.json');
      if (selfProfile && typeof selfProfile === 'object') {
        const profile = selfProfile as {
          nickname?: { value?: string };
          avatar?: { value?: string };
        };
        botNickname = profile.nickname?.value || null;
        botAvatar = profile.avatar?.value || null;
        if (botNickname) {
          runtime.log?.(`[tlon] Bot nickname: ${botNickname}`);
          nicknameCache.set(botShipName, sanitizeNickname(botNickname));
        }
      }
    } catch (error: any) {
      runtime.log?.(
        `[tlon] Could not fetch self profile: ${error?.message ?? String(error)}`
      );
    }

    // Fetch all contacts to populate nickname cache
    try {
      const allContacts = (await api.scry('/contacts/v1/all.json')) as Record<
        string,
        any
      > | null;
      if (allContacts && typeof allContacts === 'object') {
        for (const [ship, contact] of Object.entries(allContacts)) {
          const nickname = contact?.nickname?.value ?? contact?.nickname;
          if (nickname && typeof nickname === 'string') {
            nicknameCache.set(normalizeShip(ship), sanitizeNickname(nickname));
          }
        }
        runtime.log?.(
          `[tlon] Loaded ${nicknameCache.size} contact nickname(s)`
        );
      }
    } catch (error: any) {
      runtime.log?.(
        `[tlon] Could not fetch contacts: ${error?.message ?? String(error)}`
      );
    }

    // Store init foreigns for processing after settings are loaded
    let initForeigns: Foreigns | null = null;

    // Group name cache for human-readable display (flag -> title)
    const groupNameCache = new Map<string, string>();
    const channelNameCache = new Map<string, string>();

    function extractMetadataTitle(value: unknown): string | undefined {
      if (!value || typeof value !== 'object') {
        return undefined;
      }
      const metadata = value as { meta?: { title?: unknown }; title?: unknown };
      const title = metadata.meta?.title ?? metadata.title;
      return typeof title === 'string' && title.trim()
        ? title.trim()
        : undefined;
    }

    // Build display context for approval formatting
    function buildDisplayContext(): DisplayContext {
      const channelNames = new Map<string, string>();
      for (const nest of watchedChannels) {
        const title = channelNameCache.get(nest);
        if (title) {
          channelNames.set(nest, title);
          continue;
        }
        const parsed = parseChannelNest(nest);
        if (parsed) {
          channelNames.set(nest, parsed.channelName);
        }
      }
      return {
        contactNames: nicknameCache,
        channelNames,
        channelGroups: channelToGroup,
        groupNames: groupNameCache,
      };
    }

    function buildContextLensReferenceBlobField(
      lensId: string
    ): string | undefined {
      if (!contextLensEnabled) {
        return undefined;
      }
      try {
        return serializeContextLensReferenceBlob(lensId, botShipName);
      } catch (err) {
        runtime.error?.(
          `[tlon] Failed to build Context Lens reference blob: ${String(err)}`
        );
        return undefined;
      }
    }

    function buildApprovalBlobField(
      approval: PendingApproval,
      ctx: DisplayContext
    ): string | undefined {
      try {
        return serializeBlobField(
          buildApprovalA2UIBlob(approval, ctx, {
            // DM sources live in the bot's own DM history, which a separate
            // owner cannot open. Channel-mention sources live in the group
            // channel, so they stay linked for any owner (TLON-6198).
            recipientSeesBotDms: effectiveOwnerShip === botShipName,
          })
        );
      } catch (err) {
        runtime.error?.(
          `[tlon] Failed to build approval A2UI blob: ${String(err)}`
        );
        return undefined;
      }
    }
    // Migrate file config to settings store (seed on first run)
    async function migrateConfigToSettings() {
      const migrations: Array<{
        key: string;
        fileValue: unknown;
        settingsValue: unknown;
      }> = [
        {
          key: 'dmAllowlist',
          fileValue: account.dmAllowlist,
          settingsValue: currentSettings.dmAllowlist,
        },
        {
          key: 'groupInviteAllowlist',
          fileValue: account.groupInviteAllowlist,
          settingsValue: currentSettings.groupInviteAllowlist,
        },
        {
          key: 'groupChannels',
          fileValue: account.groupChannels,
          settingsValue: currentSettings.groupChannels,
        },
        {
          key: 'defaultAuthorizedShips',
          fileValue: account.defaultAuthorizedShips,
          settingsValue: currentSettings.defaultAuthorizedShips,
        },
        {
          key: 'autoDiscoverChannels',
          fileValue: account.autoDiscoverChannels,
          settingsValue: currentSettings.autoDiscoverChannels,
        },
        {
          key: 'autoAcceptDmInvites',
          fileValue: account.autoAcceptDmInvites,
          settingsValue: currentSettings.autoAcceptDmInvites,
        },
        {
          key: 'autoAcceptGroupInvites',
          fileValue: account.autoAcceptGroupInvites,
          settingsValue: currentSettings.autoAcceptGroupInvites,
        },
        {
          key: 'showModelSig',
          fileValue: account.showModelSignature,
          settingsValue: currentSettings.showModelSig,
        },
        {
          key: 'ownerShip',
          fileValue: account.ownerShip,
          settingsValue: currentSettings.ownerShip,
        },
      ];

      for (const { key, fileValue, settingsValue } of migrations) {
        // Only migrate if file has a value and settings store doesn't
        const hasFileValue = Array.isArray(fileValue)
          ? fileValue.length > 0
          : fileValue != null;
        const hasSettingsValue = Array.isArray(settingsValue)
          ? true // empty array = intentionally set in settings store
          : settingsValue != null;

        if (hasFileValue && !hasSettingsValue) {
          try {
            await api!.poke({
              app: 'settings',
              mark: 'settings-event',
              json: {
                'put-entry': {
                  'bucket-key': 'tlon',
                  'entry-key': key,
                  value: fileValue,
                  desk: 'moltbot',
                },
              },
            });
            runtime.log?.(
              `[tlon] Migrated ${key} from config to settings store`
            );
          } catch (err) {
            runtime.log?.(`[tlon] Failed to migrate ${key}: ${String(err)}`);
          }
        }
      }
    }

    // Clear stale in-memory pending-nudge state before settings load.
    // If load fails during a same-process restart, we should not keep attributing
    // owner replies against a previous monitor run's record.
    syncPendingNudgeFromStore(account.accountId, null);

    // Drop stale per-process shadows from any prior run in the same process.
    // Mirrors the same-process-restart reasoning as the pending-nudge sync above.
    clearShadowsForAccount(account.accountId);

    // Load settings from settings store (hot-reloadable config)
    try {
      const loadResult = await settingsManager.load();
      currentSettings = loadResult.settings;

      // Only seed file config into %settings when the startup snapshot is fresh.
      // On a transient startup scry failure, `load()` preserves the last known
      // snapshot (or `{}` on first load). Running migration against a stale
      // snapshot would treat every persisted override as absent and clobber it
      // with file-backed values once the settings agent recovers.
      if (loadResult.fresh) {
        await migrateConfigToSettings();
      } else {
        runtime.log?.(
          '[tlon] Skipping config->settings migration on stale startup snapshot'
        );
      }

      // Apply settings overrides
      // Note: groupChannels from settings store are merged AFTER discovery runs (below)
      if (currentSettings.defaultAuthorizedShips?.length) {
        runtime.log?.(
          `[tlon] Using defaultAuthorizedShips from settings store: ${currentSettings.defaultAuthorizedShips.join(', ')}`
        );
      }
      if (currentSettings.autoDiscoverChannels !== undefined) {
        effectiveAutoDiscoverChannels = currentSettings.autoDiscoverChannels;
        runtime.log?.(
          `[tlon] Using autoDiscoverChannels from settings store: ${effectiveAutoDiscoverChannels}`
        );
      }
      if (currentSettings.dmAllowlist !== undefined) {
        effectiveDmAllowlist = currentSettings.dmAllowlist;
        runtime.log?.(
          `[tlon] Using dmAllowlist from settings store: ${effectiveDmAllowlist.length > 0 ? effectiveDmAllowlist.join(', ') : '(empty)'}`
        );
      }
      if (currentSettings.showModelSig !== undefined) {
        effectiveShowModelSig = currentSettings.showModelSig;
      }
      if (currentSettings.autoAcceptDmInvites !== undefined) {
        effectiveAutoAcceptDmInvites = currentSettings.autoAcceptDmInvites;
        runtime.log?.(
          `[tlon] Using autoAcceptDmInvites from settings store: ${effectiveAutoAcceptDmInvites}`
        );
      }
      if (currentSettings.autoAcceptGroupInvites !== undefined) {
        effectiveAutoAcceptGroupInvites =
          currentSettings.autoAcceptGroupInvites;
        runtime.log?.(
          `[tlon] Using autoAcceptGroupInvites from settings store: ${effectiveAutoAcceptGroupInvites}`
        );
      }
      // An explicit empty settings list is authoritative (the admin cleared the
      // allowlist), not a signal to fall back to the file config — otherwise
      // clearing it in the form would keep auto-accepting invites from the old
      // file list. Only `undefined` (never set) defers to the file value.
      if (currentSettings.groupInviteAllowlist !== undefined) {
        effectiveGroupInviteAllowlist = currentSettings.groupInviteAllowlist;
        runtime.log?.(
          `[tlon] Using groupInviteAllowlist from settings store: ${effectiveGroupInviteAllowlist.join(', ')}`
        );
      }
      if (currentSettings.ownerShip) {
        effectiveOwnerShip = normalizeShip(currentSettings.ownerShip);
        setEffectiveOwnerShip(account.accountId, effectiveOwnerShip);
        runtime.log?.(
          `[tlon] Using ownerShip from settings store: ${effectiveOwnerShip}`
        );
      }
      if (currentSettings.ownerListenEnabled !== undefined) {
        effectiveOwnerListenEnabled = currentSettings.ownerListenEnabled;
        runtime.log?.(
          `[tlon] Using ownerListenEnabled from settings store: ${effectiveOwnerListenEnabled}`
        );
      }
      if (currentSettings.ownerListenDisabledChannels !== undefined) {
        effectiveOwnerListenDisabled = new Set(
          canonicalizeNestList(currentSettings.ownerListenDisabledChannels)
        );
        runtime.log?.(
          `[tlon] Loaded ${effectiveOwnerListenDisabled.size} owner-listen-disabled channel(s) from settings`
        );
      }

      // Rehydrate pending nudge from settings store only if the scry returned real data.
      // On fallback (scry failure), leave pendingNudgeRehydrated false so the refresh
      // recovery path can still pick up a persisted pendingNudge later.
      if (loadResult.fresh) {
        syncPendingNudgeFromStore(
          account.accountId,
          currentSettings.pendingNudge ?? null
        );
        pendingNudgeRehydrated = true;
      }

      // Seed nudge shadows from the loaded settings snapshot. Missing fields
      // seed the shadow as absent / 0 — the tick short-circuits on null
      // activity, which is correct for a cold startup with an empty store.
      setLastOwnerActivity(
        account.accountId,
        ownerActivityFromSettings(currentSettings)
      );
      setLastNudgeStageShadow(
        account.accountId,
        currentSettings.lastNudgeStage ?? 0
      );

      if (currentSettings.pendingApprovals !== undefined) {
        pendingApprovals = pruneExpired(currentSettings.pendingApprovals);
        runtime.log?.(
          `[tlon] Loaded ${pendingApprovals.length} pending approval(s) from settings`
        );
        await savePendingApprovals();
      }
    } catch (err) {
      runtime.log?.(
        `[tlon] Settings store not available, using file config: ${String(err)}`
      );
    }

    const pendingNudgePersistence = createPendingNudgePersistenceQueue(
      async (nudge) => {
        try {
          if (nudge) {
            await api.poke({
              app: 'settings',
              mark: 'settings-event',
              json: {
                'put-entry': {
                  desk: 'moltbot',
                  'bucket-key': 'tlon',
                  'entry-key': 'pendingNudge',
                  value: JSON.stringify(nudge),
                },
              },
            });
          } else {
            await api.poke({
              app: 'settings',
              mark: 'settings-event',
              json: {
                'del-entry': {
                  desk: 'moltbot',
                  'bucket-key': 'tlon',
                  'entry-key': 'pendingNudge',
                },
              },
            });
          }
        } catch (err: unknown) {
          runtime.error?.(
            nudge
              ? `[tlon] Failed to persist pendingNudge: ${describeError(err)}`
              : `[tlon] Failed to clear pendingNudge: ${describeError(err)}`
          );
        }
      }
    );

    // Register per-account persist callback for pending nudge writes.
    registerPersistCallback(account.accountId, (nudge) => {
      pendingNudgePersistence.enqueue(nudge);
    });

    const ownerReplyPersistence = createOwnerReplyPersistenceQueue(api, {
      error: (msg) => runtime.error?.(msg),
    });

    let nudgeRunner: ReturnType<typeof createNudgeRunner> | null = null;

    // Clear expired pending nudge on startup (after persist callback is registered so del-entry fires).
    const rehydratedNudge = getPendingNudge(account.accountId);
    if (rehydratedNudge && !isNudgeEligible(rehydratedNudge)) {
      const ageMs = Date.now() - rehydratedNudge.sentAt;
      clearLocalPendingNudge(account.accountId);
      runtime.log?.(
        `[tlon] Cleared expired pending nudge on startup (stage ${rehydratedNudge.stage}, age ${ageMs}ms)`
      );
    }

    // ── Gateway-status: non-blocking background activation ──────
    // (gsCoordinator was hoisted to the slot-publish region above so that
    // cleanupGatewayStatus can close over its heartbeat handle; we reuse
    // the same captured reference here.)
    //
    // Fix B: eligibility (exactly one Tlon account) is derived from THIS
    // monitor's own config snapshot (`cfg`, the channel-start `ctx.cfg`),
    // not from anything registerFull decided — an account added/removed via
    // a channels.tlon hot-reload restarts monitors without a second
    // registerFull, so a value cached at registration time would go stale.
    // gsCoordinator itself is created unconditionally in index.ts
    // (independent of account count). The decision lives in the shared
    // gateGatewayStatusActivation() so tests exercise the exact gate.
    //
    // Compose the host abort (config-reload/shutdown restart) with the
    // monitor-local activation abort (bootstrap-failure teardown) so the
    // orchestration's wait/watchdog/backoff honor either.
    const gatewayStatusSignal = opts.abortSignal
      ? AbortSignal.any([opts.abortSignal, gatewayStatusActivationAbort.signal])
      : gatewayStatusActivationAbort.signal;
    void gateGatewayStatusActivation({
      cfg,
      coordinator: gsCoordinator,
      effectiveOwnerShip,
      signal: gatewayStatusSignal,
      isTornDown: () => gatewayStatusCleanupRan,
      logger: {
        log: (m) => runtime.log?.(m),
        error: (m) => runtime.error?.(m),
      },
      onActivationError: (err, attempt) =>
        capturePluginError('gateway_status_activation', err, { attempt }),
      onHeartbeatError: (err) =>
        capturePluginError('gateway_status_heartbeat', err),
      onWatchdogTimeout: () =>
        capturePluginError(
          'gateway_status_activation',
          new Error('gateway-status start watchdog timeout'),
          { errorKind: 'start_watchdog_timeout' }
        ),
      onMultiAccountSkip: (count) =>
        runtime.log?.(
          `[gateway-status] skipped: ${count} Tlon accounts configured, ` +
            `but v1 only supports one (global @tloncorp/api client cannot target multiple ships)`
        ),
      registerHeartbeatStop: (stop) => {
        // A concurrent teardown may have already run cleanupGatewayStatus
        // (which clears/nulls this handle) between the heartbeat starting
        // and this callback running; stop it immediately instead of
        // leaving a zombie interval that only self-clears on its next tick.
        if (gatewayStatusCleanupRan) {
          stop();
          return;
        }
        stopGatewayHeartbeat = stop;
      },
    });

    // Fetch group metadata AFTER settings are loaded so approval cards can display
    // friendly group names for both auto-discovered and manually configured channels.
    const shouldFetchGroupMetadata =
      effectiveAutoDiscoverChannels ||
      account.groupChannels.length > 0 ||
      Boolean(currentSettings.groupChannels?.length) ||
      effectiveAutoAcceptGroupInvites;
    if (shouldFetchGroupMetadata) {
      try {
        const initData = await fetchInitData(api, runtime);
        if (effectiveAutoDiscoverChannels && initData.channels.length > 0) {
          groupChannels = initData.channels;
        }
        // Populate channel-to-group mapping for member hint injection
        for (const [nest, groupFlag] of initData.channelToGroup) {
          channelToGroup.set(nest, groupFlag);
        }
        for (const [nest, title] of initData.channelNames) {
          channelNameCache.set(nest, title);
        }
        // Populate group name cache for human-readable display
        for (const [flag, title] of initData.groupNames) {
          groupNameCache.set(flag, title);
        }
        initForeigns = initData.foreigns;
      } catch (error: any) {
        runtime.error?.(
          `[tlon] Auto-discovery failed: ${error?.message ?? String(error)}`
        );
      }
    }

    // Merge manual config with auto-discovered channels
    if (account.groupChannels.length > 0) {
      for (const ch of account.groupChannels) {
        if (!groupChannels.includes(ch)) {
          groupChannels.push(ch);
        }
      }
      runtime.log?.(
        `[tlon] Added ${account.groupChannels.length} manual groupChannels to monitoring`
      );
    }

    // Also merge settings store groupChannels (may have been set via tlon settings command)
    if (currentSettings.groupChannels?.length) {
      for (const ch of currentSettings.groupChannels) {
        if (!groupChannels.includes(ch)) {
          groupChannels.push(ch);
        }
      }
    }

    if (groupChannels.length > 0) {
      runtime.log?.(
        `[tlon] Monitoring ${groupChannels.length} group channel(s): ${groupChannels.join(', ')}`
      );
    } else {
      runtime.log?.('[tlon] No group channels to monitor (DMs only)');
    }

    async function resolveCitedContent(story: unknown): Promise<string> {
      return resolveCites(api!, story, {
        runtime,
        signal: opts.abortSignal,
      });
    }

    // Helper to save pending approvals to settings store
    async function savePendingApprovals(): Promise<void> {
      const beforePrune = pendingApprovals.length;
      pendingApprovals = pruneExpired(pendingApprovals);
      if (pendingApprovals.length !== beforePrune) {
        runtime.log?.(
          `[tlon] Pruned ${beforePrune - pendingApprovals.length} expired pending approval(s)`
        );
      }
      try {
        await api!.poke({
          app: 'settings',
          mark: 'settings-event',
          json: {
            'put-entry': {
              desk: 'moltbot',
              'bucket-key': 'tlon',
              'entry-key': 'pendingApprovals',
              value: JSON.stringify(pendingApprovals),
            },
          },
        });
      } catch (err) {
        runtime.error?.(
          `[tlon] Failed to save pending approvals: ${String(err)}`
        );
      }
    }

    // Helper to update dmAllowlist in settings store
    async function addToDmAllowlist(ship: string): Promise<void> {
      const normalizedShip = normalizeShip(ship);
      if (!effectiveDmAllowlist.includes(normalizedShip)) {
        effectiveDmAllowlist = [...effectiveDmAllowlist, normalizedShip];
      }
      try {
        await api!.poke({
          app: 'settings',
          mark: 'settings-event',
          json: {
            'put-entry': {
              desk: 'moltbot',
              'bucket-key': 'tlon',
              'entry-key': 'dmAllowlist',
              value: effectiveDmAllowlist,
            },
          },
        });
        runtime.log?.(`[tlon] Added ${normalizedShip} to dmAllowlist`);
      } catch (err) {
        runtime.error?.(`[tlon] Failed to update dmAllowlist: ${String(err)}`);
      }
    }

    // Helper to remove ship from dmAllowlist in both memory and settings store
    async function removeFromDmAllowlist(ship: string): Promise<void> {
      const normalizedShip = normalizeShip(ship);
      const before = effectiveDmAllowlist.length;
      effectiveDmAllowlist = effectiveDmAllowlist.filter(
        (s) => s !== normalizedShip
      );
      if (effectiveDmAllowlist.length === before) {
        return; // Ship wasn't on the list
      }
      try {
        await api!.poke({
          app: 'settings',
          mark: 'settings-event',
          json: {
            'put-entry': {
              desk: 'moltbot',
              'bucket-key': 'tlon',
              'entry-key': 'dmAllowlist',
              value: effectiveDmAllowlist,
            },
          },
        });
        runtime.log?.(`[tlon] Removed ${normalizedShip} from dmAllowlist`);
      } catch (err) {
        runtime.error?.(`[tlon] Failed to update dmAllowlist: ${String(err)}`);
      }
    }

    // Helper to update channelRules in settings store
    async function addToChannelAllowlist(
      ship: string,
      channelNest: string
    ): Promise<void> {
      const normalizedShip = normalizeShip(ship);
      const channelRules = currentSettings.channelRules ?? {};
      const rule = channelRules[channelNest] ?? {
        mode: 'allowlist',
        allowedShips: [],
      };
      const allowedShips = [...(rule.allowedShips ?? [])]; // Clone to avoid mutation

      if (!allowedShips.includes(normalizedShip)) {
        allowedShips.push(normalizedShip);
      }

      const updatedRules = {
        ...channelRules,
        [channelNest]: { ...rule, allowedShips },
      };

      // Update local state immediately (don't wait for settings subscription)
      currentSettings = { ...currentSettings, channelRules: updatedRules };

      try {
        await api!.poke({
          app: 'settings',
          mark: 'settings-event',
          json: {
            'put-entry': {
              desk: 'moltbot',
              'bucket-key': 'tlon',
              'entry-key': 'channelRules',
              value: JSON.stringify(updatedRules),
            },
          },
        });
        runtime.log?.(
          `[tlon] Added ${normalizedShip} to ${channelNest} allowlist`
        );
      } catch (err) {
        runtime.error?.(`[tlon] Failed to update channelRules: ${String(err)}`);
      }
    }

    // Helper to block a ship using Tlon's native blocking
    async function blockShip(ship: string): Promise<void> {
      const normalizedShip = normalizeShip(ship);
      try {
        await api!.poke({
          app: 'chat',
          mark: 'chat-block-ship',
          json: { ship: normalizedShip },
        });
        runtime.log?.(`[tlon] Blocked ship ${normalizedShip}`);
      } catch (err) {
        runtime.error?.(
          `[tlon] Failed to block ship ${normalizedShip}: ${String(err)}`
        );
      }
    }

    /**
     * Scry the chat agent's blocked ship list with an explicit timeout.
     * The urbitFetch timeout (30s) may not fire if the underlying connection
     * stalls (e.g. after a chat-block-ship poke causes the agent to restart).
     * This wrapper guarantees resolution within SCRY_TIMEOUT_MS.
     */
    const SCRY_TIMEOUT_MS = 15_000;

    async function scryBlockedShips(): Promise<string[]> {
      const blocked = (await Promise.race([
        api!.scry('/chat/blocked.json'),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('blocked list scry timeout')),
            SCRY_TIMEOUT_MS
          )
        ),
      ])) as string[] | undefined;
      return Array.isArray(blocked) ? blocked : [];
    }

    // Check if a ship is blocked using Tlon's native block list
    async function isShipBlocked(ship: string): Promise<boolean> {
      const normalizedShip = normalizeShip(ship);
      try {
        const blocked = await scryBlockedShips();
        return blocked.some((s) => normalizeShip(s) === normalizedShip);
      } catch (err) {
        runtime.log?.(`[tlon] Failed to check blocked list: ${String(err)}`);
        return false;
      }
    }

    // Get all blocked ships
    async function getBlockedShips(): Promise<string[]> {
      try {
        return await scryBlockedShips();
      } catch (err) {
        runtime.log?.(`[tlon] Failed to get blocked list: ${String(err)}`);
        return [];
      }
    }

    // Helper to unblock a ship using Tlon's native blocking
    async function unblockShip(ship: string): Promise<boolean> {
      const normalizedShip = normalizeShip(ship);
      try {
        const blocked = await isShipBlocked(normalizedShip);
        if (!blocked) {
          runtime.log?.(
            `[tlon] Ship ${normalizedShip} is not blocked; skipping unblock`
          );
          return true;
        }
        await api!.poke({
          app: 'chat',
          mark: 'chat-unblock-ship',
          json: { ship: normalizedShip },
        });
        runtime.log?.(`[tlon] Unblocked ship ${normalizedShip}`);
        return true;
      } catch (err) {
        runtime.error?.(
          `[tlon] Failed to unblock ship ${normalizedShip}: ${String(err)}`
        );
        return false;
      }
    }

    // Helper to send DM notification to owner. Returns the message ID if sent successfully.
    async function sendOwnerNotification(
      message: string,
      blob?: string
    ): Promise<string | undefined> {
      if (!effectiveOwnerShip) {
        runtime.log?.(
          '[tlon] No ownerShip configured, cannot send notification'
        );
        return undefined;
      }
      try {
        const result = await sendDm({
          botProfile: getBotProfile(),
          fromShip: botShipName,
          toShip: effectiveOwnerShip,
          text: message,
          blob,
        });
        runtime.log?.(
          `[tlon] Sent notification to owner ${effectiveOwnerShip}`
        );
        return result.messageId;
      } catch (err) {
        runtime.error?.(
          `[tlon] Failed to send notification to owner: ${String(err)}`
        );
        return undefined;
      }
    }

    function getReplyBlob(payload: ReplyPayload): string | undefined {
      const blob = (payload.channelData?.tlon as { blob?: unknown } | undefined)
        ?.blob;
      return typeof blob === 'string' ? blob : undefined;
    }

    // Merge serialized post-blob fields (each a JSON array of entries) into one,
    // so a reply can carry both an a2ui card and a context-lens reference.
    function combineBlobFields(
      ...fields: Array<string | undefined>
    ): string | undefined {
      const entries: unknown[] = [];
      for (const field of fields) {
        if (!field) {
          continue;
        }
        try {
          const parsed = JSON.parse(field);
          if (Array.isArray(parsed)) {
            entries.push(...parsed);
          }
        } catch {
          // Skip a malformed blob field rather than dropping the whole message.
        }
      }
      return entries.length > 0 ? JSON.stringify(entries) : undefined;
    }

    // Regex to match block directives in agent responses
    // Format: [BLOCK_USER: ~ship-name | reason for blocking]
    const blockDirectiveRegex = /\[BLOCK_USER:\s*(~[\w-]+)\s*\|\s*(.+?)\]/g;

    // Process block directives from agent response and return text with directives stripped
    async function processBlockDirectives(
      text: string,
      senderShip: string
    ): Promise<string> {
      const matches = [...text.matchAll(blockDirectiveRegex)];

      if (matches.length > 0) {
        runtime.log?.(
          `[tlon] Found ${matches.length} block directive(s) in response`
        );
        runtime.log?.(
          `[tlon] Sender ship: "${senderShip}" -> normalized: "${normalizeShip(senderShip)}"`
        );
        runtime.log?.(`[tlon] Owner ship: "${effectiveOwnerShip}"`);
      }

      for (const match of matches) {
        const targetShip = normalizeShip(match[1]);
        const reason = match[2].trim();

        runtime.log?.(
          `[tlon] Processing block directive: target="${targetShip}", reason="${reason}"`
        );

        // Safety: Never block the owner
        if (effectiveOwnerShip && targetShip === effectiveOwnerShip) {
          runtime.log?.(
            `[tlon] Agent attempted to block owner ship ${targetShip} - ignoring`
          );
          continue;
        }

        // Only allow blocking the current message sender (not arbitrary third parties)
        const normalizedSender = normalizeShip(senderShip);
        if (targetShip !== normalizedSender) {
          runtime.log?.(
            `[tlon] Agent tried to block "${targetShip}" but sender is "${normalizedSender}" - ignoring`
          );
          continue;
        }

        // Block the abusive sender
        runtime.log?.(`[tlon] Executing block for ${targetShip}...`);
        await blockShip(targetShip);

        // Notify owner
        if (effectiveOwnerShip) {
          await sendOwnerNotification(
            `[Agent Action] Blocked ${targetShip}\nReason: ${reason}`
          );
        }
        runtime.log?.(`[tlon] Agent blocked ${targetShip}: ${reason}`);
      }

      // Strip directives from visible response
      return text.replace(blockDirectiveRegex, '').trim();
    }

    // Queue a new approval request and notify the owner
    async function queueApprovalRequest(
      approval: PendingApproval
    ): Promise<void> {
      pendingApprovals = pruneExpired(pendingApprovals);

      // Check if ship is blocked - silently ignore
      if (await isShipBlocked(approval.requestingShip)) {
        runtime.log?.(
          `[tlon] Ignoring request from blocked ship ${approval.requestingShip}`
        );
        return;
      }

      // Check for duplicate - if found, update it with new content and re-notify
      const existingIndex = pendingApprovals.findIndex(
        (a) =>
          a.type === approval.type &&
          a.requestingShip === approval.requestingShip &&
          (approval.type !== 'channel' ||
            a.channelNest === approval.channelNest) &&
          (approval.type !== 'group' || a.groupFlag === approval.groupFlag)
      );

      if (existingIndex !== -1) {
        // Update existing approval with new content (preserves the original ID)
        const existing = pendingApprovals[existingIndex];
        if (approval.originalMessage) {
          existing.originalMessage = approval.originalMessage;
          existing.messagePreview = approval.messagePreview;
        }
        runtime.log?.(
          `[tlon] Updated existing approval for ${approval.requestingShip} (${approval.type}) - re-sending notification`
        );
        // Send notification first, then save once with the notification ID.
        // Saving before sendOwnerNotification causes a race: the settings subscription
        // event replaces pendingApprovals in-memory, so the notificationMessageId
        // set on the old object reference is lost.
        const displayContext = buildDisplayContext();
        const existNotifId = await sendOwnerNotification(
          formatApprovalRequestNotification(existing, displayContext),
          buildApprovalBlobField(existing, displayContext)
        );
        if (existNotifId) {
          existing.notificationMessageId =
            normalizeNotificationId(existNotifId);
        }
        await savePendingApprovals();
        return;
      }

      // Send notification before saving so notificationMessageId is included
      // in the single save. See comment above about the settings subscription race.
      const displayContext = buildDisplayContext();
      const notifId = await sendOwnerNotification(
        formatApprovalRequestNotification(approval, displayContext),
        buildApprovalBlobField(approval, displayContext)
      );
      if (notifId) {
        approval.notificationMessageId = normalizeNotificationId(notifId);
      }
      pendingApprovals.push(approval);
      await savePendingApprovals();
      runtime.log?.(
        `[tlon] Queued approval request: ${approval.id} (${approval.type} from ${approval.requestingShip})`
      );
    }

    // ── Approval action execution ─────────────────────────────────────
    // Shared by the slash command bridge and the reaction-based approval handler.
    async function executeApprovalAction(
      approval: PendingApproval,
      action: 'approve' | 'deny' | 'block'
    ): Promise<string> {
      if (action === 'approve') {
        switch (approval.type) {
          case 'dm':
            await addToDmAllowlist(approval.requestingShip);
            if (approval.originalMessage) {
              runtime.log?.(
                `[tlon] Processing original message from ${approval.requestingShip} after approval`
              );
              const replayMessage = await buildReplayMessageText(
                approval.originalMessage,
                api!,
                { runtime, signal: opts.abortSignal }
              );
              await processMessage({
                messageId: approval.originalMessage.messageId,
                senderShip: approval.requestingShip,
                messageText: replayMessage.messageText,
                ...(replayMessage.citedContent
                  ? { citedContent: replayMessage.citedContent }
                  : {}),
                ...(replayMessage.gateText !== undefined
                  ? { gateText: replayMessage.gateText }
                  : {}),
                trigger: 'dm',
                messageContent: approval.originalMessage.messageContent,
                isGroup: false,
                timestamp: approval.originalMessage.timestamp,
                blobField: approval.originalMessage.blob,
              });
            }
            break;

          case 'channel':
            if (approval.channelNest) {
              await addToChannelAllowlist(
                approval.requestingShip,
                approval.channelNest
              );
              if (approval.originalMessage) {
                const nest = parseChannelNest(approval.channelNest);
                runtime.log?.(
                  `[tlon] Processing original message from ${approval.requestingShip} in ${approval.channelNest} after approval`
                );
                const replayMessage = await buildReplayMessageText(
                  approval.originalMessage,
                  api!,
                  { runtime, signal: opts.abortSignal }
                );
                await processMessage({
                  messageId: approval.originalMessage.messageId,
                  senderShip: approval.requestingShip,
                  messageText: replayMessage.messageText,
                  ...(replayMessage.citedContent
                    ? { citedContent: replayMessage.citedContent }
                    : {}),
                  ...(replayMessage.gateText !== undefined
                    ? { gateText: replayMessage.gateText }
                    : {}),
                  trigger: approval.originalMessage.isThreadReply
                    ? 'thread'
                    : 'mention',
                  cachesHistory: true,
                  messageContent: approval.originalMessage.messageContent,
                  isGroup: true,
                  channelNest: approval.channelNest,
                  hostShip: nest?.hostShip,
                  channelName: nest?.channelName,
                  timestamp: approval.originalMessage.timestamp,
                  parentId: approval.originalMessage.parentId,
                  isThreadReply: approval.originalMessage.isThreadReply,
                  blobField: approval.originalMessage.blob,
                });
              }
            }
            break;

          case 'group':
            if (approval.groupFlag) {
              try {
                await api!.poke({
                  app: 'groups',
                  mark: 'group-join',
                  json: {
                    flag: approval.groupFlag,
                    'join-all': true,
                  },
                });
                runtime.log?.(
                  `[tlon] Joined group ${approval.groupFlag} after approval`
                );

                setTimeout(async () => {
                  try {
                    const discoveredChannels = await fetchAllChannels(
                      api!,
                      runtime
                    );
                    let newCount = 0;
                    for (const channelNest of discoveredChannels) {
                      if (!watchedChannels.has(channelNest)) {
                        watchedChannels.add(channelNest);
                        newCount++;
                      }
                    }
                    if (newCount > 0) {
                      runtime.log?.(
                        `[tlon] Discovered ${newCount} new channel(s) after joining group`
                      );
                    }
                  } catch (err) {
                    runtime.log?.(
                      `[tlon] Channel discovery after group join failed: ${String(err)}`
                    );
                  }
                }, 2000);
              } catch (err) {
                runtime.error?.(
                  `[tlon] Failed to join group ${approval.groupFlag}: ${String(err)}`
                );
              }
            }
            break;
        }
      } else if (action === 'block') {
        await blockShip(approval.requestingShip);
        await removeFromDmAllowlist(approval.requestingShip);
      }
      // "deny" — no side effects beyond removing from pending

      pendingApprovals = removePendingApproval(pendingApprovals, approval.id);
      await savePendingApprovals();

      return formatApprovalConfirmation(
        approval,
        action,
        buildDisplayContext()
      );
    }

    // ── Command bridge ──────────────────────────────────────────────────
    // Exposes approval/admin actions to slash commands registered in index.ts.
    // Handlers return response text; the slash command framework sends it back.
    const accountKey = opts.accountId ?? undefined;
    const commandBridge: ApprovalCommandBridge = {
      get ownerShip() {
        return effectiveOwnerShip;
      },
      async handleAction(action, id) {
        // Prune expired approvals
        pendingApprovals = pruneExpired(pendingApprovals);
        await savePendingApprovals();

        const approval = findPendingApproval(pendingApprovals, id);
        if (!approval) {
          return 'No pending approval found' + (id ? ` for ID: #${id}` : '.');
        }

        return executeApprovalAction(approval, action);
      },

      async getPendingApprovalsReply() {
        pendingApprovals = pruneExpired(pendingApprovals);
        await savePendingApprovals();

        const pending = buildPendingApprovalsResponse(
          pendingApprovals,
          buildDisplayContext(),
          (blob) => {
            try {
              return serializeBlobField(blob);
            } catch (err) {
              runtime.error?.(
                `[tlon] Failed to serialize pending approvals A2UI blob: ${String(err)}`
              );
              return undefined;
            }
          },
          (err) => {
            runtime.error?.(
              `[tlon] Failed to build pending approvals A2UI blob: ${String(err)}`
            );
          },
          {
            // Same visibility rule as buildApprovalBlobField: only DM sources
            // are restricted to recipients on the bot's own account.
            recipientSeesBotDms: effectiveOwnerShip === botShipName,
          }
        );

        if (pending.mode === 'ui') {
          return {
            text: pending.text,
            channelData: { tlon: { blob: pending.blob } },
          };
        }

        return { text: pending.text };
      },

      async getBlockedList() {
        const blockedShips = await getBlockedShips();
        return formatBlockedList(blockedShips);
      },

      async handleUnblock(ship) {
        runtime.log?.(
          `[tlon] handleUnblock: checking if ${ship} is blocked...`
        );
        const blocked = await isShipBlocked(ship);
        if (!blocked) {
          return `${ship} is not blocked.`;
        }
        const success = await unblockShip(ship);
        return success ? `Unblocked ${ship}.` : `Failed to unblock ${ship}.`;
      },

      // ── Owner-listen controls ────────────────────────────────────────────
      isOwnedChannel(nest: string) {
        // Canonicalize first so case variants in user input (e.g.
        // `chat/~ZOD/general`) match the lowercase owner/bot ship strings.
        const canonical = canonicalizeNest(nest);
        if (!canonical) {
          return false;
        }
        const parsed = parseChannelNest(canonical);
        if (!parsed) {
          return false;
        }
        return (
          parsed.hostShip === effectiveOwnerShip ||
          parsed.hostShip === botShipName
        );
      },
      getOwnerListenGlobal() {
        return effectiveOwnerListenEnabled;
      },
      async setOwnerListenGlobal(enabled: boolean) {
        effectiveOwnerListenEnabled = enabled;
        try {
          await api.poke({
            app: 'settings',
            mark: 'settings-event',
            json: {
              'put-entry': {
                desk: 'moltbot',
                'bucket-key': 'tlon',
                'entry-key': 'ownerListenEnabled',
                value: enabled,
              },
            },
          });
          runtime.log?.(`[tlon] ownerListenEnabled → ${enabled}`);
        } catch (err) {
          runtime.error?.(
            `[tlon] Failed to persist ownerListenEnabled: ${String(err)}`
          );
        }
        return enabled;
      },
      isOwnerListenDisabled(nest: string) {
        const canonical = canonicalizeNest(nest);
        if (!canonical) {
          return false;
        }
        return effectiveOwnerListenDisabled.has(canonical);
      },
      async setOwnerListenDisabled(nest: string, disabled: boolean) {
        const canonical = canonicalizeNest(nest);
        if (!canonical) {
          runtime.error?.(
            `[tlon] setOwnerListenDisabled: cannot parse nest ${nest}`
          );
          return !disabled;
        }
        if (disabled) {
          effectiveOwnerListenDisabled.add(canonical);
        } else {
          effectiveOwnerListenDisabled.delete(canonical);
        }
        const list = [...effectiveOwnerListenDisabled];
        try {
          await api.poke({
            app: 'settings',
            mark: 'settings-event',
            json: {
              'put-entry': {
                desk: 'moltbot',
                'bucket-key': 'tlon',
                'entry-key': 'ownerListenDisabledChannels',
                value: list,
              },
            },
          });
          runtime.log?.(
            `[tlon] ownerListenDisabledChannels → [${list.join(', ')}]`
          );
        } catch (err) {
          runtime.error?.(
            `[tlon] Failed to persist ownerListenDisabledChannels: ${String(err)}`
          );
        }
        return !disabled;
      },
      listOwnerListenDisabled() {
        return [...effectiveOwnerListenDisabled];
      },
    };
    setBridge(accountKey, commandBridge);

    // Check if a ship is the owner (always allowed to DM)
    function isOwner(ship: string): boolean {
      if (!effectiveOwnerShip) {
        return false;
      }
      return normalizeShip(ship) === effectiveOwnerShip;
    }

    /**
     * Extract the DM partner ship from the 'whom' field.
     * This is the canonical source for DM routing (more reliable than essay.author).
     * Returns empty string if whom doesn't contain a valid patp-like value.
     */
    function extractDmPartnerShip(whom: unknown): string {
      const raw =
        typeof whom === 'string'
          ? whom
          : whom &&
              typeof whom === 'object' &&
              'ship' in whom &&
              typeof whom.ship === 'string'
            ? whom.ship
            : '';
      const normalized = normalizeShip(raw);
      // Keep DM routing strict: accept only patp-like values.
      return /^~?[a-z-]+$/i.test(normalized) ? normalized : '';
    }

    const processMessage = async (params: {
      messageId: string;
      senderShip: string;
      messageText: string;
      citedContent?: string;
      /** Cite-free rendering used only for message-level gates. */
      gateText?: string;
      trigger?: ContextLensTrigger;
      cachesHistory?: boolean;
      messageContent?: unknown; // Raw Tlon content for media extraction
      blobField?: string | null; // Raw blob JSON from post/reply
      /** Appended to the agent input after the message; see the topics hook. */
      setupDirective?: string;
      isGroup: boolean;
      channelNest?: string;
      hostShip?: string;
      channelName?: string;
      timestamp: number;
      parentId?: string | null;
      isThreadReply?: boolean;
      replyParentId?: string | null; // Override parentId for delivery only (not in ctx payload)
      retryOf?: string; // lensId of the failed run this dispatch retries
    }) => {
      const {
        messageId,
        senderShip,
        isGroup,
        channelNest,
        hostShip: _hostShip,
        channelName: _channelName,
        timestamp,
        parentId,
        isThreadReply,
        messageContent,
      } = params;
      // replyParentId overrides parentId for the deliver callback (thread reply routing)
      // but doesn't affect the ctx payload (MessageThreadId/ReplyToId).
      // Used for reactions: agent sees no thread context (so it responds), but
      // the reply is still delivered as a thread reply.
      const deliverParentId = params.replyParentId ?? parentId;
      const groupChannel = channelNest; // For compatibility
      const rawMessageText = sanitizeMessageText(params.messageText);
      let currentMessageText = rawMessageText;
      const previewText = (text: string, max = 180) => {
        const compact = sanitizeMessageText(text).replace(/\s+/g, ' ').trim();
        return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
      };

      // Strip the sender's bot mention before cite or thread context is prepended.
      // This ensures [Current message] in thread context won't contain the bot ship name,
      // which was causing the agent to mistake it for its own message and return NO_REPLY.
      if (isGroup) {
        currentMessageText = stripBotMentionOutsidePlaceholders(
          currentMessageText,
          botShipName
        );
      }
      const gateText = sanitizeMessageText(
        params.gateText ?? currentMessageText
      );
      const isChannelSummaryRequest =
        isGroup && Boolean(groupChannel) && isSummarizationRequest(gateText);
      const trigger: ContextLensTrigger = isChannelSummaryRequest
        ? 'summarization'
        : params.trigger ?? 'unknown';
      const citedContent = sanitizeMessageText(params.citedContent ?? '');
      let messageText = citedContent
        ? `${citedContent}\n\n${currentMessageText}`
        : currentMessageText;
      if (params.setupDirective) {
        messageText = `${messageText}\n\n${params.setupDirective}`;
      }

      const route = core.channel.routing.resolveAgentRoute({
        cfg,
        channel: 'tlon',
        accountId: opts.accountId ?? undefined,
        peer: {
          kind: isGroup ? 'group' : 'direct',
          id: isGroup ? groupChannel ?? senderShip : senderShip,
        },
      });

      // Core's tool hooks receive a per-peer session key form regardless of the
      // configured dmScope, while route.sessionKey follows the config (default
      // "main"). Register lens bindings and sender roles under every form core
      // might hand the hooks so tool calls attribute to this run.
      const lensSessionKeys: string[] = isGroup
        ? [route.sessionKey]
        : [
            route.sessionKey,
            ...(
              [
                'per-account-channel-peer',
                'per-channel-peer',
                'per-peer',
              ] as const
            ).map((dmScope) =>
              core.channel.routing.buildAgentSessionKey({
                agentId: route.agentId,
                channel: 'tlon',
                accountId: route.accountId,
                peer: { kind: 'direct', id: senderShip },
                dmScope,
              })
            ),
          ];

      const lens = contextLenses.create({
        messageId,
        chatType: isGroup ? 'channel' : 'dm',
        trigger,
        sessionKey: route.sessionKey,
        senderShip,
        conversationId: isGroup ? groupChannel ?? '' : senderShip,
        receivedAt: timestamp,
        preview: previewText(messageText),
        ...(params.retryOf ? { retryOf: params.retryOf } : {}),
        retrySeed: {
          messageText: rawMessageText,
          blobField: params.blobField ?? null,
          messageContent: messageContent ?? null,
          parentId: parentId ?? null,
          isThreadReply: Boolean(isThreadReply),
          replyParentId: params.replyParentId ?? null,
          cachesHistory: Boolean(params.cachesHistory),
        },
      });
      contextLenses.recordPersistence(lens.lensId, {
        cachesHistory: Boolean(params.cachesHistory),
        emitsTelemetry: Boolean(telemetry),
      });
      if (params.cachesHistory) {
        contextLenses.recordPersistenceEvent(lens.lensId, {
          kind: 'conversation_state',
          action: 'read',
          location: 'openclaw',
          status: 'ok',
          key: `session:${lens.sessionKeyHash ?? 'unknown'}`,
          reason: 'history available for routing/session context',
        });
      }
      if (telemetry) {
        contextLenses.recordPersistenceEvent(lens.lensId, {
          kind: 'other',
          action: 'created',
          location: 'external',
          status: 'ok',
          key: 'telemetry',
        });
      }
      if (messageContent) {
        const citedPosts = extractCites(messageContent as Story).length;
        contextLenses.recordContext(lens.lensId, { citedPosts });
        if (citedPosts) {
          contextLenses.recordContextSource(lens.lensId, {
            kind: 'message',
            label: 'Cited posts',
            sourceId: messageId,
            included: true,
            reason: 'explicit citation',
          });
        }
      }
      logContextLens(lens.lensId, 'created');

      // Track owner interaction timestamp for the nudge scheduler.
      // The shadows update synchronously; the durable %settings writes happen
      // in the background via an ordered queue so the owner-DM hot path never
      // waits on an Urbit RTT.
      if (isOwner(senderShip)) {
        const isoDate = new Date(timestamp).toISOString().split('T')[0] ?? ''; // YYYY-MM-DD

        // (1a) Synchronous shadow: owner activity. Updated FIRST so any tick
        //      that observes both shadows sees "activity-first" ordering.
        setLastOwnerActivity(account.accountId, {
          at: timestamp,
          date: isoDate,
        });

        // Check for pending nudge re-engagement. Stage is cleared on ANY owner
        // reply when the stage shadow is non-zero (or pendingNudge is present)
        // so the next inactivity cycle can send the same stage again. Gating on
        // `pendingNudge` alone would miss the in-flight-tick race: the scheduler
        // pokes `lastNudgeStage` and sets the shadow before `sendDm()`, but
        // only writes `pendingNudge` after the send resolves — so a reply that
        // lands in that window would otherwise leave the stage stuck.
        const pending = getPendingNudge(account.accountId);
        const shadowStage = getLastNudgeStageShadow(account.accountId) ?? 0;
        const willClearStage = shadowStage > 0 || Boolean(pending);

        // (1b) Synchronous shadow: stage cleared (only when we'd clear).
        if (willClearStage) {
          setLastNudgeStageShadow(account.accountId, 0);
        }

        // (2) Enqueue durable writes. The queue awaits the put-entries before
        //     issuing the del-entry on the wire, closing the crash-consistency
        //     gap. The handler does NOT await the queue.
        ownerReplyPersistence.enqueue({
          at: timestamp,
          date: isoDate,
          clearStage: willClearStage,
        });
        contextLenses.recordPersistence(lens.lensId, { updatesSettings: true });
        contextLenses.recordPersistenceEvent(lens.lensId, {
          kind: 'conversation_state',
          action: 'updated',
          location: 'urbit',
          status: 'ok',
          key: 'owner-activity',
          reason: willClearStage
            ? 'owner reply cleared pending nudge stage'
            : 'owner activity',
        });

        if (pending) {
          if (isNudgeEligible(pending, timestamp)) {
            const reengagedAt = timestamp;
            telemetry?.captureHeartbeatReengagement({
              ownerShip: pending.ownerShip,
              botShip: account.ship ?? '',
              nudgeStage: pending.stage,
              nudgeSentAt: pending.sentAt,
              reengagedAt,
              reengagementDelayMs: reengagedAt - pending.sentAt,
              channel: 'tlon',
              accountId: pending.accountId,
            });
            runtime.log?.(
              `[tlon] Heartbeat nudge re-engagement: stage ${pending.stage}, delay ${reengagedAt - pending.sentAt}ms`
            );
          } else {
            runtime.log?.(
              `[tlon] Pending nudge expired (stage ${pending.stage}, sent ${pending.sentAt})`
            );
          }
          clearLocalPendingNudge(account.accountId);
        }

        // Inject reply context for the agent when the reply appears to be a
        // response to a recent, eligible nudge.
        //
        // Restricted to DMs (`!isGroup`). The nudge itself was sent as a DM,
        // so prefacing a channel/group reply with DM-only context — including
        // the verbatim nudge `content` — would leak that context into an
        // unrelated public conversation.
        if (pending && isNudgeEligible(pending, timestamp) && !isGroup) {
          contextLenses.recordContext(lens.lensId, { pendingNudge: true });
          contextLenses.recordContextSource(lens.lensId, {
            kind: 'message',
            label: 'Pending nudge',
            sourceId: `nudge:${pending.stage}`,
            included: true,
            reason: 'owner reply matched recent nudge',
            preview: pending.content ? previewText(pending.content) : undefined,
          });
          const sentIso = new Date(pending.sentAt).toISOString();
          const contentBlock = pending.content
            ? `Message content:\n\n${pending.content}\n\n`
            : '';
          messageText =
            `[Context: You recently sent ${pending.ownerShip} a stage-${pending.stage} ` +
            `re-engagement nudge at ${sentIso}. ${contentBlock}` +
            `The owner's reply below may be responding to that nudge.]\n\n` +
            messageText;
        }
      }

      // Download any images from the message content
      let attachments: Array<{ path: string; contentType: string }> = [];
      if (messageContent) {
        try {
          attachments = await downloadMessageImages(messageContent);
          if (attachments.length > 0) {
            contextLenses.recordContext(lens.lensId, {
              attachments: attachments.length,
            });
            contextLenses.recordPersistence(lens.lensId, { writesMedia: true });
            contextLenses.recordContextSource(lens.lensId, {
              kind: 'message',
              label: 'Image attachments',
              sourceId: messageId,
              included: true,
              reason: `${attachments.length} downloaded for model input`,
            });
            contextLenses.recordPersistenceEvent(lens.lensId, {
              kind: 'artifact',
              action: 'created',
              location: 'openclaw',
              status: 'ok',
              key: 'message-images',
              reason: `${attachments.length} image attachment(s) cached for run`,
            });
            runtime.log?.(
              `[tlon] Downloaded ${attachments.length} image(s) from message`
            );
          }
        } catch (error: any) {
          runtime.log?.(
            `[tlon] Failed to download images: ${error?.message ?? String(error)}`
          );
        }
      }

      // Parse and handle blob attachments (files, voice memos, videos)
      const blobData = parseBlobData(params.blobField);
      if (blobData) {
        // Add text annotations so the agent knows what was attached
        const blobAnnotations = formatBlobAnnotations(blobData);
        if (blobAnnotations) {
          messageText = blobAnnotations + '\n' + messageText;
          runtime.log?.(
            `[tlon] Added blob annotations: ${blobAnnotations} attachment(s)`
          );
        }

        // Download blob files as attachments
        try {
          const { attachments: blobAttachments, notices: blobDownloadNotices } =
            await downloadBlobAttachments(blobData);
          if (blobDownloadNotices.length > 0) {
            messageText = blobDownloadNotices.join('\n') + '\n' + messageText;
            contextLenses.recordContextSource(lens.lensId, {
              kind: 'message',
              label: 'Oversized blob attachments',
              sourceId: messageId,
              included: false,
              reason: 'size limit',
              preview: previewText(blobDownloadNotices.join(' ')),
            });
            runtime.log?.(
              `[tlon] Skipped oversized blob attachment(s): ${blobDownloadNotices.join(' | ')}`
            );
          }
          if (blobAttachments.length > 0) {
            attachments = attachments.concat(blobAttachments);
            contextLenses.recordContext(lens.lensId, {
              attachments: attachments.length,
            });
            contextLenses.recordPersistence(lens.lensId, { writesMedia: true });
            contextLenses.recordContextSource(lens.lensId, {
              kind: 'message',
              label: 'Blob attachments',
              sourceId: messageId,
              included: true,
              reason: `${blobAttachments.length} downloaded for model input`,
            });
            contextLenses.recordPersistenceEvent(lens.lensId, {
              kind: 'artifact',
              action: 'created',
              location: 'openclaw',
              status: 'ok',
              key: 'blob-attachments',
              reason: `${blobAttachments.length} blob attachment(s) cached for run`,
            });
            runtime.log?.(
              `[tlon] Downloaded blob attachment(s) ${JSON.stringify(blobAttachments)}`
            );
          }
        } catch (error: any) {
          runtime.log?.(
            `[tlon] Failed to download blob attachments: ${error?.message ?? String(error)}`
          );
        }
      }

      // Fetch thread context when entering a thread for the first time
      if (isThreadReply && parentId && groupChannel) {
        try {
          const threadContextHistory = await fetchThreadContextHistory(
            api,
            groupChannel,
            parentId,
            20,
            runtime
          );
          if (threadContextHistory.length > 0) {
            contextLenses.recordContext(lens.lensId, {
              threadMessages: threadContextHistory.length,
            });
            contextLenses.recordContextSource(lens.lensId, {
              kind: 'message',
              label: 'Thread context',
              sourceId: parentId,
              included: true,
              reason: `${threadContextHistory.length} recent thread message(s)`,
            });
            const threadContextMessage = buildThreadContextMessage(
              threadContextHistory,
              messageText,
              {
                formatAuthor: formatShipWithNickname,
                sanitizeContent: sanitizeMessageText,
              }
            );
            if (threadContextMessage) {
              messageText = threadContextMessage.messageText;
              runtime?.log?.(
                `[tlon] Added thread context (${threadContextMessage.contextMessages.length} messages, parent included) to message`
              );
            }
          }
        } catch (error: any) {
          runtime?.log?.(
            `[tlon] Could not fetch thread context: ${error?.message ?? String(error)}`
          );
          // Continue without thread context - not critical
        }
      }

      // Fetch recent channel history on mention (non-thread) so the agent has
      // context about what the channel has been discussing.
      if (isGroup && groupChannel && !isThreadReply) {
        try {
          const recentHistory = await fetchChannelHistory(
            api,
            groupChannel,
            20,
            runtime
          );
          if (recentHistory.length > 0) {
            contextLenses.recordContext(lens.lensId, {
              channelMessages: recentHistory.filter(
                (msg) => msg.id !== params.messageId
              ).length,
            });
            contextLenses.recordContextSource(lens.lensId, {
              kind: 'message',
              label: 'Recent channel activity',
              sourceId: groupChannel,
              included: true,
              reason: `${recentHistory.length} recent channel message(s) fetched`,
            });
            // Filter out the current message itself (avoid duplication)
            const contextMessages = recentHistory
              .filter((msg) => msg.id !== params.messageId)
              .slice(0, 20)
              .toReversed() // oldest first for natural reading order
              .map(
                (msg) =>
                  `${formatShipWithNickname(msg.author)}: ${sanitizeMessageText(renderHistoryContent(msg))}`
              )
              .join('\n');

            if (contextMessages) {
              const contextNote = `[Recent channel activity - ${recentHistory.length} messages. Use this context to understand what's being discussed.]`;
              messageText = `${contextNote}\n\n${contextMessages}\n\n[Current message (mentioned you)]\n${messageText}`;
              runtime?.log?.(
                `[tlon] Added channel context (${recentHistory.length} messages) to mention in ${groupChannel}`
              );
            }
          }
        } catch (error: any) {
          runtime?.log?.(
            `[tlon] Could not fetch channel context: ${error?.message ?? String(error)}`
          );
          // Continue without channel context - not critical
        }
      }

      if (isChannelSummaryRequest && groupChannel) {
        try {
          const history = await getChannelHistory(
            api,
            groupChannel,
            50,
            runtime
          );
          contextLenses.recordContext(lens.lensId, {
            channelMessages: history.length,
          });
          contextLenses.recordContextSource(lens.lensId, {
            kind: 'message',
            label: 'Channel summary history',
            sourceId: groupChannel,
            included: history.length > 0,
            reason:
              history.length > 0
                ? `${history.length} messages for summarization`
                : 'empty history',
          });
          if (history.length === 0) {
            const noHistoryMsg =
              "I couldn't fetch any messages for this channel. It might be empty or there might be a permissions issue.";
            const contextLensBlob = buildContextLensReferenceBlobField(
              lens.lensId
            );
            let outputMessageId: string | null = null;
            if (isGroup && groupChannel) {
              const result = await postToChannel(groupChannel, noHistoryMsg, {
                blob: contextLensBlob,
              });
              outputMessageId = result.messageId;
            } else {
              const result = await sendDm({
                botProfile: getBotProfile(),
                fromShip: botShipName,
                toShip: senderShip,
                text: noHistoryMsg,
                blob: contextLensBlob,
              });
              outputMessageId = result.messageId;
            }
            contextLenses.recordPersistence(lens.lensId, { postsReply: true });
            if (outputMessageId) {
              contextLenses.recordOutput(lens.lensId, {
                messageId: outputMessageId,
                conversationId: isGroup ? groupChannel ?? '' : senderShip,
                kind: isGroup ? 'channel' : 'dm',
                sentAt: Date.now(),
                preview: previewText(noHistoryMsg),
                chunkIndex: 0,
              });
            }
            contextLenses.recordPersistenceEvent(lens.lensId, {
              kind: 'conversation_state',
              action: 'created',
              location: 'urbit',
              status: 'ok',
              key: 'reply',
              reason: 'posted no-history summary response',
            });
            contextLenses.recordLifecycle(lens.lensId, {
              completedAt: Date.now(),
              durationMs: Date.now() - lens.createdAt,
              deliveredMessageCount: 1,
            });
            contextLenses.setStatus(lens.lensId, 'completed');
            logContextLens(lens.lensId, 'final');
            return;
          }

          const historyText = history
            .map(
              (msg) =>
                `[${new Date(msg.timestamp).toLocaleString()}] ${msg.author}: ${sanitizeMessageText(renderHistoryContent(msg))}`
            )
            .join('\n');

          messageText =
            `Please summarize this channel conversation (${history.length} recent messages):\n\n${historyText}\n\n` +
            'Provide a concise summary highlighting:\n' +
            '1. Main topics discussed\n' +
            '2. Key decisions or conclusions\n' +
            '3. Action items if any\n' +
            '4. Notable participants';
        } catch (error: any) {
          const errorMsg = `Sorry, I encountered an error while fetching the channel history: ${error?.message ?? String(error)}`;
          const contextLensBlob = buildContextLensReferenceBlobField(
            lens.lensId
          );
          let outputMessageId: string | null = null;
          if (isGroup && groupChannel) {
            const result = await postToChannel(groupChannel, errorMsg, {
              blob: contextLensBlob,
            });
            outputMessageId = result.messageId;
          } else {
            const result = await sendDm({
              botProfile: getBotProfile(),
              fromShip: botShipName,
              toShip: senderShip,
              text: errorMsg,
              blob: contextLensBlob,
            });
            outputMessageId = result.messageId;
          }
          contextLenses.recordPersistence(lens.lensId, { postsReply: true });
          if (outputMessageId) {
            contextLenses.recordOutput(lens.lensId, {
              messageId: outputMessageId,
              conversationId: isGroup ? groupChannel ?? '' : senderShip,
              kind: isGroup ? 'channel' : 'dm',
              sentAt: Date.now(),
              preview: previewText(errorMsg),
              chunkIndex: 0,
            });
          }
          contextLenses.recordPersistenceEvent(lens.lensId, {
            kind: 'conversation_state',
            action: 'created',
            location: 'urbit',
            status: 'ok',
            key: 'reply',
            reason: 'posted summary error response',
          });
          contextLenses.recordLifecycle(lens.lensId, {
            completedAt: Date.now(),
            durationMs: Date.now() - lens.createdAt,
            deliveredMessageCount: 1,
          });
          contextLenses.setStatus(lens.lensId, 'completed');
          logContextLens(lens.lensId, 'final');
          return;
        }
      }

      // Warn if multiple users share a DM session (insecure dmScope configuration)
      if (!isGroup) {
        const sessionKey = route.sessionKey;
        if (!dmSendersBySession.has(sessionKey)) {
          dmSendersBySession.set(sessionKey, new Set());
        }
        const senders = dmSendersBySession.get(sessionKey)!;
        if (senders.size > 0 && !senders.has(senderShip)) {
          // Log warning
          runtime.log?.(
            `[tlon] ⚠️ SECURITY: Multiple users sharing DM session. ` +
              `Configure "session.dmScope: per-channel-peer" in OpenClaw config.`
          );

          // Notify owner via DM (once per monitor session)
          if (!sharedSessionWarningSent && effectiveOwnerShip) {
            sharedSessionWarningSent = true;
            const warningMsg =
              `⚠️ Security Warning: Multiple users are sharing a DM session with this bot. ` +
              `This can leak conversation context between users.\n\n` +
              `Fix: Add to your OpenClaw config:\n` +
              `session:\n  dmScope: "per-channel-peer"\n\n` +
              `Docs: https://docs.openclaw.ai/concepts/session#secure-dm-mode`;

            // Send async, don't block message processing
            sendDm({
              botProfile: getBotProfile(),
              fromShip: botShipName,
              toShip: effectiveOwnerShip,
              text: warningMsg,
            }).catch((err) =>
              runtime.error?.(
                `[tlon] Failed to send security warning to owner: ${err}`
              )
            );
          }
        }
        senders.add(senderShip);
      }

      const senderRole = isOwner(senderShip) ? 'owner' : 'user';
      if (senderRole === 'owner') {
        const currentLens = contextLenses.get(lens.lensId);
        contextLenses.update(lens.lensId, {
          tools: {
            ownerOnlyAvailable: ['tlon', 'cron', 'read'],
            called: currentLens?.tools.called ?? [],
            callCount: currentLens?.tools.callCount ?? 0,
            lastStartedAt: currentLens?.tools.lastStartedAt ?? null,
            runs: currentLens?.tools.runs ?? [],
          },
        });
      }
      // Store role for before_tool_call hook (tool access control)
      for (const sessionKey of lensSessionKeys) {
        setSessionRole(sessionKey, senderRole);
      }
      runtime.log?.(
        `[tlon] Stored session role: sessionKeys=${lensSessionKeys.join(', ')}, role=${senderRole}`
      );

      const senderDisplay = formatShipWithNickname(senderShip);
      const fromLabel = isGroup
        ? `${senderDisplay} [${senderRole}] in ${channelNest}`
        : `${senderDisplay} [${senderRole}]`;
      const attachmentCount = attachments.length;

      // Compute command authorization for slash commands (owner-only)
      const shouldComputeAuth =
        core.channel.commands.shouldComputeCommandAuthorized(messageText, cfg);
      let commandAuthorized = false;

      if (shouldComputeAuth) {
        const useAccessGroups = cfg.commands?.useAccessGroups !== false;
        const senderIsOwner = isOwner(senderShip);

        commandAuthorized =
          core.channel.commands.resolveCommandAuthorizedFromAuthorizers({
            useAccessGroups,
            authorizers: [
              {
                configured: Boolean(effectiveOwnerShip),
                allowed: senderIsOwner,
              },
            ],
          });

        // Log when non-owner attempts a slash command (will be silently ignored by Gateway)
        if (!commandAuthorized) {
          console.log(
            `[tlon] Command attempt denied: ${senderShip} is not owner (owner=${effectiveOwnerShip ?? 'not configured'})`
          );
        }
      }

      // Bot mention was already stripped early (before thread context), so use messageText directly
      // Prepend attachment annotations to message body (similar to Signal format)
      let bodyWithAttachments = messageText;
      if (attachments.length > 0) {
        const mediaLines = attachments
          .map(
            (a) => `[media attached: ${a.path} (${a.contentType}) | ${a.path}]`
          )
          .join('\n');
        bodyWithAttachments = mediaLines + '\n' + messageText;
      }

      // For group messages, add a hint about how to query members (avoids injecting full list)
      if (isGroup && channelNest) {
        const groupFlag = channelToGroup.get(channelNest);
        if (groupFlag) {
          bodyWithAttachments += `\n[Group members available via: tlon groups info ${groupFlag}]`;
          contextLenses.recordContextSource(lens.lensId, {
            kind: 'system',
            label: 'Group member lookup hint',
            sourceId: groupFlag,
            included: true,
            reason: 'member list available through tlon tool, not injected raw',
          });
        }
      }

      const body = core.channel.reply.formatAgentEnvelope({
        channel: 'Tlon',
        from: fromLabel,
        timestamp,
        body: bodyWithAttachments,
      });

      // Use raw text (no thread context) for command detection so "/status" is recognized
      const commandBody = isGroup
        ? stripBotMentionOutsidePlaceholders(rawMessageText, botShipName)
        : rawMessageText;

      const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: body,
        BodyForAgent: bodyWithAttachments,
        RawBody: messageText,
        CommandBody: commandBody,
        From: isGroup ? `tlon:group:${groupChannel}` : `tlon:${senderShip}`,
        To: `tlon:${botShipName}`,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        ChatType: isGroup ? 'group' : 'direct',
        ConversationLabel: fromLabel,
        SenderName: senderShip,
        SenderId: senderShip,
        SenderRole: senderRole,
        CommandAuthorized: commandAuthorized,
        CommandSource: 'text' as const,
        Provider: 'tlon',
        Surface: 'tlon',
        MessageSid: messageId,
        // Include downloaded media attachments (MediaPaths/MediaUrls/MediaTypes for OpenClaw media pipeline)
        ...(attachments.length > 0 && {
          MediaPaths: attachments.map((a) => a.path),
          MediaUrls: attachments.map((a) => a.path),
          MediaTypes: attachments.map((a) => a.contentType),
        }),
        OriginatingChannel: 'tlon',
        OriginatingTo: `tlon:${isGroup ? groupChannel : senderShip}`,
        // Include thread context for automatic reply routing
        ...(parentId && {
          MessageThreadId: String(parentId),
          ReplyToId: String(parentId),
        }),
      });

      // ── Durable session-route persistence ───────────────────────
      // The streamed reply below goes out through our own `deliver` callback
      // and does not consult session metadata. But later route-dependent sends
      // (the shared `message` tool, subagents, system-event turns) resolve
      // their destination from the session store; without a persisted Tlon
      // route they fall back to webchat. recordTlonRouteAndDispatch (below)
      // runs the turn through the SDK's prepared channel-turn kernel, which
      // records the route before dispatch; persistence fails open — never
      // blocks the reply.
      const routeDebug: ((rec: TlonInboundRouteRecord) => void) | undefined =
        isRouteDebugEnabled()
          ? (rec) =>
              runtime.log?.(
                `[tlon][route-debug] inbound ${JSON.stringify({
                  messageId,
                  agentId: route.agentId,
                  sessionKey: route.sessionKey,
                  mainSessionKey: route.mainSessionKey,
                  lastRoutePolicy: route.lastRoutePolicy,
                  matchedBy: route.matchedBy,
                  provider: ctxPayload.Provider,
                  surface: ctxPayload.Surface,
                  originatingChannel: ctxPayload.OriginatingChannel,
                  originatingTo: ctxPayload.OriginatingTo,
                  ctxSessionKey: ctxPayload.SessionKey,
                  isGroup,
                  groupChannel: groupChannel ?? null,
                  senderShip,
                  parentId: parentId ?? null,
                  deliverParentId: deliverParentId ?? null,
                  recordSessionKey: rec.recordSessionKey,
                  lastRouteSessionKey: rec.lastRouteSessionKey,
                  target: rec.target,
                  hadUpdateLastRoute: Boolean(rec.updateLastRoute),
                  pinWillSkip: routeUpdateWillSkipByPin(rec.updateLastRoute),
                  skippedReason: rec.skippedReason ?? null,
                })}`
              )
          : undefined;

      const dispatchStartTime = Date.now();
      const dispatchTimeoutMs = normalizeRunTimeoutMs(
        account.lifecycle.runTimeoutMs
      );
      const runId = randomUUID();
      const turnRecorder = startTlonAgentTurn({
        accountId: account.accountId,
        agentId: route.agentId,
        destinationKind: isGroup ? 'group_channel' : 'dm',
        runId,
        sessionKey: route.sessionKey,
        ship: botShipName,
        trigger,
      });
      const replyTelemetry = telemetry?.startReply({
        sessionKey: route.sessionKey,
        runId,
        accountId: account.accountId,
        agentId: route.agentId,
        ownerShip: effectiveOwnerShip,
        botShip: botShipName,
        chatType: isGroup ? 'groupChannel' : 'dm',
        destinationKind: isGroup ? 'groupChannel' : 'dm',
        isThreadReply: Boolean(isThreadReply),
        senderRole,
        attachmentCount,
      });
      let selectedProvider: string | null = null;
      let selectedModel: string | null = null;
      let selectedThinkLevel: string | null = null;
      let deliveredMessageCount = 0;
      let sendAttemptCount = 0;
      let sendErrorCount = 0;
      let sendErrorKind: string | null = null;
      let replyCharCount = 0;
      let replyWordCount = 0;
      let replyMediaCount = 0;
      let dispatchTimedOut = false;
      const dispatchAbortController = new AbortController();
      const abortFromMonitor = () => {
        if (!dispatchAbortController.signal.aborted) {
          dispatchAbortController.abort(
            opts.abortSignal?.reason ?? new Error('Tlon monitor aborted')
          );
        }
      };
      opts.abortSignal?.addEventListener('abort', abortFromMonitor, {
        once: true,
      });
      let deliverySkipReason: TlonDeliverySkipReason | null = null;
      const recordDeliverySkip = (reason: TlonDeliverySkipReason) => {
        deliverySkipReason ??= reason;
      };

      const responsePrefix = core.channel.reply.resolveEffectiveMessagesConfig(
        cfg,
        route.agentId
      ).responsePrefix;
      const humanDelay = core.channel.reply.resolveHumanDelayConfig(
        cfg,
        route.agentId
      );
      const presenceConversationId = isGroup
        ? groupChannel ?? null
        : senderShip;
      const presenceRunId = String(messageId);

      const typingCallbacks = presenceConversationId
        ? createTypingCallbacks({
            start: () => {
              computingPresence.refreshRun({
                conversationId: presenceConversationId,
                runId: presenceRunId,
              });
              return Promise.resolve();
            },
            stop: () => {
              computingPresence.stopRun({
                conversationId: presenceConversationId,
                runId: presenceRunId,
              });
              return Promise.resolve();
            },
            onStartError: (err: unknown) => {
              runtime.error?.(
                `[tlon] Failed to enqueue computing presence for ${presenceConversationId}: ${
                  err instanceof Error ? err.stack ?? err.message : String(err)
                }`
              );
            },
            onStopError: (err: unknown) => {
              runtime.error?.(
                `[tlon] Failed to enqueue computing presence stop for ${presenceConversationId}: ${
                  err instanceof Error ? err.stack ?? err.message : String(err)
                }`
              );
            },
            keepaliveIntervalMs: 20_000,
            // The SDK default TTL (60s) fires stopRun mid-dispatch and seals the
            // callbacks, killing the thinking indicator for the rest of long
            // runs. stopRun is already wired to deliver/idle/cleanup.
            maxDurationMs: 0,
          })
        : undefined;

      const sourceReplyDeliveryMode = resolveTlonSourceReplyDeliveryMode({
        isGroup,
        messages: cfg.messages,
      });

      const replyOptions: NonNullable<
        Parameters<
          typeof core.channel.reply.dispatchReplyWithBufferedBlockDispatcher
        >[0]['replyOptions']
      > = {
        abortSignal: dispatchAbortController.signal,
        ...(sourceReplyDeliveryMode ? { sourceReplyDeliveryMode } : {}),
        timeoutOverrideSeconds: Math.ceil(dispatchTimeoutMs / 1000),
        runId,
        onModelSelected: ({ provider, model, thinkLevel }) => {
          selectedProvider = provider;
          selectedModel = model;
          selectedThinkLevel = thinkLevel ?? null;
          contextLenses.update(lens.lensId, {
            provider,
            model,
          });
          logContextLens(lens.lensId, 'model_selected');
        },
        onAssistantMessageStart: () => {
          if (presenceConversationId) {
            computingPresence.clearToolCalls({
              conversationId: presenceConversationId,
              runId: presenceRunId,
            });
          }
        },
        onToolStart: (payload) => {
          const toolName = payload.name ?? 'unknown';
          if (presenceConversationId) {
            computingPresence.addToolCall({
              conversationId: presenceConversationId,
              runId: presenceRunId,
              toolName,
            });
          }
        },
      };

      let dispatchResult:
        | {
            queuedFinal: boolean;
            counts: Record<string, number>;
            failedCounts?: Partial<Record<string, number>>;
            sourceReplyDeliveryMode?: string;
            beforeAgentRunBlocked?: boolean;
          }
        | undefined;
      let dispatchError: unknown;
      let turnSummary: TlonAgentTurnSummary | undefined;

      try {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        try {
          contextLenses.setStatus(lens.lensId, 'dispatching');
          contextLenses.recordLifecycle(lens.lensId, {
            dispatchStartedAt: Date.now(),
            timeoutMs: dispatchTimeoutMs,
          });
          bindContextLensToSession(lensSessionKeys, contextLenses, lens.lensId);
          logContextLens(lens.lensId, 'dispatching');
          timeoutId = setTimeout(() => {
            dispatchTimedOut = true;
            if (!dispatchAbortController.signal.aborted) {
              dispatchAbortController.abort(
                new Error(
                  `Tlon dispatch timed out after ${dispatchTimeoutMs}ms`
                )
              );
            }
          }, dispatchTimeoutMs);
          dispatchResult = await recordTlonRouteAndDispatch({
            session: core.channel.session,
            cfg,
            route,
            ctxPayload,
            ctxSessionKey: ctxPayload.SessionKey,
            isGroup,
            groupChannel,
            senderShip,
            parentId,
            deliverParentId,
            effectiveOwnerShip,
            effectiveDmAllowlist,
            messageId,
            sessionStore: cfg.session?.store,
            logError: (msg) => runtime.error?.(msg),
            // Routine skip / pin-skip diagnostics are debug-gated to avoid
            // high-volume logs for expected policy cases.
            logDebug: isRouteDebugEnabled()
              ? (msg) => runtime.log?.(msg)
              : undefined,
            onRecord: routeDebug,
            dispatch: () =>
              turnRecorder.run(async () => {
                let activeDispatchError: unknown;
                let activeSourceReplyDeliveryMode: string | null = null;
                try {
                  return await core.channel.reply
                    .dispatchReplyWithBufferedBlockDispatcher({
                      ctx: ctxPayload,
                      cfg,
                      replyOptions,
                      dispatcherOptions: {
                        responsePrefix,
                        humanDelay,
                        typingCallbacks,
                        onSkip: (_payload, info) => {
                          recordDeliverySkip(info.reason);
                        },
                        deliver: async (payload: ReplyPayload, info) => {
                          contextLenses.setStatus(lens.lensId, 'delivering');
                          const blob = getReplyBlob(payload);
                          let replyText = payload.text ?? '';
                          if (!replyText && !blob) {
                            const hasMedia = Array.isArray(payload.mediaUrls)
                              ? payload.mediaUrls.length > 0
                              : Boolean(payload.mediaUrl);
                            recordDeliverySkip(
                              hasMedia
                                ? 'media_only_payload_not_sent'
                                : 'empty_payload_text'
                            );
                            return;
                          }

                          // Process any block directives in the response (strips them from text)
                          if (replyText) {
                            replyText = await processBlockDirectives(
                              replyText,
                              senderShip
                            );
                          }
                          if (!replyText && !blob) {
                            recordDeliverySkip('block_directive_only');
                            return;
                          } // Response was only a directive
                          recordActiveTlonTurnSourceReply({
                            isError: payload.isError === true,
                            kind: info.kind,
                          });

                          // Use settings store value if set, otherwise fall back to file config
                          const showSignature = effectiveShowModelSig;
                          if (showSignature && replyText) {
                            const modelCfg = cfg.agents?.defaults?.model;
                            const modelInfo =
                              selectedModel ||
                              (payload as { metadata?: { model?: string } })
                                .metadata?.model ||
                              (payload as { model?: string }).model ||
                              (route as { model?: string }).model ||
                              (typeof modelCfg === 'string'
                                ? modelCfg
                                : modelCfg?.primary);
                            replyText = `${replyText}\n\n_[Generated by ${formatModelName(modelInfo)}]_`;
                          }

                          // Add addendum if this is the last response before bot rate limit
                          if (
                            isGroup &&
                            groupChannel &&
                            knownBotShips.has(senderShip)
                          ) {
                            const count =
                              consecutiveBotMessages.get(groupChannel) ?? 0;
                            if (
                              maxBotResponses > 0 &&
                              count === maxBotResponses
                            ) {
                              const otherBot =
                                formatShipWithNickname(senderShip);
                              replyText += `\n\n---\n_This is my last response to ${otherBot} for now. To continue our conversation, someone will need to mention me._`;
                            }
                          }

                          if (isRouteDebugEnabled()) {
                            runtime.log?.(
                              `[tlon][route-debug] deliver ${JSON.stringify({
                                messageId,
                                isGroup,
                                destination: isGroup
                                  ? groupChannel ?? null
                                  : senderShip,
                                deliverParentId: deliverParentId ?? null,
                              })}`
                            );
                          }

                          sendAttemptCount += 1;
                          let outputMessageId: string | null = null;
                          const replyBlob = combineBlobFields(
                            blob,
                            buildContextLensReferenceBlobField(lens.lensId)
                          );
                          if (isGroup && groupChannel) {
                            // Send to any channel type (chat, heap, diary) using the nest directly
                            const result = await observeActiveTlonTurnDelivery(
                              () =>
                                postToChannel(groupChannel, replyText, {
                                  replyToId: deliverParentId ?? undefined,
                                  blob: replyBlob,
                                })
                            );
                            outputMessageId = result.messageId;
                            // Track thread participation for future replies without mention
                            if (deliverParentId) {
                              participatedThreads.add(String(deliverParentId));
                              runtime.log?.(
                                `[tlon] Now tracking thread for future replies: ${deliverParentId}`
                              );
                            }
                          } else {
                            const result = await observeActiveTlonTurnDelivery(
                              () =>
                                sendDm({
                                  botProfile: getBotProfile(),
                                  fromShip: botShipName,
                                  toShip: senderShip,
                                  text: replyText,
                                  replyToId: deliverParentId
                                    ? String(deliverParentId)
                                    : undefined,
                                  blob: replyBlob,
                                })
                            );
                            outputMessageId = result.messageId;
                          }

                          deliveredMessageCount += 1;
                          contextLenses.recordPersistence(lens.lensId, {
                            postsReply: true,
                          });
                          recordSentTlonReply({
                            botShipName,
                            contextLenses,
                            deliveredMessageCount,
                            groupChannel,
                            isGroup,
                            lensId: lens.lensId,
                            outputMessageId,
                            replyBlob,
                            replyPreview: previewText(replyText),
                            replyText,
                            senderShip,
                          });
                          contextLenses.recordPersistenceEvent(lens.lensId, {
                            kind: 'conversation_state',
                            action: 'created',
                            location: 'urbit',
                            status: 'ok',
                            key: 'reply',
                            reason: 'posted bot response',
                          });
                          replyCharCount += replyText.length;
                          replyWordCount += replyText.trim()
                            ? replyText.trim().split(/\s+/).length
                            : 0;
                          replyMediaCount += Array.isArray(payload.mediaUrls)
                            ? payload.mediaUrls.length
                            : payload.mediaUrl
                              ? 1
                              : 0;

                          if (presenceConversationId) {
                            computingPresence.stopRun({
                              conversationId: presenceConversationId,
                              runId: presenceRunId,
                            });
                          }
                        },
                        onError: (err, info) => {
                          const dispatchDuration =
                            Date.now() - dispatchStartTime;
                          sendErrorCount += 1;
                          sendErrorKind = info.kind;
                          runtime.error?.(
                            `[tlon] ${info.kind} reply failed after ${dispatchDuration}ms: ${String(err)}`
                          );
                        },
                      },
                    })
                    .then((result) => {
                      activeSourceReplyDeliveryMode =
                        result.sourceReplyDeliveryMode ?? null;
                      return result;
                    });
                } catch (error) {
                  activeDispatchError = error;
                  throw error;
                } finally {
                  turnSummary = turnRecorder.finalize({
                    cancelled:
                      !dispatchTimedOut && Boolean(opts.abortSignal?.aborted),
                    deliverySkipReason,
                    dispatchError: activeDispatchError,
                    durationMs: Date.now() - dispatchStartTime,
                    // Core suppresses message-tool-only source replies before
                    // dispatcher callbacks, so the returned policy mode is the
                    // only plugin-visible stopgap signal.
                    sourceReplyDeliveryMode: activeSourceReplyDeliveryMode,
                    timedOut: dispatchTimedOut,
                  });
                }
              }),
          });
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      } catch (error) {
        dispatchError = error;
        if (dispatchTimedOut) {
          contextLenses.setStatus(lens.lensId, 'timed_out', error);
        } else {
          contextLenses.setStatus(lens.lensId, 'error', error);
          throw error;
        }
      } finally {
        opts.abortSignal?.removeEventListener('abort', abortFromMonitor);
        const dispatchDurationMs = Date.now() - dispatchStartTime;
        contextLenses.completeOpenToolRuns(
          lens.lensId,
          dispatchError ? 'error' : 'completed',
          dispatchError
        );
        unbindContextLensFromSession(lensSessionKeys, lens.lensId);
        // A reply the model issued by calling the `message` tool itself lands
        // through the outbound adapter, which records it on the lens but never
        // touches this closure's `deliveredMessageCount`. Count the lens's own
        // recorded outputs so a tool-only answer isn't finalized as no_reply.
        const recordedOutputCount =
          contextLenses.get(lens.lensId)?.outputs.length ?? 0;
        const effectiveDeliveredCount = Math.max(
          deliveredMessageCount,
          recordedOutputCount
        );
        turnSummary ??= turnRecorder.finalize({
          cancelled: !dispatchTimedOut && Boolean(opts.abortSignal?.aborted),
          deliverySkipReason,
          dispatchError,
          durationMs: dispatchDurationMs,
          sourceReplyDeliveryMode:
            dispatchResult?.sourceReplyDeliveryMode ?? null,
          timedOut: dispatchTimedOut,
        });
        contextLenses.recordLifecycle(lens.lensId, {
          completedAt: Date.now(),
          durationMs: dispatchDurationMs,
          timedOut: dispatchTimedOut,
          deliveredMessageCount: effectiveDeliveredCount,
          queuedFinal: dispatchResult?.queuedFinal ?? false,
          queuedFinalCount: dispatchResult?.counts.final ?? 0,
          queuedBlockCount: dispatchResult?.counts.block ?? 0,
        });
        await replyTelemetry?.capture({
          sendAttemptCount,
          sendErrorCount,
          sendErrorKind,
          deliveredMessageCount: effectiveDeliveredCount,
          replyCharCount,
          replyWordCount,
          replyMediaCount,
          dispatchDurationMs,
          queuedFinal: dispatchResult?.queuedFinal ?? false,
          queuedFinalCount: dispatchResult?.counts.final ?? 0,
          queuedBlockCount: dispatchResult?.counts.block ?? 0,
          failedCounts: dispatchResult?.failedCounts,
          deliverySkipReason,
          sourceReplyDeliveryMode:
            dispatchResult?.sourceReplyDeliveryMode ?? null,
          beforeAgentRunBlocked: dispatchResult?.beforeAgentRunBlocked === true,
          provider: selectedProvider,
          model: selectedModel,
          thinkLevel: selectedThinkLevel,
          turnSummary,
          dispatchError,
        });
        if (!dispatchError) {
          contextLenses.setStatus(
            lens.lensId,
            effectiveDeliveredCount > 0 ? 'completed' : 'no_reply'
          );
        }
        const finalLens = contextLenses.get(lens.lensId);
        if (finalLens) {
          logContextLens(lens.lensId, 'final');
        }
      }
    };

    // Track which channels we're interested in for filtering firehose events
    const watchedChannels = new Set<string>(groupChannels);
    const _watchedDMs = new Set<string>();

    // Firehose handler for all channel messages (/v4)
    const handleChannelsFirehose = async (event: ChannelFirehoseEvent) => {
      try {
        const nest = event?.nest;

        if (!nest) {
          return;
        }

        // Auto-watch channels from firehose: if we receive events for a channel,
        // the bot is a member of the group — add it to watchedChannels automatically.
        if (
          !watchedChannels.has(nest) &&
          (nest.startsWith('chat/') ||
            nest.startsWith('heap/') ||
            nest.startsWith('diary/'))
        ) {
          watchedChannels.add(nest);
          runtime.log?.(`[tlon] Auto-watching channel from firehose: ${nest}`);
        }

        // Only process channels we're watching
        if (!watchedChannels.has(nest)) {
          return;
        }

        const response = event?.response;
        if (!response) {
          return;
        }

        // Handle reaction events (top-level posts)
        const reacts = response?.post?.['r-post']?.reacts;
        // Handle reaction events (replies/comments)
        const replyReacts =
          response?.post?.['r-post']?.reply?.['r-reply']?.reacts;
        const effectiveReacts = reacts || replyReacts;
        if (effectiveReacts && typeof effectiveReacts === 'object') {
          const rootPostId = replyReacts ? response?.post?.id : undefined;
          const postId = replyReacts
            ? response?.post?.['r-post']?.reply?.id ??
              response?.post?.id ??
              'unknown'
            : response?.post?.id ?? 'unknown';
          await processChannelReactionSnapshot({
            botShip: botShipName,
            reactions: effectiveReacts as Record<string, string>,
            postId,
            rootPostId,
            normalizeShip,
            // Every reactor in this snapshot reacted to the same target. Resolve
            // it once so a missing/deleted target cannot retry its scry per reactor.
            resolveTarget: (targetPostId, targetRootPostId) =>
              lookupOrFetchCachedChannelMessage(
                api,
                nest,
                targetPostId,
                targetRootPostId,
                runtime
              ),
            handleReaction: async ({
              emoji: reactEmoji,
              reactor: ship,
              target: reactionTarget,
            }) => {
              try {
                const route = core.channel.routing.resolveAgentRoute({
                  cfg,
                  channel: 'tlon',
                  accountId: opts.accountId ?? undefined,
                  peer: { kind: 'group', id: nest },
                });
                await handleChannelReaction({
                  botShip: botShipName,
                  emoji: reactEmoji,
                  formatShip: formatShipWithNickname,
                  nest,
                  postId,
                  reactor: ship,
                  rootPostId,
                  target: reactionTarget,
                  log: (message) => runtime.log?.(message),
                  // If reacting to the bot's own message, dispatch as a real
                  // message so the agent runs immediately (e.g. thumbs-up as
                  // "yes"). Omit thread context to avoid the agent suppressing
                  // responses to its own message, but preserve the reply parent
                  // for delivery.
                  dispatchAgent: async ({ messageText, replyParentId }) => {
                    runtime.log?.(
                      `[tlon] Dispatching channel reaction as message: ${reactEmoji} from ${ship}`
                    );
                    const parsed = parseChannelNest(nest);
                    await processMessage({
                      messageId: `react-${postId}-${ship}-${Date.now()}`,
                      senderShip: ship,
                      messageText,
                      trigger: 'reaction',
                      cachesHistory: true,
                      isGroup: true,
                      channelNest: nest,
                      hostShip: parsed?.hostShip,
                      channelName: parsed?.channelName,
                      timestamp: Date.now(),
                      replyParentId, // Thread reply for delivery only
                    });
                  },
                  // Reactions on other people's messages are passive system
                  // events, including targets whose author cannot be resolved.
                  enqueueSystemEvent: (eventText) => {
                    core.system.enqueueSystemEvent(eventText, {
                      sessionKey: route.sessionKey,
                      contextKey: `tlon:reaction:${nest}:${postId}:${reactEmoji}:${ship}`,
                      // Route any resulting system/heartbeat turn back to Tlon.
                      deliveryContext: tlonDeliveryContext(
                        `tlon:${nest}`,
                        route.accountId
                      ),
                    });
                  },
                });
              } catch (err: any) {
                runtime.error?.(
                  `[tlon] Error handling reaction: ${err?.message ?? String(err)}`
                );
              }
            },
          });
          return;
        }

        // Handle post responses (new posts and replies)
        const essay = response?.post?.['r-post']?.set?.essay;
        const replyEssay =
          response?.post?.['r-post']?.reply?.['r-reply']?.set?.['reply-essay'];

        const content = replyEssay || essay;
        if (!content) {
          return;
        }

        const isThreadReply = Boolean(replyEssay);
        const messageId = isThreadReply
          ? response?.post?.['r-post']?.reply?.id
          : response?.post?.id;

        if (!processedTracker.mark(messageId)) {
          return;
        }

        const senderShip = normalizeShip(extractAuthorShip(content?.author));
        if (!senderShip) {
          return;
        }

        const { rawText, engagementText, mentioned } = prepareInboundText(
          content.content,
          botShipName,
          botNickname ?? undefined
        );
        const hasBlob = Boolean(content.blob);
        if (!rawText.trim() && !hasBlob) {
          return;
        }

        // Cache ALL messages (including bot's own) so reaction lookups have context
        cacheMessage(nest, {
          author: senderShip,
          content: rawText,
          timestamp: content.sent || Date.now(),
          id: messageId,
          blob: content.blob ?? null,
        });

        // Check if sender is a bot (BotProfile object has ship, nickname, avatar)
        const authorRaw = content?.author;
        const isSenderBot =
          typeof authorRaw === 'object' &&
          authorRaw !== null &&
          'ship' in authorRaw;
        if (isSenderBot) {
          knownBotShips.add(senderShip);
        }

        // Skip processing bot's own messages (but they're already cached above)
        if (senderShip === botShipName) {
          return;
        }

        // Check if sender is a known bot (for rate limiting later)
        const isKnownBot = isSenderBot || knownBotShips.has(senderShip);

        // Get thread info early for participation check
        const seal = isThreadReply
          ? response?.post?.['r-post']?.reply?.['r-reply']?.set?.seal
          : response?.post?.['r-post']?.set?.seal;
        const parentId = seal?.['parent-id'] || seal?.parent || null;
        const parsedDispatchNest = parseChannelNest(nest);

        // Control-plane escape hatch: owner-listen may be disabled, but the owner
        // still needs a no-mention way to turn it back on from the same owned
        // channel. Handle the exact slash command before the normal engagement
        // gate, without waking the agent/model for ordinary chatter.
        if (
          isOwnerListenSlashCommand(rawText) &&
          isOwner(senderShip) &&
          parsedDispatchNest &&
          (parsedDispatchNest.hostShip === effectiveOwnerShip ||
            parsedDispatchNest.hostShip === botShipName)
        ) {
          const args = rawText
            .trim()
            .replace(/^\/owner-listen(?:\s+|$)/i, '')
            .trim();
          const replyText = await handleOwnerListenCommand(
            commandBridge,
            args,
            `tlon:group:${nest}`
          );
          await postToChannel(nest, replyText, {
            replyToId: parentId ?? undefined,
          });
          return;
        }

        // Check if we should respond:
        // 1. Direct mention always triggers response
        // 2. Thread replies where we've participated - respond if relevant (let agent decide)
        // 3. Owner blob-only message (image/file with no text from owner)
        // 4. Owner-listen: owner posts in an owner/bot-hosted channel and the
        //    channel is not in the per-channel disabled list
        const inParticipatedThread = Boolean(
          isThreadReply && parentId && participatedThreads.has(parentId)
        );
        const isOwnerBlob = hasBlob && isOwner(senderShip);
        const engageDecision = shouldEngageInGroup({
          mentioned,
          inParticipatedThread,
          isOwnerBlob,
          senderShip,
          ownerShip: effectiveOwnerShip,
          botShipName,
          channelNest: nest,
          groupHost: parsedDispatchNest?.hostShip ?? null,
          ownerListenEnabled: effectiveOwnerListenEnabled,
          ownerListenDisabledChannels: effectiveOwnerListenDisabled,
        });
        if (!engageDecision.engage) {
          // Replies to the bot's own onboarding UI still count: a purpose
          // card tap, the topics-pills submission, and the answers a setup
          // directive's build asks for arrive as unmentioned top-level owner
          // messages, so an owner who switched listening off would otherwise
          // see cards whose buttons do nothing. Each admitted shape is a
          // *provable* reply to something the bot posted — the mute contract
          // ("a plain post in a muted channel never wakes the bot", pinned
          // by the shared e2e even when an unanswered picker sits in the
          // channel) stays intact for everything else. That means the
          // picker's free-text path needs a mention while listening is off;
          // mentions always override, so the escape hatch is one word.
          //
          // Only top-level owner text is ever a setup reply — thread replies
          // and attachment-only posts stay dropped.
          if (
            !isOwner(senderShip) ||
            isThreadReply ||
            parentId ||
            !rawText?.trim()
          ) {
            return;
          }
          // The mid-onboarding records are in-memory, so after a restart
          // they are empty and this gate would drop the very reply the
          // picker is waiting for. Rebuild them from the transcript first —
          // once per channel. Retried in place on a transient scry failure:
          // this message is already consumed (no redelivery exists), so an
          // inconclusive scan here would discard a real picker answer for
          // good. Two short retries cover the transient case; past them the
          // drop below is the least-bad option, and the scan stays unburned
          // for the next message.
          if (
            !onboardingSetupPending.has(nest) &&
            !onboardingInvitePending.has(nest) &&
            !onboardingPickerOffered.has(nest)
          ) {
            let recovery = await recoverOnboardingState(
              nest,
              senderShip,
              rawText ?? ''
            );
            for (
              let attempt = 0;
              recovery === 'inconclusive' && attempt < 2;
              attempt += 1
            ) {
              await new Promise((resolve) => setTimeout(resolve, 1_000));
              recovery = await recoverOnboardingState(
                nest,
                senderShip,
                rawText ?? ''
              );
            }
            if (recovery === 'inconclusive') {
              runtime.log?.(
                `[tlon] Dropping a muted-channel message in ${nest} with onboarding state unknown — recovery scries kept failing`
              );
            }
          }
          const isOnboardingReply =
            // The topics pills await their answer.
            onboardingSetupPending.has(nest) ||
            // A directive was issued and the build is mid-flight — the owner
            // already engaged the onboarding UI, and the bot may be waiting
            // on an answer it asked for (a timezone, a first entry).
            onboardingInvitePending.has(nest) ||
            // A tap on the purpose picker posts exactly a card title.
            (onboardingPickerOffered.has(nest) &&
              isPurposePickerChoice(rawText ?? ''));
          if (!isOnboardingReply) {
            return;
          }
        }

        // Agent onboarding: in an unconfigured group the owner hosts, the
        // owner's messages drive two one-shot offers — the tappable purpose
        // picker for the first message, then the topic pills after a card
        // tap. Tapping posts the choice as the owner's own reply, which
        // falls through to the agent normally. One group lookup serves both;
        // when it fails (new group, or scry failed) say nothing rather than
        // risk offering setup for a configured group — retried next message.
        // A thread reply or an attachment-only post is never an answer to a
        // picker and must never be answered *by* one: offering the opening in
        // response to a blob post would swallow that post entirely.
        const isTopLevelTextMessage =
          !isThreadReply && !parentId && Boolean(rawText?.trim());
        const runOnboardingOffers =
          isOwner(senderShip) &&
          isTopLevelTextMessage &&
          !(
            onboardingPickerOffered.has(nest) &&
            onboardingTopicsOffered.has(nest)
          );
        const onboardingGroup = runOnboardingOffers
          ? await findGroupForChannel(api, nest, runtime)
          : null;
        const onboardingOffer = onboardingGroup && {
          senderIsOwner: true,
          groupHostIsOwner: onboardingGroup.host === effectiveOwnerShip,
          groupDescription: onboardingGroup.description,
          messageText: rawText ?? '',
          alreadyOffered: false,
        };
        if (onboardingOffer && !onboardingPickerOffered.has(nest)) {
          // Restart recovery (shared with the owner-listen gate above): a
          // process restart between posting a picker and the owner's reply
          // loses the in-memory state — and, left alone, this block would
          // re-offer the purpose picker on top of the answered one.
          // Retried like the muted gate: this message is already consumed
          // (no redelivery exists), and if it is the topics reply the
          // picker is waiting for, processing it with unknown state feeds
          // it to the model as ordinary chat and the setup directive is
          // never built.
          let recovery = await recoverOnboardingState(
            nest,
            senderShip,
            rawText ?? '',
            onboardingGroup
          );
          for (
            let attempt = 0;
            recovery === 'inconclusive' && attempt < 2;
            attempt += 1
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1_000));
            recovery = await recoverOnboardingState(
              nest,
              senderShip,
              rawText ?? '',
              onboardingGroup
            );
          }
          if (onboardingSetupPending.has(nest)) {
            // Recovered above: fall through so the reply in hand is consumed
            // as the topics answer.
          } else if (recovery === 'inconclusive') {
            // Still unknown after the retries. Processing could consume a
            // real topics answer for good; a dropped ordinary message just
            // gets re-sent. Same least-bad trade the muted gate makes, and
            // the scan stays unburned for the next message.
            runtime.log?.(
              `[tlon] Dropping a message in ${nest} with onboarding state unknown — recovery scries kept failing`
            );
            return;
          } else if (
            !onboardingPickerOffered.has(nest) &&
            shouldOfferPurposePicker(onboardingOffer)
          ) {
            onboardingPickerOffered.add(nest);
            runtime.log?.(
              `[tlon] Offering agent onboarding purpose picker in ${nest}`
            );
            try {
              await postOnboardingOpening(nest);
              return;
            } catch (error) {
              onboardingPickerOffered.delete(nest);
              runtime.error?.(
                `[tlon] Failed to post purpose picker in ${nest}: ${String(error)}`
              );
            }
          } else {
            // Configured, or the message is a card tap — don't re-offer.
            onboardingPickerOffered.add(nest);
          }
        }

        // Follow a purpose pick with the topic pills, so the subject question
        // is tappable too. Submitting them posts one message with the chosen
        // labels, which falls through to a normal model turn that does the
        // building.
        if (onboardingOffer && !onboardingTopicsOffered.has(nest)) {
          const topicsPurposeId = shouldOfferTopicsPicker(onboardingOffer);
          if (topicsPurposeId) {
            onboardingTopicsOffered.add(nest);
            onboardingSetupPending.set(nest, topicsPurposeId);
            runtime.log?.(
              `[tlon] Offering agent onboarding topics picker in ${nest}`
            );
            try {
              const topicsBlob = buildTopicsPickerBlob(nest, topicsPurposeId);
              await postToChannel(
                nest,
                topicsPickerFallbackText(topicsPurposeId),
                {
                  ...(topicsBlob
                    ? { blob: serializeBlobField(topicsBlob) }
                    : {}),
                }
              );
              return;
            } catch (error) {
              onboardingTopicsOffered.delete(nest);
              // The pending purpose must not outlive the failed post: the
              // owner never saw the pills, so their next message is not a
              // topics reply and must not receive the setup directive.
              onboardingSetupPending.delete(nest);
              runtime.error?.(
                `[tlon] Failed to post topics picker in ${nest}: ${String(error)}`
              );
            }
          }
        }

        const trigger: ContextLensTrigger = mentioned
          ? 'mention'
          : inParticipatedThread
            ? 'thread'
            : isOwnerBlob
              ? 'owner-blob'
              : engageDecision.reason === 'owner-owned'
                ? 'owner-listen'
                : 'unknown';

        // Log why we're responding
        if (engageDecision.reason === 'owner-owned') {
          runtime.log?.(
            `[tlon] Owner ${senderShip} heard without mention in owned channel ${nest}`
          );
        } else if (isOwnerBlob && !mentioned && !inParticipatedThread) {
          runtime.log?.(
            `[tlon] Responding to owner blob-only message in ${nest}`
          );
        } else if (inParticipatedThread && !mentioned) {
          runtime.log?.(
            `[tlon] Responding to thread we participated in (no mention): ${parentId}`
          );
        }

        // Rate limit consecutive bot responses (only in group channels)
        if (isKnownBot) {
          const count = (consecutiveBotMessages.get(nest) ?? 0) + 1;
          consecutiveBotMessages.set(nest, count);
          runtime.log?.(
            `[tlon] Bot mention from ${senderShip} in ${nest}: consecutive count = ${count}`
          );

          if (maxBotResponses > 0 && count > maxBotResponses) {
            runtime.log?.(
              `[tlon] Rate limiting: skipping response to bot ${senderShip} (count ${count} > limit ${maxBotResponses})`
            );
            return;
          }
        } else {
          // Human mention resets the consecutive bot counter
          // (requires explicit engagement, not just any human message)
          consecutiveBotMessages.set(nest, 0);
          runtime.log?.(
            `[tlon] Human mention from ${senderShip} in ${nest}: reset bot counter`
          );
        }

        // Owner is always allowed
        if (isOwner(senderShip)) {
          runtime.log?.(
            `[tlon] Owner ${senderShip} is always allowed in channels`
          );
        } else {
          const { mode, allowedShips } = resolveChannelAuthorization(
            cfg,
            nest,
            currentSettings
          );
          if (isChannelRestricted(mode)) {
            const normalizedAllowed = allowedShips.map(normalizeShip);
            if (!normalizedAllowed.includes(senderShip)) {
              // If owner is configured, queue approval request
              if (effectiveOwnerShip) {
                const cachedParentAuthor = parentId
                  ? lookupCachedMessage(nest, parentId)?.author
                  : undefined;
                const parentAuthor = parentId
                  ? cachedParentAuthor && cachedParentAuthor !== 'unknown'
                    ? cachedParentAuthor
                    : await fetchParentPostAuthor(api, nest, parentId, runtime)
                  : null;
                const parentAuthorId = parentAuthor
                  ? normalizeShip(parentAuthor)
                  : undefined;
                const approval = createPendingApproval(
                  {
                    type: 'channel',
                    requestingShip: senderShip,
                    channelNest: nest,
                    messagePreview: rawText.substring(0, 100),
                    originalMessage: {
                      messageId: messageId ?? '',
                      messageText: rawText,
                      messageContent: content.content,
                      timestamp: content.sent || Date.now(),
                      parentId: parentId ?? undefined,
                      parentAuthorId,
                      isThreadReply,
                      blob: content.blob ?? undefined,
                    },
                  },
                  pendingApprovals.map((a) => a.id)
                );
                await queueApprovalRequest(approval);
              } else {
                runtime.log?.(
                  `[tlon] Access denied: ${senderShip} in ${nest} (allowed: ${allowedShips.join(', ')})`
                );
              }
              return;
            }
          }
        }

        const parsed = parseChannelNest(nest);
        const citedContent = await resolveCitedContent(content.content);
        // The owner reply after the topic pills carries the rendered setup
        // directive, so the model receives the cron payload from config
        // rather than composing one. One-shot per channel.
        let setupDirective: string | undefined;
        const pendingSetupPurpose = onboardingSetupPending.get(nest);
        // Only a top-level owner message that isn't itself a purpose title
        // answers the pills. A double-tapped card would otherwise be consumed
        // as the topics answer — building the job with "Research" as its
        // subject — and a reply the owner happened to send in another thread
        // would eat the directive the real submission needed.
        const answersTopicsPicker =
          Boolean(pendingSetupPurpose) &&
          isOwner(senderShip) &&
          !isThreadReply &&
          !parentId &&
          Boolean(rawText?.trim()) &&
          !isPurposePickerChoice(rawText ?? '');
        if (
          pendingSetupPurpose &&
          isOwner(senderShip) &&
          isTopLevelTextMessage &&
          isPurposePickerChoice(rawText ?? '')
        ) {
          // A repeated purpose-card tap while the topic pills wait. The tap
          // that counted already posted the pills; this duplicate is neither
          // a topics answer (excluded above) nor ordinary chat, and passing
          // it to the model would start a stray turn in the half-configured
          // group. Drop it.
          runtime.log?.(
            `[tlon] Dropping duplicate purpose-card tap in ${nest} while topics are pending`
          );
          return;
        }
        if (pendingSetupPurpose && answersTopicsPicker) {
          onboardingSetupPending.delete(nest);
          setupDirective =
            renderSetupDirective(pendingSetupPurpose, rawText ?? '') ??
            undefined;
        }
        // A setup that has been asked for owes an invite card once it is
        // actually finished. Recorded rather than posted here: the directive
        // turn usually only gets as far as asking a follow-up question, and
        // the build lands turns later.
        if (setupDirective) {
          onboardingInvitePending.add(nest);
        }
        if (setupDirective) {
          // Arm the tool-call-driven status lines for the build this
          // directive starts: the model works in silence, so these are the
          // owner's only sign of life for the minutes the build takes.
          try {
            const progressRoute = core.channel.routing.resolveAgentRoute({
              cfg,
              channel: 'tlon',
              accountId: opts.accountId ?? undefined,
              peer: { kind: 'group', id: nest },
            });
            if (progressRoute?.sessionKey) {
              armSetupProgress(progressRoute.sessionKey, {
                post: async (text) => {
                  await postToChannel(nest, text);
                },
                // The thinking indicator names the current step: one tool
                // at a time, so a long icon generation reads as exactly
                // that instead of an ever-growing tool list.
                presence: (toolName, label) => {
                  computingPresence.clearToolCalls({
                    conversationId: nest,
                    runId: `setup:${nest}`,
                  });
                  computingPresence.addToolCall({
                    conversationId: nest,
                    runId: `setup:${nest}`,
                    toolName,
                    label,
                  });
                },
              });
              setupProgressSessionForNest.set(nest, progressRoute.sessionKey);
            }
          } catch (error) {
            runtime.log?.(
              `[tlon] Could not arm setup progress for ${nest}: ${String(error)}`
            );
          }
          // The client grants the agent admin right after creating the
          // group; a fast owner can tap through before it lands, and a
          // setup turn without the role does its renames and
          // channel-creates as a plain member — dropped pokes, visible
          // timeouts. Wait for the seat, bounded: if it never lands
          // (self-hosted owner, older client), build anyway and let the
          // agent report honestly.
          const directiveGroup = await findGroupForChannel(api, nest, runtime);
          if (directiveGroup) {
            const adminDeadline = Date.now() + 20_000;
            while (Date.now() < adminDeadline && !opts.abortSignal?.aborted) {
              const hasSeat = await agentHasAdminSeat(
                api,
                directiveGroup.flag,
                botShipName,
                runtime
              );
              if (hasSeat) {
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 2_000));
            }
          }
        }
        let setupPresenceKeepalive: ReturnType<typeof setInterval> | null =
          null;
        if (setupDirective) {
          onboardingSetupTurnInFlight.add(nest);
          // A dedicated presence run for the build: the dispatch's own run
          // stops at its first delivery, and a minutes-long icon generation
          // would otherwise sit with no indicator at all. Kept alive for
          // exactly the turn, so the indicator never lingers while the bot
          // waits on the owner.
          const setupPresenceRun = {
            conversationId: nest,
            runId: `setup:${nest}`,
          };
          computingPresence.refreshRun(setupPresenceRun);
          setupPresenceKeepalive = setInterval(() => {
            computingPresence.refreshRun(setupPresenceRun);
          }, 20_000);
          (
            setupPresenceKeepalive as unknown as { unref?: () => void }
          ).unref?.();
        }
        try {
          await processMessage({
            messageId: messageId ?? '',
            senderShip,
            messageText: rawText,
            ...(citedContent ? { citedContent } : {}),
            ...(setupDirective ? { setupDirective } : {}),
            gateText: engagementText,
            trigger,
            cachesHistory: true,
            messageContent: content.content, // Pass raw content for media extraction
            blobField: content.blob,
            isGroup: true,
            channelNest: nest,
            hostShip: parsed?.hostShip,
            channelName: parsed?.channelName,
            timestamp: content.sent || Date.now(),
            parentId,
            isThreadReply,
          });
        } catch (dispatchError) {
          // A transient provider or tool failure must not consume the setup
          // intent: the post is already marked processed, so without this the
          // group would stay unconfigured and the next owner message would be
          // read as ordinary chat.
          if (pendingSetupPurpose) {
            onboardingSetupPending.set(nest, pendingSetupPurpose);
          }
          throw dispatchError;
        } finally {
          if (setupDirective) {
            onboardingSetupTurnInFlight.delete(nest);
            if (setupPresenceKeepalive) {
              clearInterval(setupPresenceKeepalive);
            }
            computingPresence.stopRun({
              conversationId: nest,
              runId: `setup:${nest}`,
            });
          }
        }

        // A dispatch timeout inside processMessage records itself and
        // returns without throwing, so the catch above never restores the
        // pending setup. Verify the effect instead: if the directive turn
        // posted nothing at all and the config still has no job, the setup
        // died silently — re-arm it so the owner's next message retries.
        // (If the bot said anything — a follow-up question, the build
        // announcement — the conversation is alive and re-arming would
        // wrongly consume that next answer as a topics reply.)
        if (setupDirective && pendingSetupPurpose) {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          try {
            // Inconclusive evidence must not re-arm: a failed history read
            // looks like silence, and re-arming after a turn that actually
            // asked a follow-up would consume the owner's answer as a fresh
            // topics reply — rebuilding the directive with, say, a timezone
            // as its topics.
            const after = await fetchChannelHistory(api, nest, 5, runtime, {
              throwOnError: true,
            });
            const sentAt = content.sent || 0;
            // The plugin's own status lines ("Searching the web…") don't
            // count as the bot speaking: a directive turn that died after a
            // tool call would otherwise read as alive and never re-arm.
            const botSpoke = after.some(
              (entry) =>
                entry.author === botShipName &&
                !isSetupProgressLine(entry.content) &&
                (entry.timestamp ?? 0) >= sentAt
            );
            if (!botSpoke) {
              const groupNow = await findGroupForChannel(api, nest, runtime);
              if (!descriptionHasConfiguredJob(groupNow?.description)) {
                onboardingSetupPending.set(nest, pendingSetupPurpose);
                runtime.log?.(
                  `[tlon] Setup turn in ${nest} produced no reply — re-arming the topics setup`
                );
              }
            }
          } catch (error) {
            runtime.log?.(
              `[tlon] Could not verify the setup turn in ${nest} — leaving its state as is: ${String(error)}`
            );
          }
        }

        await postInviteCardIfSetupComplete(nest);
      } catch (error: any) {
        runtime.error?.(
          `[tlon] Error handling channel firehose event: ${error?.message ?? String(error)}`
        );
      }
    };

    // Firehose handler for all DM messages (/v4)
    // Track which DM invites we've already processed to avoid duplicate accepts
    const processedDmInvites = new Set<string>();

    const handleChatFirehose = async (event: ChatFirehoseEvent) => {
      try {
        // Handle DM invite lists (arrays)
        if (Array.isArray(event)) {
          for (const invite of event) {
            const ship = normalizeShip(invite.ship || '');
            if (!ship || processedDmInvites.has(ship)) {
              continue;
            }

            // Owner is always allowed
            if (isOwner(ship)) {
              try {
                await api.poke({
                  app: 'chat',
                  mark: 'chat-dm-rsvp',
                  json: { ship, ok: true },
                });
                processedDmInvites.add(ship);
                runtime.log?.(
                  `[tlon] Auto-accepted DM invite from owner ${ship}`
                );
              } catch (err) {
                runtime.error?.(
                  `[tlon] Failed to auto-accept DM from owner: ${String(err)}`
                );
              }
              continue;
            }

            // Auto-accept if on allowlist and auto-accept is enabled
            if (
              effectiveAutoAcceptDmInvites &&
              isDmAllowed(ship, effectiveDmAllowlist)
            ) {
              try {
                await api.poke({
                  app: 'chat',
                  mark: 'chat-dm-rsvp',
                  json: { ship, ok: true },
                });
                processedDmInvites.add(ship);
                runtime.log?.(`[tlon] Auto-accepted DM invite from ${ship}`);
              } catch (err) {
                runtime.error?.(
                  `[tlon] Failed to auto-accept DM from ${ship}: ${String(err)}`
                );
              }
              continue;
            }

            // If owner is configured and ship is not on allowlist, queue approval
            if (
              effectiveOwnerShip &&
              !isDmAllowed(ship, effectiveDmAllowlist)
            ) {
              const approval = createPendingApproval(
                {
                  type: 'dm',
                  requestingShip: ship,
                  messagePreview: DM_INVITE_PREVIEW,
                },
                pendingApprovals.map((a) => a.id)
              );
              await queueApprovalRequest(approval);
              processedDmInvites.add(ship); // Mark as processed to avoid duplicate notifications
            }
          }
          return;
        }
        if (!('whom' in event) || !('response' in event)) {
          return;
        }

        const whom = event.whom; // DM partner ship or club ID
        const messageId = event.id;
        const response = event.response;

        // Handle add events (new messages)
        const essay = response?.add?.essay;
        const dmReply = response?.reply;

        // Handle DM reaction events
        const dmAddReact = response?.['add-react'];
        const dmDelReact = response?.['del-react'];
        if (dmAddReact || dmDelReact) {
          const isAdd = Boolean(dmAddReact);
          const reactData = dmAddReact || dmDelReact;
          const reactAuthor = normalizeShip(
            extractAuthorShip(reactData?.author) || reactData?.ship || ''
          );
          const reactEmoji = dmAddReact?.react ?? '';
          if (reactAuthor && reactAuthor !== botShipName) {
            // Check if this is an approval reaction from the owner on a notification message
            if (isAdd && isOwner(reactAuthor)) {
              const approvalAction = emojiToApprovalAction(reactEmoji);
              if (approvalAction) {
                const normalizedEventId = normalizeNotificationId(messageId);
                const matchedApproval = pendingApprovals.find(
                  (a) => a.notificationMessageId === normalizedEventId
                );
                if (matchedApproval) {
                  if (isExpired(matchedApproval)) {
                    runtime.log?.(
                      `[tlon] Ignoring reaction on expired approval #${matchedApproval.id}`
                    );
                    // Fall through to normal reaction handling
                  } else {
                    runtime.log?.(
                      `[tlon] Reaction-based approval: ${reactEmoji} → ${approvalAction} for #${matchedApproval.id}`
                    );
                    try {
                      const confirmText = await executeApprovalAction(
                        matchedApproval,
                        approvalAction
                      );
                      await sendOwnerNotification(confirmText);
                    } catch (err) {
                      runtime.error?.(
                        `[tlon] Reaction approval error: ${String(err)}`
                      );
                    }
                    return;
                  }
                }
              }
            }

            try {
              const partnerShip = extractDmPartnerShip(whom);
              const route = core.channel.routing.resolveAgentRoute({
                cfg,
                channel: 'tlon',
                accountId: opts.accountId ?? undefined,
                peer: { kind: 'direct', id: partnerShip || reactAuthor },
              });

              // Look up cached DM message for context
              const dmCacheKey = `dm/${whom}`;
              const cached = lookupCachedMessage(dmCacheKey, messageId);
              const action = isAdd ? 'added' : 'removed';

              // If reacting to the bot's own message, dispatch as a real message
              // so the agent runs immediately (e.g. thumbs-up as "yes")
              if (isAdd && cached?.author === botShipName) {
                // Include context so agent knows what was reacted to
                const reactText = cached?.content
                  ? `${reactEmoji} (reacting to: "${cached.content}")`
                  : reactEmoji;
                runtime.log?.(
                  `[tlon] Dispatching DM reaction as message: ${reactEmoji} from ${reactAuthor}`
                );
                await processMessage({
                  messageId: `react-${messageId}-${reactAuthor}-${Date.now()}`,
                  senderShip: reactAuthor,
                  messageText: reactText,
                  trigger: 'reaction',
                  cachesHistory: true,
                  isGroup: false,
                  timestamp: Date.now(),
                  replyParentId: dmReactionReplyParentId(
                    botShipName,
                    messageId
                  ), // Thread reply for delivery only
                });
              } else {
                const contentSnippet = cached?.content
                  ? ` (message: "${cached.content.substring(0, 200)}${cached.content.length > 200 ? '...' : ''}")`
                  : '';
                const authorInfo = cached?.author
                  ? ` (by ${formatShipWithNickname(cached.author)})`
                  : '';
                const reactorDisplay = formatShipWithNickname(reactAuthor);
                const eventText = `Tlon DM reaction ${action}: ${reactEmoji} by ${reactorDisplay} on message ${messageId}${authorInfo}${contentSnippet}`;
                core.system.enqueueSystemEvent(eventText, {
                  sessionKey: route.sessionKey,
                  contextKey: `tlon:dm-reaction:${messageId}:${reactEmoji}:${reactAuthor}:${action}`,
                  // Route any resulting system/heartbeat turn back to Tlon.
                  deliveryContext: tlonDeliveryContext(
                    `tlon:${partnerShip || reactAuthor}`,
                    route.accountId
                  ),
                });
                runtime.log?.(`[tlon] DM_REACTION: ${eventText}`);
              }
            } catch (err: any) {
              runtime.error?.(
                `[tlon] Error handling DM reaction: ${err?.message ?? String(err)}`
              );
            }
          }
          return;
        }

        // Extract reply-essay from DM thread reply
        const dmReplyEssay = dmReply?.delta?.add?.['reply-essay'];
        const dmReplyParentId = dmReply ? event.id : undefined;
        const isDmThreadReply = Boolean(dmReplyEssay);
        const dmContent = essay || dmReplyEssay;

        // For DM thread replies, extract the reply's own ID (distinct from the parent post ID)
        // The reply ID may be in dmReply.id, or we construct it from author/sent
        let dmReplyOwnId: string | undefined;
        if (isDmThreadReply && dmReply) {
          dmReplyOwnId = dmReply.id ?? dmReply.delta?.add?.id;
          // If no explicit reply ID, construct from author/sent (same format as our outbound)
          if (!dmReplyOwnId && dmReplyEssay?.author && dmReplyEssay?.sent) {
            dmReplyOwnId = `${normalizeShip(extractAuthorShip(dmReplyEssay.author))}/${dmReplyEssay.sent}`;
          }
        }

        if (!dmContent) {
          return;
        }

        // Use the reply's own ID for thread replies so the agent has the correct message ID
        const effectiveMessageId = dmReplyOwnId ?? messageId;

        if (!processedTracker.mark(effectiveMessageId)) {
          return;
        }

        const authorShip = normalizeShip(extractAuthorShip(dmContent.author));
        const partnerShip = extractDmPartnerShip(whom);
        const senderShip = partnerShip || authorShip;
        const { rawText, engagementText } = prepareInboundText(
          dmContent.content,
          botShipName,
          botNickname ?? undefined
        );

        // Cache DM messages (including bot's own) so reaction lookups have context
        const dmCacheKey = `dm/${whom}`;
        const rawCacheText = rawText;
        const hasDmBlob = Boolean(dmContent.blob);
        if (rawCacheText.trim() || hasDmBlob) {
          cacheMessage(dmCacheKey, {
            author: authorShip,
            content: rawCacheText,
            timestamp: dmContent.sent || Date.now(),
            id: effectiveMessageId,
            blob: dmContent.blob ?? null,
          });
        }

        // Skip processing bot's own messages (but they're already cached above)
        if (authorShip === botShipName) {
          return;
        }
        if (!senderShip || senderShip === botShipName) {
          return;
        }

        // Log mismatch between author and partner for debugging
        if (authorShip && partnerShip && authorShip !== partnerShip) {
          runtime.log?.(
            `[tlon] DM ship mismatch (author=${authorShip}, partner=${partnerShip}) - routing to partner`
          );
        }

        const hasBlob = Boolean(dmContent.blob);
        if (!rawText.trim() && !hasBlob) {
          return;
        }

        // Owner is always allowed to DM (bypass allowlist)
        if (isOwner(senderShip)) {
          runtime.log?.(
            `[tlon] Processing DM from owner ${senderShip}${isDmThreadReply ? ` (thread reply, parent=${dmReplyParentId}, replyId=${effectiveMessageId})` : ''}`
          );
        } else if (!isDmAllowed(senderShip, effectiveDmAllowlist)) {
          // If owner is configured, queue approval request
          if (effectiveOwnerShip) {
            const approval = createPendingApproval(
              {
                type: 'dm',
                requestingShip: senderShip,
                messagePreview: rawText.substring(0, 100),
                originalMessage: {
                  messageId: effectiveMessageId ?? '',
                  messageText: rawText,
                  messageContent: dmContent.content,
                  timestamp: dmContent.sent || Date.now(),
                  parentId: dmReplyParentId,
                  parentAuthorId: dmReplyParentId
                    ? lookupCachedMessage(dmCacheKey, dmReplyParentId)?.author
                    : undefined,
                  isThreadReply: isDmThreadReply,
                  blob: dmContent.blob ?? undefined,
                },
              },
              pendingApprovals.map((a) => a.id)
            );
            await queueApprovalRequest(approval);
          } else {
            runtime.log?.(
              `[tlon] Blocked DM from ${senderShip}: not in allowlist`
            );
          }
          return;
        }

        const citedContent = await resolveCitedContent(dmContent.content);
        await processMessage({
          messageId: effectiveMessageId ?? '',
          senderShip,
          messageText: rawText,
          ...(citedContent ? { citedContent } : {}),
          gateText: engagementText,
          trigger: 'dm',
          cachesHistory: Boolean(rawCacheText.trim()),
          messageContent: dmContent.content, // Pass raw content for media extraction
          blobField: dmContent.blob,
          isGroup: false,
          timestamp: dmContent.sent || Date.now(),
          parentId: dmReplyParentId,
          isThreadReply: isDmThreadReply,
        });
      } catch (error: any) {
        runtime.error?.(
          `[tlon] Error handling chat firehose event: ${error?.message ?? String(error)}`
        );
      }
    };

    try {
      runtime.log?.('[tlon] Subscribing to firehose updates...');

      // Subscribe to channels firehose (/v4)
      await api.subscribe({
        app: 'channels',
        path: '/v4',
        event: (data) => handleChannelsFirehose(data as ChannelFirehoseEvent),
        err: (error) => {
          capturePluginError('channels_firehose', error);
          runtime.error?.(`[tlon] Channels firehose error: ${String(error)}`);
        },
        quit: () => {
          capturePluginError(
            'channels_firehose',
            'channels firehose quit received; resubscribing',
            { errorKind: 'quit' }
          );
          runtime.log?.(
            '[tlon] Channels firehose quit received, SSE client will resubscribe'
          );
        },
      });
      runtime.log?.('[tlon] Subscribed to channels firehose (/v4)');

      // Subscribe to chat/DM firehose (/v4)
      await api.subscribe({
        app: 'chat',
        path: '/v4',
        event: (data) => handleChatFirehose(data as ChatFirehoseEvent),
        err: (error) => {
          capturePluginError('chat_firehose', error);
          runtime.error?.(`[tlon] Chat firehose error: ${String(error)}`);
        },
        quit: () => {
          capturePluginError(
            'chat_firehose',
            'chat firehose quit received; resubscribing',
            { errorKind: 'quit' }
          );
          runtime.log?.(
            '[tlon] Chat firehose quit received, SSE client will resubscribe'
          );
        },
      });
      runtime.log?.('[tlon] Subscribed to chat firehose (/v4)');

      // Subscribe to contacts updates to track nickname changes
      await api.subscribe({
        app: 'contacts',
        path: '/v1/news',
        event: (event: any) => {
          try {
            // Look for self profile updates
            if (event?.self) {
              const selfUpdate = event.self;
              if (
                selfUpdate?.contact?.nickname?.value !== undefined ||
                selfUpdate?.contact?.avatar?.value !== undefined
              ) {
                const newNickname = selfUpdate.contact.nickname.value || null;
                if (newNickname !== botNickname) {
                  botNickname = newNickname;
                  runtime.log?.(`[tlon] Bot nickname updated: ${botNickname}`);
                  if (botNickname) {
                    nicknameCache.set(
                      botShipName,
                      sanitizeNickname(botNickname)
                    );
                  } else {
                    nicknameCache.delete(botShipName);
                  }
                }
                const newAvatar = selfUpdate.contact?.avatar?.value || null;
                if (newAvatar !== botAvatar) {
                  botAvatar = newAvatar;
                  runtime.log?.(
                    `[tlon] Bot avatar updated: ${botAvatar ? 'set' : 'cleared'}`
                  );
                }
              }
            }
            // Look for peer profile updates (other users)
            if (event?.peer) {
              const ship = event.peer.ship
                ? normalizeShip(event.peer.ship)
                : null;
              const nickname =
                event.peer.contact?.nickname?.value ??
                event.peer.contact?.nickname;
              if (ship) {
                if (nickname && typeof nickname === 'string') {
                  nicknameCache.set(ship, sanitizeNickname(nickname));
                } else {
                  nicknameCache.delete(ship);
                }
              }
            }
          } catch (error: any) {
            runtime.error?.(
              `[tlon] Error handling contacts event: ${error?.message ?? String(error)}`
            );
          }
        },
        err: (error) => {
          capturePluginError('contacts_subscription', error);
          runtime.error?.(
            `[tlon] Contacts subscription error: ${String(error)}`
          );
        },
        quit: () => {
          runtime.log?.(
            '[tlon] Contacts quit received, SSE client will resubscribe'
          );
        },
      });
      runtime.log?.('[tlon] Subscribed to contacts updates (/v1/news)');

      // Subscribe to the bot ship's %steward lens module for owner-initiated
      // retries. The agent verifies the requester before emitting the fact;
      // the checks here are defense-in-depth. /v1/lens carries both %entry
      // and %retry-requested updates — we ignore entries (they're echoes of
      // our own pokes) and act only on the retry signal.
      if (contextLensEnabled) {
        const recentRetryDispatches = new Map<string, number>();
        const RETRY_DEDUP_MS = 60_000;
        const handleLensRetryFact = async (data: unknown) => {
          const update = (
            data as {
              lens?: {
                'retry-requested'?: { id?: unknown; requester?: unknown };
              };
            } | null
          )?.lens?.['retry-requested'];
          if (!update) {
            // %entry updates (our own pokes echoing back) — ignore.
            return;
          }
          const lensId = typeof update.id === 'string' ? update.id : '';
          const requester =
            typeof update.requester === 'string'
              ? normalizeShip(update.requester)
              : '';
          if (!lensId || !requester) {
            return;
          }
          // Align with the singular owner the agent actually stores; any
          // "extra" configured owners are ignored at sync-configure time too,
          // so accepting their retries here would be inconsistent.
          const owner = resolveLensOwner(cfg, opts.accountId ?? undefined);
          if (!owner || owner !== requester) {
            runtime.log?.(
              `[tlon] Context lens retry refused for ${lensId}: requester ${requester} is not the configured owner`
            );
            return;
          }
          const now = Date.now();
          for (const [id, ts] of recentRetryDispatches) {
            if (now - ts > RETRY_DEDUP_MS) {
              recentRetryDispatches.delete(id);
            }
          }
          if (recentRetryDispatches.has(lensId)) {
            runtime.log?.(
              `[tlon] Context lens retry ignored for ${lensId}: recently dispatched`
            );
            return;
          }
          // Reserve the dedup slot before the first await so two concurrent
          // retry facts for the same lensId can't both pass the check above.
          recentRetryDispatches.set(lensId, now);
          const lens =
            contextLenses.get(lensId) ??
            findRecentContextLensById(lensId) ??
            getContextLensStore()?.get(lensId);
          if (!lens) {
            recentRetryDispatches.delete(lensId);
            runtime.log?.(
              `[tlon] Context lens retry refused: run ${lensId} not found`
            );
            return;
          }
          const result = buildRetryDispatch(lens);
          if (!result.ok) {
            recentRetryDispatches.delete(lensId);
            runtime.log?.(
              `[tlon] Context lens retry refused for ${lensId}: ${result.reason}`
            );
            return;
          }
          const dispatch = result.dispatch;
          if (await isShipBlocked(dispatch.senderShip)) {
            recentRetryDispatches.delete(lensId);
            runtime.log?.(
              `[tlon] Context lens retry refused for ${lensId}: original sender ${dispatch.senderShip} is blocked`
            );
            return;
          }
          runtime.log?.(
            `[tlon] Context lens retry dispatching for ${lensId} (requested by ${requester})${
              dispatch.degraded
                ? ' [degraded: no retry seed, using preview]'
                : ''
            }`
          );
          const replay = dispatch.messageContent
            ? await buildReplayMessageText(
                {
                  messageText: dispatch.messageText,
                  messageContent: dispatch.messageContent,
                },
                api!,
                { runtime, signal: opts.abortSignal }
              )
            : { messageText: dispatch.messageText };
          await processMessage({
            messageId: lens.messageId,
            senderShip: dispatch.senderShip,
            messageText: replay.messageText,
            ...(replay.citedContent
              ? { citedContent: replay.citedContent }
              : {}),
            ...(replay.gateText !== undefined
              ? { gateText: replay.gateText }
              : {}),
            blobField: dispatch.blobField,
            ...(dispatch.messageContent
              ? { messageContent: dispatch.messageContent }
              : {}),
            isGroup: dispatch.isGroup,
            ...(dispatch.channelNest
              ? { channelNest: dispatch.channelNest }
              : {}),
            timestamp: Date.now(),
            parentId: dispatch.parentId,
            isThreadReply: dispatch.isThreadReply,
            replyParentId: dispatch.replyParentId,
            cachesHistory: dispatch.cachesHistory,
            trigger: 'retry',
            retryOf: lensId,
          });
        };
        try {
          await api.subscribe({
            app: 'steward',
            path: '/v1/lens',
            event: (data) => {
              handleLensRetryFact(data).catch((error: any) => {
                runtime.error?.(
                  `[tlon] Steward lens retry handler error: ${error?.message ?? String(error)}`
                );
              });
            },
            err: (error) => {
              capturePluginError('steward_subscription', error);
              runtime.error?.(
                `[tlon] Steward lens subscription error: ${String(error)}`
              );
            },
            quit: () => {
              capturePluginError(
                'steward_subscription',
                'steward lens quit received; resubscribing',
                { errorKind: 'quit' }
              );
              runtime.log?.(
                '[tlon] Steward lens quit received, SSE client will resubscribe'
              );
            },
          });
          runtime.log?.(
            '[tlon] Subscribed to steward lens facts (/v1/lens) for retry signals'
          );
        } catch (error: any) {
          // Ships without %steward (or older context-lens-only ships) nack
          // the subscribe; retries are unavailable but everything else keeps
          // working.
          runtime.log?.(
            `[tlon] Steward lens subscription unavailable: ${error?.message ?? String(error)}`
          );
        }
      }

      // Subscribe to settings store for hot-reloading config
      const applySettingsSnapshot = (
        newSettings: TlonSettingsStore,
        source: 'subscription' | 'refresh',
        snapshotOpts: { fresh?: boolean } = {}
      ) => {
        const prevSettings = currentSettings;

        // If pendingNudge has been rehydrated (startup succeeded or monitor has locally
        // set/cleared it), the in-memory state is authoritative — refreshes cannot clobber
        // it or resurrect stale store echoes. If not yet rehydrated (startup scry failed),
        // allow the store value through so refresh can recover the persisted record.
        let effectivePendingNudge: PendingNudge | undefined;
        if (pendingNudgeRehydrated) {
          effectivePendingNudge =
            getPendingNudge(account.accountId) ?? undefined;
        } else if (newSettings.pendingNudge) {
          syncPendingNudgeFromStore(
            account.accountId,
            newSettings.pendingNudge
          );
          pendingNudgeRehydrated = true;
          effectivePendingNudge = newSettings.pendingNudge;
          runtime.log?.(
            '[tlon] Settings refresh: recovered persisted pendingNudge after startup failure'
          );
        } else {
          effectivePendingNudge = undefined;
        }

        const nextRuntimeSettings: TlonSettingsStore = {
          ...newSettings,
          pendingNudge: effectivePendingNudge,
        };
        if (
          source === 'refresh' &&
          JSON.stringify(prevSettings) === JSON.stringify(nextRuntimeSettings)
        ) {
          currentSettings = nextRuntimeSettings;
          return;
        }

        // Update watched channels if settings changed
        if (newSettings.groupChannels?.length) {
          const newChannels = newSettings.groupChannels;
          for (const ch of newChannels) {
            if (!watchedChannels.has(ch)) {
              watchedChannels.add(ch);
              runtime.log?.(`[tlon] Settings: now watching channel ${ch}`);
            }
          }
          // Note: we don't remove channels from watchedChannels to avoid missing messages
          // during transitions. The authorization check handles access control.
        }

        // Update DM allowlist — respect empty lists (don't fall back to file config)
        if (newSettings.dmAllowlist !== undefined) {
          effectiveDmAllowlist = newSettings.dmAllowlist;
          runtime.log?.(
            `[tlon] Settings: dmAllowlist updated to ${effectiveDmAllowlist.length > 0 ? effectiveDmAllowlist.join(', ') : '(empty)'}`
          );
        }

        // Update model signature setting
        if (newSettings.showModelSig !== undefined) {
          effectiveShowModelSig = newSettings.showModelSig;
          runtime.log?.(
            `[tlon] Settings: showModelSig = ${effectiveShowModelSig}`
          );
        }

        // Update auto-accept DM invites setting
        if (newSettings.autoAcceptDmInvites !== undefined) {
          effectiveAutoAcceptDmInvites = newSettings.autoAcceptDmInvites;
          runtime.log?.(
            `[tlon] Settings: autoAcceptDmInvites = ${effectiveAutoAcceptDmInvites}`
          );
        }

        // Update auto-accept group invites setting
        if (newSettings.autoAcceptGroupInvites !== undefined) {
          effectiveAutoAcceptGroupInvites = newSettings.autoAcceptGroupInvites;
          runtime.log?.(
            `[tlon] Settings: autoAcceptGroupInvites = ${effectiveAutoAcceptGroupInvites}`
          );
        }

        // Update group invite allowlist. An explicit empty list is authoritative
        // (the admin cleared it) — don't fall back to the file list, or clearing
        // the allowlist would keep auto-accepting invites from the old entries.
        if (newSettings.groupInviteAllowlist !== undefined) {
          effectiveGroupInviteAllowlist = newSettings.groupInviteAllowlist;
          runtime.log?.(
            `[tlon] Settings: groupInviteAllowlist updated to ${effectiveGroupInviteAllowlist.join(', ')}`
          );
        }

        if (newSettings.defaultAuthorizedShips !== undefined) {
          runtime.log?.(
            `[tlon] Settings: defaultAuthorizedShips updated to ${(newSettings.defaultAuthorizedShips || []).join(', ')}`
          );
        }

        // Update auto-discover channels
        if (newSettings.autoDiscoverChannels !== undefined) {
          effectiveAutoDiscoverChannels = newSettings.autoDiscoverChannels;
          runtime.log?.(
            `[tlon] Settings: autoDiscoverChannels = ${effectiveAutoDiscoverChannels}`
          );
        }

        if (newSettings.ownerListenEnabled !== undefined) {
          effectiveOwnerListenEnabled = newSettings.ownerListenEnabled;
          runtime.log?.(
            `[tlon] Settings: ownerListenEnabled = ${effectiveOwnerListenEnabled}`
          );
        }

        if (newSettings.ownerListenDisabledChannels !== undefined) {
          effectiveOwnerListenDisabled = new Set(
            canonicalizeNestList(newSettings.ownerListenDisabledChannels)
          );
          runtime.log?.(
            `[tlon] Settings: ownerListenDisabledChannels updated (${effectiveOwnerListenDisabled.size} channel(s) disabled)`
          );
        }

        // ownerShip is applied on both live subscription and refresh.
        // pendingNudge is only rehydrated from the store during startup load. Once the
        // monitor is running, the in-memory pending state is authoritative so refreshes
        // cannot clobber live state or resurrect stale store echoes.
        const sync = resolveSettingsMirrorSync({
          prevSettings,
          newSettings,
          fileConfigOwnerShip: account.ownerShip
            ? normalizeShip(account.ownerShip)
            : null,
        });

        if (sync.ownerShipChanged) {
          effectiveOwnerShip = sync.effectiveOwnerShip;
          runtime.log?.(`[tlon] Settings: ownerShip = ${effectiveOwnerShip}`);
          setEffectiveOwnerShip(account.accountId, effectiveOwnerShip);
        }

        // Reconcile the scheduler's owner-activity shadow with live settings
        // changes. Subscription events are authoritative (real-time ship echo
        // of a poke, admin override, test harness seeding). Refresh updates
        // are trusted only when `load()` returned `{ fresh: true }` — on
        // `fresh: false` the manager preserves the last-known snapshot, which
        // may not yet reflect a locally observed owner reply the ship hasn't
        // echoed back, so clobbering the shadow from that path would regress
        // the fix that motivated the shadow in the first place.
        //
        // Gating on a prev/new diff means a subscription event for some
        // unrelated key (e.g. channelRules) cannot reset the shadow via the
        // snapshot's unchanged owner-activity fields.
        const shadowReconcileTrusted =
          source === 'subscription' || snapshotOpts.fresh === true;
        const ownerActivityChanged =
          prevSettings.lastOwnerMessageAt !== newSettings.lastOwnerMessageAt ||
          prevSettings.lastOwnerMessageDate !==
            newSettings.lastOwnerMessageDate;
        if (shadowReconcileTrusted && ownerActivityChanged) {
          setLastOwnerActivity(
            account.accountId,
            ownerActivityFromSettings(newSettings)
          );
          runtime.log?.(
            `[tlon] nudge: reconciled lastOwnerActivity shadow from ${source} (at=${newSettings.lastOwnerMessageAt ?? 'null'})`
          );
        }

        // Reconcile the scheduler's stage shadow with live `lastNudgeStage`
        // changes for the same trust-and-diff reasons as the activity branch
        // above. Without this, an external `%settings` clear (or admin
        // lower) cannot move the in-memory guard down — the runner's
        // `resolveAuthoritativeStage()` currently uses the shadow as the
        // authoritative stage, so a stuck-high shadow suppresses later
        // same-stage nudges.
        //
        // Trust gate: subscription events are real-time and only fire when
        // storage actually transitioned, so they cannot represent a stale
        // post-poke read. Refresh is trusted only when `load()` returned
        // `{ fresh: true }`, matching the activity-shadow rule. Scry is
        // still useful for drift logging, but it is not part of the
        // runner's stage guard today.
        const stageChanged =
          prevSettings.lastNudgeStage !== newSettings.lastNudgeStage;
        if (shadowReconcileTrusted && stageChanged) {
          const nextStage = newSettings.lastNudgeStage ?? 0;
          setLastNudgeStageShadow(account.accountId, nextStage);
          runtime.log?.(
            `[tlon] nudge: reconciled lastNudgeStageShadow from ${source} (stage=${nextStage})`
          );
        }

        // Update pending approvals
        if (newSettings.pendingApprovals !== undefined) {
          pendingApprovals = newSettings.pendingApprovals;
          runtime.log?.(
            `[tlon] Settings: pendingApprovals updated (${pendingApprovals.length} items)`
          );
        }
        currentSettings = nextRuntimeSettings;
      };

      settingsManager.onChange((newSettings) => {
        applySettingsSnapshot(newSettings, 'subscription');
      });

      try {
        await settingsManager.startSubscription();
      } catch (err) {
        // Settings subscription is optional - don't fail if it doesn't work
        runtime.log?.(
          `[tlon] Settings subscription not available: ${String(err)}`
        );
      }

      // The onboarding sweep below runs on a timer; any groups-ui event
      // also rings this bell so a group that appears between ticks (the
      // force-joined home group, a just-created agent group) is checked
      // immediately instead of waiting out the backoff. Rung mid-sweep, the
      // flag makes the loop go around again rather than sleep.
      let wakeOnboardingSweep: (() => void) | null = null;
      let onboardingSweepNudged = false;
      const nudgeOnboardingSweep = () => {
        onboardingSweepNudged = true;
        wakeOnboardingSweep?.();
      };

      // Subscribe to groups-ui for real-time channel additions (when invites are accepted)
      try {
        await api.subscribe({
          app: 'groups',
          path: '/groups/ui',
          event: async (event: any) => {
            try {
              // Used as a bell, not parsed: relying on this event's shape
              // to spot the home group has already missed on the hosted
              // fleet, and the sweep it wakes re-derives everything from
              // scries anyway.
              nudgeOnboardingSweep();
              // Handle fleet (member) changes - inject system message for joins
              if (event?.flag && event?.update?.fleet) {
                const groupFlag = event.flag as string;
                const fleet = event.update.fleet;
                // Fleet structure: { "~ship": { add: null } } or similar
                if (fleet && typeof fleet === 'object') {
                  for (const [ship, diff] of Object.entries(fleet)) {
                    if (
                      diff &&
                      typeof diff === 'object' &&
                      'add' in (diff as any)
                    ) {
                      // New member joined - find sessions with channels in this group
                      for (const [nest, flag] of channelToGroup.entries()) {
                        if (flag === groupFlag && watchedChannels.has(nest)) {
                          const route = core.channel.routing.resolveAgentRoute({
                            cfg,
                            channel: 'tlon',
                            peer: { kind: 'group', id: nest },
                          });
                          if (route?.sessionKey) {
                            const memberDisplay = formatShipWithNickname(ship);
                            core.system.enqueueSystemEvent(
                              `[${memberDisplay} joined group ${groupFlag}]`,
                              {
                                sessionKey: route.sessionKey,
                                // Route any resulting system turn back to Tlon.
                                deliveryContext: tlonDeliveryContext(
                                  `tlon:${nest}`,
                                  route.accountId
                                ),
                              }
                            );
                            runtime.log?.(
                              `[tlon] Member joined: ${ship} → ${groupFlag}`
                            );
                            break; // Only inject once per group
                          }
                        }
                      }
                    }
                  }
                }
              }

              // Handle group/channel join events
              // Event structure: { group: { flag: "~host/group-name", ... }, channels: { ... } }
              if (event && typeof event === 'object') {
                // Check for new channels being added to groups
                if (event.channels && typeof event.channels === 'object') {
                  const channels = event.channels as Record<string, any>;
                  for (const [channelNest, _channelData] of Object.entries(
                    channels
                  )) {
                    // Only monitor chat, heap, and diary channels
                    if (
                      !channelNest.startsWith('chat/') &&
                      !channelNest.startsWith('heap/') &&
                      !channelNest.startsWith('diary/')
                    ) {
                      continue;
                    }

                    const channelTitle = extractMetadataTitle(_channelData);
                    if (channelTitle) {
                      channelNameCache.set(channelNest, channelTitle);
                    }

                    // If this is a new channel we're not watching yet, add it
                    if (!watchedChannels.has(channelNest)) {
                      watchedChannels.add(channelNest);
                      runtime.log?.(
                        `[tlon] Auto-detected new channel (invite accepted): ${channelNest}`
                      );

                      // The hosted home group's moon is force-joined by
                      // provisioning — no invite event ever fires — so its
                      // appearance here is the join signal. The offer's own
                      // guards (empty, single-channel, unconfigured, once)
                      // make this a no-op anywhere else.
                      if (
                        effectiveOwnerShip &&
                        channelNest === homeGroupChatNestFor(effectiveOwnerShip)
                      ) {
                        void offerOnboardingInNewOwnerGroup(
                          homeGroupFlagFor(effectiveOwnerShip)
                        );
                      }

                      // Persist to settings store so it survives restarts
                      if (effectiveAutoAcceptGroupInvites) {
                        try {
                          const currentChannels =
                            currentSettings.groupChannels || [];
                          if (!currentChannels.includes(channelNest)) {
                            const updatedChannels = [
                              ...currentChannels,
                              channelNest,
                            ];
                            // Poke settings store to persist
                            await api.poke({
                              app: 'settings',
                              mark: 'settings-event',
                              json: {
                                'put-entry': {
                                  'bucket-key': 'tlon',
                                  'entry-key': 'groupChannels',
                                  value: updatedChannels,
                                  desk: 'moltbot',
                                },
                              },
                            });
                            runtime.log?.(
                              `[tlon] Persisted ${channelNest} to settings store`
                            );
                          }
                        } catch (err) {
                          runtime.error?.(
                            `[tlon] Failed to persist channel to settings: ${String(err)}`
                          );
                        }
                      }
                    }
                  }
                }

                // Also check for the "join" event structure
                if (event.join && typeof event.join === 'object') {
                  const join = event.join as {
                    group?: string;
                    channels?: string[];
                  };
                  if (join.channels) {
                    for (const channelNest of join.channels) {
                      if (
                        !channelNest.startsWith('chat/') &&
                        !channelNest.startsWith('heap/') &&
                        !channelNest.startsWith('diary/')
                      ) {
                        continue;
                      }
                      if (!watchedChannels.has(channelNest)) {
                        watchedChannels.add(channelNest);
                        runtime.log?.(
                          `[tlon] Auto-detected joined channel: ${channelNest}`
                        );

                        // Same force-joined home-group signal as above.
                        if (
                          effectiveOwnerShip &&
                          channelNest ===
                            homeGroupChatNestFor(effectiveOwnerShip)
                        ) {
                          void offerOnboardingInNewOwnerGroup(
                            homeGroupFlagFor(effectiveOwnerShip)
                          );
                        }

                        // Persist to settings store
                        if (effectiveAutoAcceptGroupInvites) {
                          try {
                            const currentChannels =
                              currentSettings.groupChannels || [];
                            if (!currentChannels.includes(channelNest)) {
                              const updatedChannels = [
                                ...currentChannels,
                                channelNest,
                              ];
                              await api.poke({
                                app: 'settings',
                                mark: 'settings-event',
                                json: {
                                  'put-entry': {
                                    'bucket-key': 'tlon',
                                    'entry-key': 'groupChannels',
                                    value: updatedChannels,
                                    desk: 'moltbot',
                                  },
                                },
                              });
                              runtime.log?.(
                                `[tlon] Persisted ${channelNest} to settings store`
                              );
                            }
                          } catch (err) {
                            runtime.error?.(
                              `[tlon] Failed to persist channel to settings: ${String(err)}`
                            );
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (error: any) {
              runtime.error?.(
                `[tlon] Error handling groups-ui event: ${error?.message ?? String(error)}`
              );
            }
          },
          err: (error) => {
            capturePluginError('groups_ui_subscription', error);
            runtime.error?.(
              `[tlon] Groups-ui subscription error: ${String(error)}`
            );
          },
          quit: () => {
            runtime.log?.(
              '[tlon] Groups-ui quit received, SSE client will resubscribe'
            );
          },
        });
        runtime.log?.(
          '[tlon] Subscribed to groups-ui for real-time channel detection'
        );
      } catch (err) {
        // Groups-ui subscription is optional - channel discovery will still work via polling
        capturePluginError('groups_ui_subscription', err);
        runtime.log?.(
          `[tlon] Groups-ui subscription failed (will rely on polling): ${String(err)}`
        );
      }

      // Subscribe to foreigns for auto-accepting group invites
      // Always subscribe so we can hot-reload the setting via settings store
      {
        const processedGroupInvites = new Set<string>();

        // Helper to process pending invites
        const processPendingInvites = async (foreigns: Foreigns) => {
          if (!foreigns || typeof foreigns !== 'object') {
            return;
          }

          for (const [groupFlag, foreign] of Object.entries(foreigns)) {
            if (processedGroupInvites.has(groupFlag)) {
              continue;
            }
            if (!foreign.invites || foreign.invites.length === 0) {
              continue;
            }

            const validInvite = foreign.invites.find((inv) => inv.valid);
            if (!validInvite) {
              continue;
            }

            const inviterShip = validInvite.from;
            const normalizedInviter = normalizeShip(inviterShip);

            // Owner invites are always accepted
            if (isOwner(inviterShip)) {
              try {
                await api.poke({
                  app: 'groups',
                  mark: 'group-join',
                  json: {
                    flag: groupFlag,
                    'join-all': true,
                  },
                });
                processedGroupInvites.add(groupFlag);
                runtime.log?.(
                  `[tlon] Auto-accepted group invite from owner: ${groupFlag}`
                );
                void offerOnboardingInNewOwnerGroup(groupFlag);
              } catch (err) {
                runtime.error?.(
                  `[tlon] Failed to accept group invite from owner: ${String(err)}`
                );
              }
              continue;
            }

            // Skip if auto-accept is disabled
            if (!effectiveAutoAcceptGroupInvites) {
              // If owner is configured, queue approval
              if (effectiveOwnerShip) {
                const approval = createPendingApproval(
                  {
                    type: 'group',
                    requestingShip: inviterShip,
                    groupFlag,
                    groupTitle: validInvite.preview?.meta?.title,
                  },
                  pendingApprovals.map((a) => a.id)
                );
                await queueApprovalRequest(approval);
                processedGroupInvites.add(groupFlag);
              }
              continue;
            }

            // Check if inviter is on allowlist
            const isAllowed =
              effectiveGroupInviteAllowlist.length > 0
                ? effectiveGroupInviteAllowlist
                    .map((s) => normalizeShip(s))
                    .some((s) => s === normalizedInviter)
                : false; // Fail-safe: empty allowlist means deny

            if (!isAllowed) {
              // If owner is configured, queue approval
              if (effectiveOwnerShip) {
                const approval = createPendingApproval(
                  {
                    type: 'group',
                    requestingShip: inviterShip,
                    groupFlag,
                    groupTitle: validInvite.preview?.meta?.title,
                  },
                  pendingApprovals.map((a) => a.id)
                );
                await queueApprovalRequest(approval);
                processedGroupInvites.add(groupFlag);
              } else {
                runtime.log?.(
                  `[tlon] Rejected group invite from ${inviterShip} (not in groupInviteAllowlist): ${groupFlag}`
                );
                processedGroupInvites.add(groupFlag);
              }
              continue;
            }

            // Inviter is on allowlist - accept the invite
            try {
              await api.poke({
                app: 'groups',
                mark: 'group-join',
                json: {
                  flag: groupFlag,
                  'join-all': true,
                },
              });
              processedGroupInvites.add(groupFlag);
              runtime.log?.(
                `[tlon] Auto-accepted group invite: ${groupFlag} (from ${validInvite.from})`
              );
            } catch (err) {
              runtime.error?.(
                `[tlon] Failed to auto-accept group ${groupFlag}: ${String(err)}`
              );
            }
          }
        };

        // Process existing pending invites from init data
        if (initForeigns) {
          await processPendingInvites(initForeigns);
        }

        // Sweep for openings that no event will deliver. Two ways a group
        // ends up joined-but-never-opened: the join-accept above consumes
        // the foreign invite and the opening it fires is fire-and-forget
        // (a crash between the two leaves no retry), and the hosted home
        // group's moon is force-joined by provisioning — on its own clock
        // relative to this gateway's boot, with no invite event at all and
        // a groups-ui discovery that has been seen to miss on the fleet.
        // The owner meanwhile sees a blank channel (the client suppresses
        // its welcome notice while waiting for the agent). So the sweep is
        // periodic, not once-per-boot: it re-checks until every candidate
        // reaches a terminal verdict, which makes the opening an arrival
        // invariant instead of a race — whenever the owner lands in the
        // group, the opening is there or seconds away.
        //
        // Candidates are groups whose description carries the client's
        // agent marker with no setup yet (plus the deterministic home-group
        // flag) — a precise "created for me, not opened" signal, never
        // group *shape*: an empty owner-hosted channel just as well
        // describes a muted or dormant ordinary group, and opening those at
        // every restart is the bot barging in (and flips them
        // mid-onboarding for the owner-listen gate). The offer helper's own
        // guards (single channel, no posts, not already offered) make each
        // pass a no-op wherever an opening already landed, and terminal
        // verdicts drop a group out of the sweep entirely, so a quiet tick
        // costs one groups scry.
        const onboardingSweepSettled = new Set<string>();
        const runOnboardingSweep = async (): Promise<boolean> => {
          const flags = await findAgentGroupsAwaitingOpening(
            api,
            runtime,
            effectiveOwnerShip
          );
          let sawWork = false;
          for (const groupFlag of flags) {
            if (opts.abortSignal?.aborted) {
              return sawWork;
            }
            if (onboardingSweepSettled.has(groupFlag)) {
              continue;
            }
            sawWork = true;
            const verdict = await offerOnboardingInNewOwnerGroup(groupFlag);
            if (verdict !== 'retry') {
              onboardingSweepSettled.add(groupFlag);
            }
          }
          // Closings ride the same loop: the "is the setup finished?"
          // check otherwise runs exactly once, at the end of the directive
          // turn — a config write whose effect lands a beat later (or a
          // turn that dies after its writes) left the owner staring at a
          // finished build with no closing cards, forever. The check is
          // transcript-idempotent, so re-running it until it settles is
          // free of double posts, and the groups-ui bell makes the write
          // itself wake this loop within seconds.
          for (const nest of [...onboardingInvitePending]) {
            if (opts.abortSignal?.aborted) {
              return sawWork;
            }
            // Work exists, but a running directive turn owns the channel:
            // the config write lands mid-build, and closing on it here
            // would post the cards while the agent is still finishing.
            // Keeping sawWork keeps the cadence fast for the moment the
            // turn returns.
            sawWork = true;
            if (onboardingSetupTurnInFlight.has(nest)) {
              continue;
            }
            await postInviteCardIfSetupComplete(nest);
          }
          return sawWork;
        };
        // Fast while provisioning is plausibly still running (the home
        // group is created in the same flow that boots this gateway) or
        // while a candidate is pending; backed off to a slow safety net
        // forever after — the nudge above restores immediacy whenever
        // groups state changes.
        const ONBOARDING_SWEEP_FLOOR_MS = 20_000;
        const ONBOARDING_SWEEP_CEILING_MS = 300_000;
        const onboardingSweepBootWindowUntil = Date.now() + 15 * 60_000;
        const waitForNextSweep = (ms: number) =>
          new Promise<void>((resolve) => {
            // A listener added to an already-aborted signal never fires —
            // check first, or shutdown mid-sweep would sit out the timer.
            if (opts.abortSignal?.aborted) {
              resolve();
              return;
            }
            const finish = () => {
              clearTimeout(timer);
              opts.abortSignal?.removeEventListener('abort', finish);
              wakeOnboardingSweep = null;
              resolve();
            };
            const timer = setTimeout(finish, ms);
            // The sweep must never be what keeps the process alive.
            (timer as unknown as { unref?: () => void }).unref?.();
            wakeOnboardingSweep = finish;
            opts.abortSignal?.addEventListener('abort', finish, {
              once: true,
            });
          });
        void (async () => {
          let delayMs = ONBOARDING_SWEEP_FLOOR_MS;
          while (!opts.abortSignal?.aborted) {
            onboardingSweepNudged = false;
            let sawWork = false;
            try {
              sawWork = await runOnboardingSweep();
            } catch (error) {
              // Leaves sawWork false: a failing scry backs off with the
              // timer instead of hammering a struggling ship.
              runtime.log?.(
                `[tlon] Onboarding opening sweep failed: ${String(error)}`
              );
            }
            if (onboardingSweepNudged) {
              continue;
            }
            delayMs =
              sawWork || Date.now() < onboardingSweepBootWindowUntil
                ? ONBOARDING_SWEEP_FLOOR_MS
                : Math.min(delayMs * 2, ONBOARDING_SWEEP_CEILING_MS);
            await waitForNextSweep(delayMs);
          }
        })();

        try {
          await api.subscribe({
            app: 'groups',
            path: '/v1/foreigns',
            event: (data: unknown) => {
              void (async () => {
                try {
                  await processPendingInvites(data as Foreigns);
                } catch (error: any) {
                  runtime.error?.(
                    `[tlon] Error handling foreigns event: ${error?.message ?? String(error)}`
                  );
                }
              })();
            },
            err: (error) => {
              capturePluginError('foreigns_subscription', error);
              runtime.error?.(
                `[tlon] Foreigns subscription error: ${String(error)}`
              );
            },
            quit: () => {
              runtime.log?.(
                '[tlon] Foreigns quit received, SSE client will resubscribe'
              );
            },
          });
          runtime.log?.(
            '[tlon] Subscribed to foreigns (/v1/foreigns) for auto-accepting group invites'
          );
        } catch (err) {
          capturePluginError('foreigns_subscription', err);
          runtime.log?.(`[tlon] Foreigns subscription failed: ${String(err)}`);
        }
      }

      // Discover channels to watch
      if (effectiveAutoDiscoverChannels) {
        const discoveredChannels = await fetchAllChannels(api, runtime);
        for (const channelNest of discoveredChannels) {
          watchedChannels.add(channelNest);
        }
        runtime.log?.(`[tlon] Watching ${watchedChannels.size} channel(s)`);
      }

      // Log watched channels
      for (const channelNest of watchedChannels) {
        runtime.log?.(`[tlon] Watching channel: ${channelNest}`);
      }

      runtime.log?.(
        '[tlon] All subscriptions registered, connecting to SSE stream...'
      );
      await api.connect();
      runtime.log?.('[tlon] Connected! Firehose subscriptions active');
      const webSearchRuntime = core.webSearch;
      const webSearchStatus = probeWebSearchBootStatus({
        searchConfig: cfg.tools?.web?.search,
        listProviders:
          typeof webSearchRuntime?.listProviders === 'function'
            ? () => webSearchRuntime.listProviders()
            : undefined,
      });
      if (!webSearchStatus.webSearchAvailable) {
        runtime.error?.(
          `[tlon] web_search unavailable at gateway boot: enabled=${webSearchStatus.webSearchEnabled}, providers=[${webSearchStatus.webSearchProviders.join(', ')}]${
            webSearchStatus.webSearchProbeError
              ? `, probeError=${webSearchStatus.webSearchProbeError}`
              : ''
          }`
        );
      }
      telemetry?.captureGatewayConnected({
        ownerShip: effectiveOwnerShip,
        botShip: botShipName,
        tlonSkillVersion: await resolveTlonSkillVersion(),
        accountId: account.accountId,
        configured: account.configured,
        watchedChannelCount: watchedChannels.size,
        dmAllowlistCount: effectiveDmAllowlist.length,
        defaultAuthorizedShipsCount: (
          currentSettings.defaultAuthorizedShips ??
          account.defaultAuthorizedShips
        ).length,
        pendingApprovalCount: pendingApprovals.length,
        autoDiscoverChannels: effectiveAutoDiscoverChannels,
        ownerListenEnabled: effectiveOwnerListenEnabled,
        ...webSearchStatus,
      });
      // Boot-time cron job-count snapshot (daily container restarts make this
      // a daily gauge). Retries internally: the cron service accessor is
      // published by the gateway_start hook, which can race this connect.
      scheduleCronSnapshot({
        onError: (error) =>
          runtime.error?.(`[tlon] Cron snapshot failed: ${String(error)}`),
      });

      // Periodically refresh channel discovery
      const pollInterval = setInterval(
        async () => {
          if (!opts.abortSignal?.aborted) {
            try {
              if (effectiveAutoDiscoverChannels) {
                const discoveredChannels = await fetchAllChannels(api, runtime);
                for (const channelNest of discoveredChannels) {
                  if (!watchedChannels.has(channelNest)) {
                    watchedChannels.add(channelNest);
                    runtime.log?.(
                      `[tlon] Now watching new channel: ${channelNest}`
                    );
                  }
                }
              }
            } catch (error: any) {
              runtime.error?.(
                `[tlon] Channel refresh error: ${error?.message ?? String(error)}`
              );
            }
          }
        },
        2 * 60 * 1000
      );

      // Periodically re-scry settings as a fallback for stale subscriptions.
      // The settings subscription can silently die (SSE quit without reconnect),
      // leaving both authorization state and heartbeat telemetry mirrors stale.
      const settingsRefreshInterval = setInterval(async () => {
        if (opts.abortSignal?.aborted) {
          return;
        }
        try {
          const refreshResult = await settingsManager.load({
            logSnapshot: false,
          });
          applySettingsSnapshot(refreshResult.settings, 'refresh', {
            fresh: refreshResult.fresh,
          });
        } catch (err) {
          capturePluginError('settings_refresh', err);
          runtime.error?.(`[tlon] Settings refresh failed: ${String(err)}`);
        }
      }, SETTINGS_REFRESH_INTERVAL_MS);

      // Plugin-owned re-engagement nudge scheduler. Owns tick lifecycle and
      // reentrancy; runs independently of LLM heartbeat.
      //
      // Gating is computed by the pure `shouldStartNudgeRunner` helper; see
      // that function for the two invariants (explicit opt-in flag + exactly
      // one configured Tlon account).
      //
      // `TLON_NUDGE_TICK_INTERVAL_MS` exists so the integration harness can
      // drive ticks on a short cadence without rebuilding the plugin; in
      // production the default 15-minute interval applies.
      const nudgeStartDecision = shouldStartNudgeRunner(cfg);
      if (!nudgeStartDecision.start) {
        runtime.log?.(
          `[tlon] nudge: scheduler disabled — ${nudgeStartDecision.detail}`
        );
      } else {
        const intervalEnv = process.env.TLON_NUDGE_TICK_INTERVAL_MS;
        const intervalMsOverride = intervalEnv ? Number(intervalEnv) : NaN;
        nudgeRunner = createNudgeRunner({
          accountId: account.accountId,
          botShip: botShipName,
          api,
          cfg,
          getSettings: () => currentSettings,
          getEffectiveOwnerShip,
          getLastOwnerActivity,
          getLastNudgeStageShadow,
          setLastNudgeStageShadow,
          setLocalPendingNudge,
          sendDm,
          getBotProfile,
          telemetry,
          runtime,
          abortSignal: opts.abortSignal,
          ownerReplyPersistence,
          ...(Number.isFinite(intervalMsOverride) && intervalMsOverride > 0
            ? { intervalMs: intervalMsOverride }
            : {}),
        });
        nudgeRunner.start();
      }

      if (opts.abortSignal) {
        const signal = opts.abortSignal;
        await new Promise<void>((resolve) => {
          const onAbort = () => {
            clearInterval(pollInterval);
            clearInterval(settingsRefreshInterval);
            // Kick off scheduler shutdown; don't block the event-handler
            // callback. The `finally` block awaits the same stop promise
            // before draining the persistence queues and closing the
            // api, so any in-flight tick is guaranteed to settle first.
            void nudgeRunner?.stop();
            // Gateway-status teardown is idempotent via the helper —
            // the early abort listener registered at slot-publish time
            // may have already run, in which case this is a no-op.
            cleanupGatewayStatus();
            resolve();
          };
          // If the signal is already aborted when we reach here,
          // addEventListener("abort", ..., { once: true }) would never
          // fire and we'd await forever. Run cleanup synchronously
          // instead.
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener('abort', onAbort, { once: true });
        });
      } else {
        await new Promise(() => {});
      }
    } finally {
      // Gateway-status teardown via the idempotent helper. Covers the
      // non-abort exit path where the inner try block throws (e.g.
      // api.subscribe rejection, channel discovery failure, connection
      // drop during the main work). Both the late abort listener and
      // this finally call the helper; whichever runs first wins.
      cleanupGatewayStatus();
      removeBridge(accountKey, commandBridge);
      // Await the scheduler drain before flushing persistence queues.
      // `stop()` waits for any in-flight tick to finish so its final
      // `setLocalPendingNudge` / `enqueueStageClear` / etc. writes land
      // inside the queues we flush below, rather than leaking into a
      // half-closed api after cleanup.
      await nudgeRunner?.stop();
      await ownerReplyPersistence.flush();
      await pendingNudgePersistence.flush();
      clearShadowsForAccount(account.accountId);
      setOutboundRouteReporter(null);
      setSessionTelemetryReporter(null);
      setDebugTelemetryReporter(null);
      setErrorTelemetryReporter(null);
      setCronTelemetryReporter(null);
      await telemetry?.close();
      try {
        await api?.close();
      } catch (error: any) {
        runtime.error?.(
          `[tlon] Cleanup error: ${error?.message ?? String(error)}`
        );
      }
    }
  } finally {
    // Outer finally — covers throws in the long bootstrap region
    // between slot publication (above) and the inner try (which begins
    // after the helper definitions). Anything that throws before the
    // inner finally can run hits this one. Idempotent via the helper.
    cleanupGatewayStatus();
    // Remove the early abort listener so the host's signal does not
    // retain `cleanupGatewayStatus` (which transitively pins
    // `myApiClientParams.poke` and the SSE client) after the monitor
    // exits without aborting. `{ once: true }` on the listener auto-
    // removes after firing, so this is a no-op if abort already
    // triggered cleanup; on normal/error exits the explicit removal
    // breaks the retention chain.
    opts.abortSignal?.removeEventListener('abort', cleanupGatewayStatus);
  }
}
