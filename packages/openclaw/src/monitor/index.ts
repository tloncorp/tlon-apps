import type { Story } from '@tloncorp/api';
import { configureGatewayStatus, gatewayStart } from '@tloncorp/api';
import { format } from 'node:util';
import { createTypingCallbacks } from 'openclaw/plugin-sdk/channel-runtime';
import type { OpenClawConfig, ReplyPayload } from 'openclaw/plugin-sdk/core';
import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import {
  getEffectiveOwnerShip,
  setEffectiveOwnerShip,
} from '../effective-owner.js';
import {
  ACTIVE_WINDOW_SECS,
  OFFLINE_REPLY_COOLDOWN_SECS,
  computeLeaseUntil,
  getGatewayStatusManager,
} from '../gateway-status.js';
import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
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
import { getTlonRuntime } from '../runtime.js';
import { setSessionRole } from '../session-roles.js';
import {
  DM_INVITE_PREVIEW,
  type TlonSettingsStore,
  createSettingsManager,
} from '../settings.js';
import { sharedSlot } from '../shared-state.js';
import {
  canonicalizeNest,
  normalizeShip,
  parseChannelNest,
} from '../targets.js';
import { createTlonTelemetry, setOutboundRouteReporter } from '../telemetry.js';
import { resolveTlonAccount } from '../types.js';
import { configureTlonApiWithPoke } from '../urbit/api-client.js';
import { authenticate } from '../urbit/auth.js';
import { ssrfPolicyFromAllowPrivateNetwork } from '../urbit/context.js';
import { describeError } from '../urbit/errors.js';
import type { DmInvite, Foreigns } from '../urbit/foreigns.js';
import { type BotProfile, sendChannelPost, sendDm } from '../urbit/send.js';
import { UrbitSSEClient } from '../urbit/sse-client.js';
import { markdownToStory } from '../urbit/story.js';
import {
  type DisplayContext,
  type PendingApproval,
  createPendingApproval,
  emojiToApprovalAction,
  findPendingApproval,
  formatApprovalConfirmation,
  formatApprovalRequest,
  formatBlockedList,
  formatPendingList,
  isExpired,
  normalizeNotificationId,
  pruneExpired,
  removePendingApproval,
} from './approval.js';
import {
  type ApprovalCommandBridge,
  removeBridge,
  setBridge,
} from './command-bridge.js';
import { createComputingPresenceTracker } from './computing-presence.js';
import { fetchAllChannels, fetchInitData } from './discovery.js';
import {
  buildThreadContextMessage,
  cacheMessage,
  fetchChannelHistory,
  fetchThreadContextHistory,
  getChannelHistory,
  lookupCachedMessage,
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
import {
  type ParsedCite,
  extractCites,
  extractMessageText,
  formatModelName,
  isBotMentioned,
  isDmAllowed,
  isOwnerListenSlashCommand,
  isSummarizationRequest,
  sanitizeMessageText,
  shouldEngageInGroup,
  stripBotMention,
} from './utils.js';

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
};

type ChannelAuthorization = {
  mode?: 'restricted' | 'open';
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

const GATEWAY_STATUS_ACTIVATION_TIMEOUT_MS = 15_000;
const GATEWAY_STATUS_ACTIVATION_RETRY_MS = 30_000;

// Bound an activation poke so a silently-hung promise surfaces as a
// retryable error instead of leaving gateway-status dead for the process
// lifetime. The underlying poke may still settle after the timeout; the
// trailing no-op catch keeps a late rejection from becoming an unhandled
// rejection, and a late duplicate poke is harmless (same bootId/values).
function withActivationTimeout<T>(
  promise: Promise<T>,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      promise.catch(() => {});
      reject(
        new Error(
          `${label} poke timed out after ${GATEWAY_STATUS_ACTIVATION_TIMEOUT_MS}ms`
        )
      );
    }, GATEWAY_STATUS_ACTIVATION_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
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
): { mode: 'restricted' | 'open'; allowedShips: string[] } {
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
  const cfg = core.config.loadConfig();
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
  runtime.log?.(`[tlon] Starting monitor for ${botShipName}`);

  const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(
    account.allowPrivateNetwork
  );

  // Helper to authenticate with retry logic
  async function authenticateWithRetry(maxAttempts = 10): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      if (opts.abortSignal?.aborted) {
        throw new Error('Aborted while waiting to authenticate');
      }
      try {
        runtime.log?.(`[tlon] Attempting authentication to ${accountUrl}...`);
        return await authenticate(accountUrl, accountCode, { ssrfPolicy });
      } catch (error: any) {
        runtime.error?.(
          `[tlon] Failed to authenticate (attempt ${attempt}): ${error?.message ?? String(error)}`
        );
        if (attempt >= maxAttempts) {
          throw error;
        }
        const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
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

  let api: UrbitSSEClient | null = null;
  const cookie = await authenticateWithRetry();
  api = new UrbitSSEClient(account.url, cookie, {
    ship: botShipName,
    ssrfPolicy,
    logger: {
      log: (message) => runtime.log?.(message),
      error: (message) => runtime.error?.(message),
    },
    // Re-authenticate on reconnect in case the session expired
    onReconnect: async (client) => {
      runtime.log?.('[tlon] Re-authenticating on SSE reconnect...');
      const newCookie = await authenticateWithRetry(5);
      client.updateCookie(newCookie);
      runtime.log?.('[tlon] Re-authentication successful');
    },
  });

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

  // gsManager is hoisted here (from its prior location at the
  // gateway-status activation block below) so cleanupGatewayStatus can
  // close over it. getGatewayStatusManager() returns the manager
  // singleton index.ts published during plugin registration; it is
  // null when multi-account or zero-account configs disable the
  // feature (see index.ts registration gate).
  const gsManager = getGatewayStatusManager();

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
    if (gatewayStatusCleanupRan) return;
    gatewayStatusCleanupRan = true;
    gsManager?.stopHeartbeat();
    // Deliberately do NOT call gsManager.markStopped() here. The manager is
    // a process-lifetime singleton (set once in index.ts's registerFull,
    // which does not re-run on config reload) reused across monitor
    // restarts. markStopped() is a one-way latch the gateway_stop hook owns;
    // if monitor teardown set it, a config-reload's replacement monitor
    // would reuse the latched manager, its activation would see stopped and
    // bail, and gateway-status would stay dead until a full gateway restart.
    // Zombie-heartbeat prevention is monitor-local via gatewayStatusCleanupRan
    // (checked in the activation task before startHeartbeat).
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
  // The reviewer's P2: a synchronous throw between slot publication and
  // the inner try at ~line 2719 (constructor, queue setup, bridge
  // setup, channel discovery, future edits in this large pre-try
  // region) would leave the shared slot orphaned. This outer finally
  // catches all of those and runs cleanup unconditionally.
  try {
    const computingPresence = createComputingPresenceTracker({ runtime });

    const processedTracker = createProcessedMessageTracker(2000);
    let groupChannels: string[] = [];
    const channelToGroup = new Map<string, string>();
    let botNickname: string | null = null;
    let botAvatar: string | null = null;

    // Helper to get bot profile for outbound messages
    const getBotProfile = (): BotProfile | undefined =>
      botNickname || botAvatar
        ? { nickname: botNickname || '', avatar: botAvatar || '' }
        : undefined;

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
    let effectiveOwnerShip: string | null = account.ownerShip
      ? normalizeShip(account.ownerShip)
      : null;
    setEffectiveOwnerShip(account.accountId, effectiveOwnerShip);
    let effectiveOwnerListenEnabled: boolean =
      account.ownerListenEnabled ?? true;
    // Canonicalize on every read so an entry stored from a slightly-off user
    // input (e.g. missing "~" or wrong case) still matches incoming nest events.
    const canonicalizeNestList = (list: readonly string[]): string[] => {
      const out = new Set<string>();
      for (const raw of list) {
        const canonical = canonicalizeNest(raw);
        if (canonical) out.add(canonical);
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

    const telemetry = createTlonTelemetry({
      config: account.telemetry,
      runtime,
    });

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

    // Build display context for approval formatting
    function buildDisplayContext(): DisplayContext {
      const channelNames = new Map<string, string>();
      for (const nest of watchedChannels) {
        const parsed = parseChannelNest(nest);
        if (parsed) {
          channelNames.set(nest, parsed.channelName);
        }
      }
      return {
        channelNames,
        groupNames: groupNameCache,
      };
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
      if (currentSettings.groupInviteAllowlist?.length) {
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
    // (gsManager was hoisted to the slot-publish region above so that
    // cleanupGatewayStatus can close over it; we reuse the same captured
    // reference here.)

    if (gsManager && effectiveOwnerShip) {
      const capturedOwnerShip = effectiveOwnerShip;
      const signal = opts.abortSignal;

      // Fire-and-forget: wait for gateway_start signal, then activate.
      // Does NOT block monitor startup — discovery, subscriptions, etc. proceed immediately.
      void (async () => {
        // Named abort handler so it can be removed once the race settles. When
        // the "started" branch wins (every config-reload restart, since
        // waitForGatewayStart() is already resolved on the process-lifetime
        // manager), a bare addEventListener would linger on the host's signal
        // forever — `{ once: true }` only removes it after it fires — retaining
        // this activation closure and the SSE-bound monitor state. Same
        // retention class the outer-finally removeEventListener avoids.
        let onRaceAbort: (() => void) | undefined;
        try {
          const abortRace =
            signal &&
            new Promise<'aborted'>((r) => {
              if (signal.aborted) {
                r('aborted');
                return;
              }
              onRaceAbort = () => r('aborted');
              signal.addEventListener('abort', onRaceAbort, { once: true });
            });
          const raced = await Promise.race([
            gsManager.waitForGatewayStart().then(() => 'started' as const),
            ...(abortRace ? [abortRace] : []),
          ]);
          if (signal && onRaceAbort) {
            signal.removeEventListener('abort', onRaceAbort);
          }
          if (
            raced !== 'started' ||
            gatewayStatusCleanupRan ||
            gsManager.stopped
          ) {
            return;
          }

          // One-shot activation proved fragile: a single silently-hung poke
          // (observed when activation raced an SSE reconnect) left
          // gateway-status dead for the whole process lifetime, so the ship
          // marked the gateway %down and auto-replied "bot is offline" to
          // owner DMs. Retry with a per-attempt timeout until activation
          // sticks or this monitor is torn down.
          for (let attempt = 1; ; attempt += 1) {
            if (
              signal?.aborted ||
              gatewayStatusCleanupRan ||
              gsManager.stopped
            ) {
              return;
            }
            try {
              await withActivationTimeout(
                configureGatewayStatus({
                  owner: capturedOwnerShip,
                  activeWindowSecs: ACTIVE_WINDOW_SECS,
                  offlineReplyCooldownSecs: OFFLINE_REPLY_COOLDOWN_SECS,
                }),
                '%configure'
              );
              // Recheck after each await: this monitor can be torn down
              // (gatewayStatusCleanupRan), the signal can abort, or the gateway can
              // stop (gsManager.stopped) while these pokes are in flight. Without
              // the recheck we would leave a zombie heartbeat interval running.
              // The cleanup flag is monitor-local on purpose — see
              // cleanupGatewayStatus for why we don't latch the shared manager.
              if (
                signal?.aborted ||
                gatewayStatusCleanupRan ||
                gsManager.stopped
              ) {
                return;
              }
              // Mark starting before the %gateway-start poke so a concurrent
              // gateway_stop hook knows a start poke is in flight and sends a
              // matching %gateway-stop even if shutdown lands before markActivated().
              gsManager.markStarting();
              await withActivationTimeout(
                gatewayStart({
                  bootId: gsManager.bootId,
                  leaseUntil: computeLeaseUntil(),
                }),
                '%gateway-start'
              );
              if (
                signal?.aborted ||
                gatewayStatusCleanupRan ||
                gsManager.stopped
              ) {
                return;
              }
              gsManager.markActivated();
              gsManager.startHeartbeat();
              runtime.log?.(
                `[gateway-status] activated (bootId=${gsManager.bootId}, owner=${capturedOwnerShip}, attempt=${attempt})`
              );
              return;
            } catch (err) {
              runtime.error?.(
                `[gateway-status] activation attempt ${attempt} failed: ${String(err)} — retrying in ${GATEWAY_STATUS_ACTIVATION_RETRY_MS / 1000}s`
              );
            }
            await abortableDelay(GATEWAY_STATUS_ACTIVATION_RETRY_MS, signal);
          }
        } catch (err) {
          runtime.error?.(`[gateway-status] start failed: ${String(err)}`);
        }
      })();
    }

    // Run channel discovery AFTER settings are loaded (so settings store value is used)
    if (effectiveAutoDiscoverChannels) {
      try {
        const initData = await fetchInitData(api, runtime);
        if (initData.channels.length > 0) {
          groupChannels = initData.channels;
        }
        // Populate channel-to-group mapping for member hint injection
        for (const [nest, groupFlag] of initData.channelToGroup) {
          channelToGroup.set(nest, groupFlag);
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

    // Helper to resolve cited message content
    async function resolveCiteContent(
      cite: ParsedCite
    ): Promise<string | null> {
      if (cite.type !== 'chan' || !cite.nest || !cite.postId) {
        return null;
      }

      try {
        // Scry for the specific post: /v4/{nest}/posts/post/{postId}
        const scryPath = `/channels/v4/${cite.nest}/posts/post/${cite.postId}.json`;
        runtime.log?.(`[tlon] Fetching cited post: ${scryPath}`);

        const data: any = await api!.scry(scryPath);

        // Extract text from the post's essay content
        if (data?.essay?.content) {
          const text = extractMessageText(data.essay.content);
          return text || null;
        }

        return null;
      } catch (err) {
        runtime.log?.(`[tlon] Failed to fetch cited post: ${String(err)}`);
        return null;
      }
    }

    // Resolve all cites in message content and return quoted text
    async function resolveAllCites(content: unknown): Promise<string> {
      const cites = extractCites(content);
      if (cites.length === 0) {
        return '';
      }

      const resolved: string[] = [];
      for (const cite of cites) {
        const text = await resolveCiteContent(cite);
        if (text) {
          const author = cite.author || 'unknown';
          resolved.push(`> ${author} wrote: ${text}`);
        }
      }

      return resolved.length > 0 ? resolved.join('\n') + '\n\n' : '';
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
        mode: 'restricted',
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
      message: string
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
        const existMsg = formatApprovalRequest(existing, buildDisplayContext());
        const existNotifId = await sendOwnerNotification(existMsg);
        if (existNotifId) {
          existing.notificationMessageId =
            normalizeNotificationId(existNotifId);
        }
        await savePendingApprovals();
        return;
      }

      // Send notification before saving so notificationMessageId is included
      // in the single save. See comment above about the settings subscription race.
      const message = formatApprovalRequest(approval, buildDisplayContext());
      const notifId = await sendOwnerNotification(message);
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
              await processMessage({
                messageId: approval.originalMessage.messageId,
                senderShip: approval.requestingShip,
                messageText: approval.originalMessage.messageText,
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
                await processMessage({
                  messageId: approval.originalMessage.messageId,
                  senderShip: approval.requestingShip,
                  messageText: approval.originalMessage.messageText,
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

      async getPendingList() {
        return formatPendingList(pendingApprovals, buildDisplayContext());
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
      messageContent?: unknown; // Raw Tlon content for media extraction
      blobField?: string | null; // Raw blob JSON from post/reply
      isGroup: boolean;
      channelNest?: string;
      hostShip?: string;
      channelName?: string;
      timestamp: number;
      parentId?: string | null;
      isThreadReply?: boolean;
      replyParentId?: string | null; // Override parentId for delivery only (not in ctx payload)
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
      let messageText = sanitizeMessageText(params.messageText);
      const rawMessageText = messageText; // Preserve original before any modifications

      // Strip bot mention EARLY, before thread context is prepended.
      // This ensures [Current message] in thread context won't contain the bot ship name,
      // which was causing the agent to mistake it for its own message and return NO_REPLY.
      if (isGroup) {
        messageText = stripBotMention(messageText, botShipName);
      }

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
            runtime.log?.(
              `[tlon] Skipped oversized blob attachment(s): ${blobDownloadNotices.join(' | ')}`
            );
          }
          if (blobAttachments.length > 0) {
            attachments = attachments.concat(blobAttachments);
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

      if (isGroup && groupChannel && isSummarizationRequest(messageText)) {
        try {
          const history = await getChannelHistory(
            api,
            groupChannel,
            50,
            runtime
          );
          if (history.length === 0) {
            const noHistoryMsg =
              "I couldn't fetch any messages for this channel. It might be empty or there might be a permissions issue.";
            if (isGroup && groupChannel) {
              await sendChannelPost({
                botProfile: getBotProfile(),
                fromShip: botShipName,
                nest: groupChannel,
                story: markdownToStory(noHistoryMsg),
              });
            } else {
              await sendDm({
                botProfile: getBotProfile(),
                fromShip: botShipName,
                toShip: senderShip,
                text: noHistoryMsg,
              });
            }
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
          if (isGroup && groupChannel) {
            await sendChannelPost({
              botProfile: getBotProfile(),
              fromShip: botShipName,
              nest: groupChannel,
              story: markdownToStory(errorMsg),
            });
          } else {
            await sendDm({
              botProfile: getBotProfile(),
              fromShip: botShipName,
              toShip: senderShip,
              text: errorMsg,
            });
          }
          return;
        }
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
      // Store role for before_tool_call hook (tool access control)
      setSessionRole(route.sessionKey, senderRole);
      runtime.log?.(
        `[tlon] Stored session role: sessionKey=${route.sessionKey}, role=${senderRole}`
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
        ? stripBotMention(rawMessageText, botShipName)
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
      // records the route before dispatch and fails open — never blocks the
      // reply.
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
      const replyTelemetry = telemetry?.startReply({
        sessionKey: route.sessionKey,
        ownerShip: effectiveOwnerShip,
        botShip: botShipName,
        chatType: isGroup ? 'groupChannel' : 'dm',
        isThreadReply: Boolean(isThreadReply),
        senderRole,
        attachmentCount,
      });
      let selectedProvider: string | null = null;
      let selectedModel: string | null = null;
      let selectedThinkLevel: string | null = null;
      let deliveredMessageCount = 0;
      let replyCharCount = 0;
      let replyWordCount = 0;
      let replyMediaCount = 0;

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
            start: async () => {
              await computingPresence.refreshRun({
                conversationId: presenceConversationId,
                runId: presenceRunId,
              });
            },
            stop: async () => {
              await computingPresence.stopRun({
                conversationId: presenceConversationId,
                runId: presenceRunId,
              });
            },
            onStartError: (err: unknown) => {
              runtime.error?.(
                `[tlon] Failed to start computing presence for ${presenceConversationId}: ${
                  err instanceof Error ? err.stack ?? err.message : String(err)
                }`
              );
            },
            onStopError: (err: unknown) => {
              runtime.error?.(
                `[tlon] Failed to stop computing presence for ${presenceConversationId}: ${
                  err instanceof Error ? err.stack ?? err.message : String(err)
                }`
              );
            },
            keepaliveIntervalMs: 20_000,
            // The SDK default TTL (60s) fires stopRun mid-dispatch and seals the
            // callbacks, killing the thinking indicator for the rest of long
            // runs. stopRun is already wired to deliver/idle/cleanup.
            maxDurationMs: 0,
            // The SDK default (2) trips the keepalive permanently after two
            // transient poke failures, which lets the ship-side presence expire
            // mid-run. Failures are already logged via onStartError.
            maxConsecutiveFailures: 5,
          })
        : undefined;

      const replyOptions: NonNullable<
        Parameters<
          typeof core.channel.reply.dispatchReplyWithBufferedBlockDispatcher
        >[0]['replyOptions']
      > = {
        onModelSelected: ({ provider, model, thinkLevel }) => {
          selectedProvider = provider;
          selectedModel = model;
          selectedThinkLevel = thinkLevel ?? null;
        },
        ...(presenceConversationId
          ? {
              onAssistantMessageStart: async () => {
                await computingPresence.clearToolCalls({
                  conversationId: presenceConversationId,
                  runId: presenceRunId,
                });
              },
              onToolStart: async (payload) => {
                await computingPresence.addToolCall({
                  conversationId: presenceConversationId,
                  runId: presenceRunId,
                  toolName: payload.name,
                });
              },
            }
          : {}),
      };

      let dispatchResult:
        | {
            queuedFinal: boolean;
            counts: Record<string, number>;
          }
        | undefined;
      let dispatchError: unknown;

      try {
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
            core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: ctxPayload,
              cfg,
              replyOptions,
              dispatcherOptions: {
                responsePrefix,
                humanDelay,
                typingCallbacks,
                deliver: async (payload: ReplyPayload) => {
                  let replyText = payload.text;
                  if (!replyText) {
                    return;
                  }

                  // Process any block directives in the response (strips them from text)
                  replyText = await processBlockDirectives(
                    replyText,
                    senderShip
                  );
                  if (!replyText) {
                    return;
                  } // Response was only a directive

                  // Use settings store value if set, otherwise fall back to file config
                  const showSignature = effectiveShowModelSig;
                  if (showSignature) {
                    const modelCfg = cfg.agents?.defaults?.model;
                    const modelInfo =
                      selectedModel ||
                      (payload as { metadata?: { model?: string } }).metadata
                        ?.model ||
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
                    const count = consecutiveBotMessages.get(groupChannel) ?? 0;
                    if (maxBotResponses > 0 && count === maxBotResponses) {
                      const otherBot = formatShipWithNickname(senderShip);
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

                  if (isGroup && groupChannel) {
                    // Send to any channel type (chat, heap, diary) using the nest directly
                    await sendChannelPost({
                      botProfile: getBotProfile(),
                      fromShip: botShipName,
                      nest: groupChannel,
                      story: markdownToStory(replyText),
                      replyToId: deliverParentId ?? undefined,
                    });
                    // Track thread participation for future replies without mention
                    if (deliverParentId) {
                      participatedThreads.add(String(deliverParentId));
                      runtime.log?.(
                        `[tlon] Now tracking thread for future replies: ${deliverParentId}`
                      );
                    }
                  } else {
                    await sendDm({
                      botProfile: getBotProfile(),
                      fromShip: botShipName,
                      toShip: senderShip,
                      text: replyText,
                      replyToId: deliverParentId
                        ? String(deliverParentId)
                        : undefined,
                    });
                  }

                  if (presenceConversationId) {
                    await computingPresence.stopRun({
                      conversationId: presenceConversationId,
                      runId: presenceRunId,
                    });
                  }

                  deliveredMessageCount += 1;
                  replyCharCount += replyText.length;
                  replyWordCount += replyText.trim()
                    ? replyText.trim().split(/\s+/).length
                    : 0;
                  replyMediaCount += Array.isArray(payload.mediaUrls)
                    ? payload.mediaUrls.length
                    : payload.mediaUrl
                      ? 1
                      : 0;
                },
                onError: (err, info) => {
                  const dispatchDuration = Date.now() - dispatchStartTime;
                  runtime.error?.(
                    `[tlon] ${info.kind} reply failed after ${dispatchDuration}ms: ${String(err)}`
                  );
                },
              },
            }),
        });
      } catch (error) {
        dispatchError = error;
        throw error;
      } finally {
        await replyTelemetry?.capture({
          deliveredMessageCount,
          replyCharCount,
          replyWordCount,
          replyMediaCount,
          dispatchDurationMs: Date.now() - dispatchStartTime,
          queuedFinal: dispatchResult?.queuedFinal ?? false,
          queuedFinalCount: dispatchResult?.counts.final ?? 0,
          queuedBlockCount: dispatchResult?.counts.block ?? 0,
          provider: selectedProvider,
          model: selectedModel,
          thinkLevel: selectedThinkLevel,
          dispatchError,
        });
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
          const postId = replyReacts
            ? response?.post?.['r-post']?.reply?.id ??
              response?.post?.id ??
              'unknown'
            : response?.post?.id ?? 'unknown';
          for (const [reactShip, reactEmoji] of Object.entries(
            effectiveReacts as Record<string, string>
          )) {
            const ship = normalizeShip(reactShip);
            if (!ship || ship === botShipName) {
              continue;
            }
            try {
              const route = core.channel.routing.resolveAgentRoute({
                cfg,
                channel: 'tlon',
                accountId: opts.accountId ?? undefined,
                peer: { kind: 'group', id: nest },
              });
              // Look up the reacted-to message content for context
              const cached = lookupCachedMessage(nest, postId);
              const contentSnippet = cached?.content
                ? ` (message: "${cached.content.substring(0, 200)}${cached.content.length > 200 ? '...' : ''}")`
                : '';
              const authorInfo = cached?.author
                ? ` (by ${formatShipWithNickname(cached.author)})`
                : '';
              const reactorDisplay = formatShipWithNickname(ship);
              const eventText = `Tlon reaction in ${nest}: ${reactEmoji} by ${reactorDisplay} on post ${postId}${authorInfo}${contentSnippet}`;
              runtime.log?.(`[tlon] REACTION: ${eventText}`);

              // If reacting to the bot's own message, dispatch as a real message
              // so the agent runs immediately (e.g. thumbs-up as "yes")
              if (cached?.author === botShipName) {
                // Include context so agent knows what was reacted to, since we're
                // deliberately omitting thread context (parentId) to avoid the agent
                // suppressing responses when it sees its own message in thread history.
                const reactionParentId = replyReacts
                  ? response?.post?.id ?? postId
                  : postId;
                const reactText = cached?.content
                  ? `${reactEmoji} (reacting to: "${cached.content}")`
                  : reactEmoji;
                runtime.log?.(
                  `[tlon] Dispatching channel reaction as message: ${reactEmoji} from ${ship}`
                );
                const parsed = parseChannelNest(nest);
                await processMessage({
                  messageId: `react-${postId}-${ship}-${Date.now()}`,
                  senderShip: ship,
                  messageText: reactText,
                  isGroup: true,
                  channelNest: nest,
                  hostShip: parsed?.hostShip,
                  channelName: parsed?.channelName,
                  timestamp: Date.now(),
                  replyParentId: reactionParentId, // Thread reply for delivery only
                });
              } else {
                // For reactions on other people's messages, just enqueue as system event
                core.system.enqueueSystemEvent(eventText, {
                  sessionKey: route.sessionKey,
                  contextKey: `tlon:reaction:${nest}:${postId}:${reactEmoji}:${ship}`,
                  // Route any resulting system/heartbeat turn back to Tlon.
                  deliveryContext: tlonDeliveryContext(
                    `tlon:${nest}`,
                    route.accountId
                  ),
                });
              }
            } catch (err: any) {
              runtime.error?.(
                `[tlon] Error handling reaction: ${err?.message ?? String(err)}`
              );
            }
          }
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

        // Resolve any cited/quoted messages first
        const citedContent = await resolveAllCites(content.content);
        const rawText = extractMessageText(content.content);
        const messageText = citedContent + rawText;
        const hasBlob = Boolean((content as any)?.blob);
        if (!messageText.trim() && !hasBlob) {
          return;
        }

        // Cache ALL messages (including bot's own) so reaction lookups have context
        cacheMessage(nest, {
          author: senderShip,
          content: messageText,
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
          await sendChannelPost({
            botProfile: getBotProfile(),
            fromShip: botShipName,
            nest,
            story: markdownToStory(replyText),
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
        const mentioned = isBotMentioned(
          messageText,
          botShipName,
          botNickname ?? undefined
        );
        const inParticipatedThread = Boolean(
          isThreadReply && parentId && participatedThreads.has(String(parentId))
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
          return;
        }

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
          if (mode === 'restricted') {
            const normalizedAllowed = allowedShips.map(normalizeShip);
            if (!normalizedAllowed.includes(senderShip)) {
              // If owner is configured, queue approval request
              if (effectiveOwnerShip) {
                const approval = createPendingApproval(
                  {
                    type: 'channel',
                    requestingShip: senderShip,
                    channelNest: nest,
                    messagePreview: messageText.substring(0, 100),
                    originalMessage: {
                      messageId: messageId ?? '',
                      messageText,
                      messageContent: content.content,
                      timestamp: content.sent || Date.now(),
                      parentId: parentId ?? undefined,
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
        await processMessage({
          messageId: messageId ?? '',
          senderShip,
          messageText,
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
                  isGroup: false,
                  timestamp: Date.now(),
                  replyParentId: messageId, // Thread reply for delivery only
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

        // Cache DM messages (including bot's own) so reaction lookups have context
        const dmCacheKey = `dm/${whom}`;
        const rawCacheText = extractMessageText(dmContent.content);
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

        // Resolve any cited/quoted messages first
        const citedContent = await resolveAllCites(dmContent.content);
        const rawText = extractMessageText(dmContent.content);
        const messageText = citedContent + rawText;
        const hasBlob = Boolean((dmContent as any)?.blob);
        if (!messageText.trim() && !hasBlob) {
          return;
        }

        // Owner is always allowed to DM (bypass allowlist)
        if (isOwner(senderShip)) {
          runtime.log?.(
            `[tlon] Processing DM from owner ${senderShip}${isDmThreadReply ? ` (thread reply, parent=${dmReplyParentId}, replyId=${effectiveMessageId})` : ''}`
          );
          await processMessage({
            messageId: effectiveMessageId ?? '',
            senderShip,
            messageText,
            messageContent: dmContent.content,
            blobField: dmContent.blob,
            isGroup: false,
            timestamp: dmContent.sent || Date.now(),
            parentId: dmReplyParentId,
            isThreadReply: isDmThreadReply,
          });
          return;
        }

        // For DMs from others, check allowlist
        if (!isDmAllowed(senderShip, effectiveDmAllowlist)) {
          // If owner is configured, queue approval request
          if (effectiveOwnerShip) {
            const approval = createPendingApproval(
              {
                type: 'dm',
                requestingShip: senderShip,
                messagePreview: messageText.substring(0, 100),
                originalMessage: {
                  messageId: effectiveMessageId ?? '',
                  messageText,
                  messageContent: dmContent.content,
                  timestamp: dmContent.sent || Date.now(),
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

        await processMessage({
          messageId: effectiveMessageId ?? '',
          senderShip,
          messageText,
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
          runtime.error?.(`[tlon] Channels firehose error: ${String(error)}`);
        },
        quit: () => {
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
          runtime.error?.(`[tlon] Chat firehose error: ${String(error)}`);
        },
        quit: () => {
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

      // Subscribe to settings store for hot-reloading config
      const applySettingsSnapshot = (
        newSettings: TlonSettingsStore,
        source: 'subscription' | 'refresh',
        opts: { fresh?: boolean } = {}
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

        // Update group invite allowlist
        if (newSettings.groupInviteAllowlist !== undefined) {
          effectiveGroupInviteAllowlist =
            newSettings.groupInviteAllowlist.length > 0
              ? newSettings.groupInviteAllowlist
              : account.groupInviteAllowlist;
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
          source === 'subscription' || opts.fresh === true;
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

      // Subscribe to groups-ui for real-time channel additions (when invites are accepted)
      try {
        await api.subscribe({
          app: 'groups',
          path: '/groups/ui',
          event: async (event: any) => {
            try {
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

                    // If this is a new channel we're not watching yet, add it
                    if (!watchedChannels.has(channelNest)) {
                      watchedChannels.add(channelNest);
                      runtime.log?.(
                        `[tlon] Auto-detected new channel (invite accepted): ${channelNest}`
                      );

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
          const refreshResult = await settingsManager.load();
          applySettingsSnapshot(refreshResult.settings, 'refresh', {
            fresh: refreshResult.fresh,
          });
        } catch (err) {
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
