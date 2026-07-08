/**
 * Settings Store integration for hot-reloading Tlon plugin config.
 *
 * Settings are stored in Urbit's %settings agent under:
 *   desk: "moltbot"
 *   bucket: "tlon"
 *
 * This allows config changes via poke from any Landscape client
 * without requiring a gateway restart.
 */
import type { PendingNudge } from './pending-nudge.js';
import type { UrbitSSEClient } from './urbit/sse-client.js';

/** Pending approval request stored for persistence */
export type PendingApproval = {
  id: string;
  type: 'dm' | 'channel' | 'group';
  requestingShip: string;
  channelNest?: string;
  groupFlag?: string;
  /** Human-readable group title from invite preview */
  groupTitle?: string;
  messagePreview?: string;
  /** Full message context for processing after approval */
  originalMessage?: {
    messageId: string;
    messageText: string;
    messageContent: unknown;
    timestamp: number;
    parentId?: string;
    parentAuthorId?: string;
    isThreadReply?: boolean;
    blob?: string;
  };
  timestamp: number;
  /** Normalized message ID of the owner notification DM (for reaction-based approval) */
  notificationMessageId?: string;
};

export type TlonSettingsStore = {
  groupChannels?: string[];
  dmAllowlist?: string[];
  autoDiscover?: boolean;
  showModelSig?: boolean;
  autoAcceptDmInvites?: boolean;
  autoDiscoverChannels?: boolean;
  autoAcceptGroupInvites?: boolean;
  /** Ships allowed to invite us to groups (when autoAcceptGroupInvites is true) */
  groupInviteAllowlist?: string[];
  channelRules?: Record<
    string,
    {
      mode?: 'restricted' | 'allowlist' | 'open';
      allowedShips?: string[];
    }
  >;
  defaultAuthorizedShips?: string[];
  /** Ship that receives approval requests for DMs, channel mentions, and group invites */
  ownerShip?: string;
  /** Pending approval requests awaiting owner response */
  pendingApprovals?: PendingApproval[];
  /** Epoch ms timestamp of the last message received from the owner ship */
  lastOwnerMessageAt?: number;
  /** ISO date (YYYY-MM-DD) of the last owner message — human-readable for LLM heartbeat checks */
  lastOwnerMessageDate?: string;
  /** Pending heartbeat nudge attribution awaiting owner re-engagement */
  pendingNudge?: PendingNudge;
  /** Last nudge stage written by heartbeat flow (1, 2, or 3) */
  lastNudgeStage?: PendingNudge['stage'];
  /** Active-hours window start ("HH:MM") for the nudge scheduler */
  nudgeActiveHoursStart?: string;
  /** Active-hours window end ("HH:MM") for the nudge scheduler */
  nudgeActiveHoursEnd?: string;
  /** Timezone for the nudge active-hours window: "user", "local", or an IANA TZ id */
  nudgeActiveHoursTimezone?: string;
  /** Global toggle for the owner-listen path (default true). */
  ownerListenEnabled?: boolean;
  /** Channels opted out of owner-listen even when the global toggle is on. */
  ownerListenDisabledChannels?: string[];
};

export type TlonSettingsState = {
  current: TlonSettingsStore;
  loaded: boolean;
};

const SETTINGS_DESK = 'moltbot';
const SETTINGS_BUCKET = 'tlon';
export const APPROVAL_TTL_MS = 48 * 60 * 60 * 1000;
/** Sentinel preview used for DM-invite approvals that have no message body yet. */
export const DM_INVITE_PREVIEW = '(DM invite - no message yet)';

function isPendingApprovalExpired(
  approval: PendingApproval,
  now = Date.now()
): boolean {
  return now - approval.timestamp > APPROVAL_TTL_MS;
}

function hasUsableOriginalMessage(approval: PendingApproval): boolean {
  if (approval.type === 'group') {
    return true;
  }
  if (approval.type === 'dm' && approval.messagePreview === DM_INVITE_PREVIEW) {
    return true;
  }

  const message = approval.originalMessage;
  return Boolean(
    message &&
    typeof message.messageId === 'string' &&
    typeof message.messageText === 'string' &&
    typeof message.timestamp === 'number'
  );
}

function summarizePendingApproval(
  approval: PendingApproval
): Record<string, unknown> {
  return {
    id: approval.id,
    type: approval.type,
    requestingShip: approval.requestingShip,
    ...(approval.channelNest ? { channelNest: approval.channelNest } : {}),
    ...(approval.groupFlag ? { groupFlag: approval.groupFlag } : {}),
    timestamp: approval.timestamp,
    ...(approval.notificationMessageId
      ? { notificationMessageId: approval.notificationMessageId }
      : {}),
  };
}

function summarizeSettingsForLog(
  settings: TlonSettingsStore
): Record<string, unknown> {
  const pendingApprovals = settings.pendingApprovals ?? [];
  return {
    ...(settings.groupChannels
      ? { groupChannels: settings.groupChannels.length }
      : {}),
    ...(settings.dmAllowlist
      ? { dmAllowlist: settings.dmAllowlist.length }
      : {}),
    ...(settings.autoDiscover !== undefined
      ? { autoDiscover: settings.autoDiscover }
      : {}),
    ...(settings.showModelSig !== undefined
      ? { showModelSig: settings.showModelSig }
      : {}),
    ...(settings.autoAcceptDmInvites !== undefined
      ? { autoAcceptDmInvites: settings.autoAcceptDmInvites }
      : {}),
    ...(settings.autoDiscoverChannels !== undefined
      ? { autoDiscoverChannels: settings.autoDiscoverChannels }
      : {}),
    ...(settings.autoAcceptGroupInvites !== undefined
      ? { autoAcceptGroupInvites: settings.autoAcceptGroupInvites }
      : {}),
    ...(settings.groupInviteAllowlist
      ? { groupInviteAllowlist: settings.groupInviteAllowlist.length }
      : {}),
    ...(settings.channelRules
      ? { channelRules: Object.keys(settings.channelRules).length }
      : {}),
    ...(settings.defaultAuthorizedShips
      ? { defaultAuthorizedShips: settings.defaultAuthorizedShips.length }
      : {}),
    ...(settings.ownerShip ? { ownerShip: settings.ownerShip } : {}),
    ...(pendingApprovals.length
      ? { pendingApprovals: pendingApprovals.map(summarizePendingApproval) }
      : { pendingApprovals: 0 }),
    ...(settings.lastOwnerMessageAt !== undefined
      ? { lastOwnerMessageAt: settings.lastOwnerMessageAt }
      : {}),
    ...(settings.lastOwnerMessageDate
      ? { lastOwnerMessageDate: settings.lastOwnerMessageDate }
      : {}),
    ...(settings.pendingNudge
      ? {
          pendingNudge: {
            sentAt: settings.pendingNudge.sentAt,
            stage: settings.pendingNudge.stage,
            ownerShip: settings.pendingNudge.ownerShip,
            accountId: settings.pendingNudge.accountId,
          },
        }
      : {}),
    ...(settings.lastNudgeStage !== undefined
      ? { lastNudgeStage: settings.lastNudgeStage }
      : {}),
    ...(settings.nudgeActiveHoursStart
      ? { nudgeActiveHoursStart: settings.nudgeActiveHoursStart }
      : {}),
    ...(settings.nudgeActiveHoursEnd
      ? { nudgeActiveHoursEnd: settings.nudgeActiveHoursEnd }
      : {}),
    ...(settings.nudgeActiveHoursTimezone
      ? { nudgeActiveHoursTimezone: settings.nudgeActiveHoursTimezone }
      : {}),
    ...(settings.ownerListenEnabled !== undefined
      ? { ownerListenEnabled: settings.ownerListenEnabled }
      : {}),
    ...(settings.ownerListenDisabledChannels
      ? {
          ownerListenDisabledChannels:
            settings.ownerListenDisabledChannels.length,
        }
      : {}),
  };
}

function formatSettingsForLog(settings: TlonSettingsStore): string {
  return JSON.stringify(summarizeSettingsForLog(settings));
}

function formatSettingsUpdateValueForLog(key: string, value: unknown): string {
  if (key === 'pendingApprovals') {
    const approvals = parsePendingApprovals(value) ?? [];
    return JSON.stringify({
      count: approvals.length,
      items: approvals.map(summarizePendingApproval),
    });
  }
  return JSON.stringify(value);
}

/**
 * Parse channelRules - handles both JSON string and object formats.
 * Settings-store doesn't support nested objects, so we store as JSON string.
 */
function parseChannelRules(
  value: unknown
):
  | Record<
      string,
      { mode?: 'restricted' | 'allowlist' | 'open'; allowedShips?: string[] }
    >
  | undefined {
  if (!value) {
    return undefined;
  }

  // If it's a string, try to parse as JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (isChannelRulesObject(parsed)) {
        return parsed;
      }
    } catch {
      return undefined;
    }
  }

  // If it's already an object, use directly
  if (isChannelRulesObject(value)) {
    return value;
  }

  return undefined;
}

/**
 * Parse pendingNudge — handles both JSON string and object formats.
 * Settings-store stores complex objects as JSON strings.
 */
function parsePendingNudge(value: unknown): PendingNudge | undefined {
  if (!value) {
    return undefined;
  }

  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.sentAt !== 'number' ||
    typeof obj.ownerShip !== 'string' ||
    typeof obj.accountId !== 'string' ||
    !(obj.stage === 1 || obj.stage === 2 || obj.stage === 3)
  ) {
    return undefined;
  }

  const base: PendingNudge = {
    sentAt: obj.sentAt,
    stage: obj.stage,
    ownerShip: obj.ownerShip,
    accountId: obj.accountId,
  };
  if (typeof obj.content === 'string') {
    base.content = obj.content;
  }
  return base;
}

/**
 * Parse lastNudgeStage — accepts number or numeric string, must be 1, 2, or 3.
 */
function parseLastNudgeStage(
  value: unknown
): PendingNudge['stage'] | undefined {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num === 1 || num === 2 || num === 3) {
    return num;
  }
  return undefined;
}

/**
 * Parse settings from the raw Urbit settings-store response.
 * The response shape is: { [bucket]: { [key]: value } }
 */
export function parseSettingsResponse(raw: unknown): TlonSettingsStore {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const desk = raw as Record<string, unknown>;
  const bucket = desk[SETTINGS_BUCKET];
  if (!bucket || typeof bucket !== 'object') {
    return {};
  }

  const settings = bucket as Record<string, unknown>;

  return {
    groupChannels: Array.isArray(settings.groupChannels)
      ? settings.groupChannels.filter((x): x is string => typeof x === 'string')
      : undefined,
    dmAllowlist: Array.isArray(settings.dmAllowlist)
      ? settings.dmAllowlist.filter((x): x is string => typeof x === 'string')
      : undefined,
    autoDiscover:
      typeof settings.autoDiscover === 'boolean'
        ? settings.autoDiscover
        : undefined,
    autoDiscoverChannels:
      typeof settings.autoDiscoverChannels === 'boolean'
        ? settings.autoDiscoverChannels
        : undefined,
    showModelSig:
      typeof settings.showModelSig === 'boolean'
        ? settings.showModelSig
        : undefined,
    autoAcceptDmInvites:
      typeof settings.autoAcceptDmInvites === 'boolean'
        ? settings.autoAcceptDmInvites
        : undefined,
    autoAcceptGroupInvites:
      typeof settings.autoAcceptGroupInvites === 'boolean'
        ? settings.autoAcceptGroupInvites
        : undefined,
    groupInviteAllowlist: Array.isArray(settings.groupInviteAllowlist)
      ? settings.groupInviteAllowlist.filter(
          (x): x is string => typeof x === 'string'
        )
      : undefined,
    channelRules: parseChannelRules(settings.channelRules),
    defaultAuthorizedShips: Array.isArray(settings.defaultAuthorizedShips)
      ? settings.defaultAuthorizedShips.filter(
          (x): x is string => typeof x === 'string'
        )
      : undefined,
    ownerShip:
      typeof settings.ownerShip === 'string' ? settings.ownerShip : undefined,
    pendingApprovals: parsePendingApprovals(settings.pendingApprovals),
    lastOwnerMessageAt:
      typeof settings.lastOwnerMessageAt === 'number'
        ? settings.lastOwnerMessageAt
        : undefined,
    lastOwnerMessageDate:
      typeof settings.lastOwnerMessageDate === 'string'
        ? settings.lastOwnerMessageDate
        : undefined,
    pendingNudge: parsePendingNudge(settings.pendingNudge),
    lastNudgeStage: parseLastNudgeStage(settings.lastNudgeStage),
    nudgeActiveHoursStart:
      typeof settings.nudgeActiveHoursStart === 'string'
        ? settings.nudgeActiveHoursStart
        : undefined,
    nudgeActiveHoursEnd:
      typeof settings.nudgeActiveHoursEnd === 'string'
        ? settings.nudgeActiveHoursEnd
        : undefined,
    nudgeActiveHoursTimezone:
      typeof settings.nudgeActiveHoursTimezone === 'string'
        ? settings.nudgeActiveHoursTimezone
        : undefined,
    ownerListenEnabled:
      typeof settings.ownerListenEnabled === 'boolean'
        ? settings.ownerListenEnabled
        : undefined,
    ownerListenDisabledChannels: Array.isArray(
      settings.ownerListenDisabledChannels
    )
      ? settings.ownerListenDisabledChannels.filter(
          (x): x is string => typeof x === 'string'
        )
      : undefined,
  };
}

function isChannelRulesObject(
  val: unknown
): val is Record<
  string,
  { mode?: 'restricted' | 'allowlist' | 'open'; allowedShips?: string[] }
> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    return false;
  }
  for (const [, rule] of Object.entries(val)) {
    if (!rule || typeof rule !== 'object') {
      return false;
    }
  }
  return true;
}

/**
 * Parse pendingApprovals - handles both JSON string and array formats.
 * Settings-store stores complex objects as JSON strings.
 */
function parsePendingApprovals(value: unknown): PendingApproval[] | undefined {
  if (!value) {
    return undefined;
  }

  // If it's a string, try to parse as JSON
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  // Validate it's an array
  if (!Array.isArray(parsed)) {
    return undefined;
  }

  // Filter to valid, unexpired PendingApproval objects.
  return parsed.filter((item): item is PendingApproval => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const obj = item as Record<string, unknown>;
    const valid =
      typeof obj.id === 'string' &&
      (obj.type === 'dm' || obj.type === 'channel' || obj.type === 'group') &&
      typeof obj.requestingShip === 'string' &&
      typeof obj.timestamp === 'number';

    const approval = obj as PendingApproval;
    return (
      valid &&
      hasUsableOriginalMessage(approval) &&
      !isPendingApprovalExpired(approval)
    );
  });
}

/**
 * Parse a single settings entry update event.
 */
function parseSettingsEvent(
  event: unknown
): { key: string; value: unknown } | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  let evt = event as Record<string, unknown>;

  // Unwrap "settings-event" wrapper if present
  if (evt['settings-event'] && typeof evt['settings-event'] === 'object') {
    evt = evt['settings-event'] as Record<string, unknown>;
  }

  // Handle put-entry events
  if (evt['put-entry']) {
    const put = evt['put-entry'] as Record<string, unknown>;
    if (put.desk !== SETTINGS_DESK || put['bucket-key'] !== SETTINGS_BUCKET) {
      return null;
    }
    return {
      key: String(put['entry-key'] ?? ''),
      value: put.value,
    };
  }

  // Handle del-entry events
  if (evt['del-entry']) {
    const del = evt['del-entry'] as Record<string, unknown>;
    if (del.desk !== SETTINGS_DESK || del['bucket-key'] !== SETTINGS_BUCKET) {
      return null;
    }
    return {
      key: String(del['entry-key'] ?? ''),
      value: undefined,
    };
  }

  return null;
}

/**
 * Apply a single settings update to the current state.
 */
export function applySettingsUpdate(
  current: TlonSettingsStore,
  key: string,
  value: unknown
): TlonSettingsStore {
  const next = { ...current };

  switch (key) {
    case 'groupChannels':
      next.groupChannels = Array.isArray(value)
        ? value.filter((x): x is string => typeof x === 'string')
        : undefined;
      break;
    case 'dmAllowlist':
      next.dmAllowlist = Array.isArray(value)
        ? value.filter((x): x is string => typeof x === 'string')
        : undefined;
      break;
    case 'autoDiscover':
      next.autoDiscover = typeof value === 'boolean' ? value : undefined;
      break;
    case 'autoDiscoverChannels':
      next.autoDiscoverChannels =
        typeof value === 'boolean' ? value : undefined;
      break;
    case 'showModelSig':
      next.showModelSig = typeof value === 'boolean' ? value : undefined;
      break;
    case 'autoAcceptDmInvites':
      next.autoAcceptDmInvites = typeof value === 'boolean' ? value : undefined;
      break;
    case 'autoAcceptGroupInvites':
      next.autoAcceptGroupInvites =
        typeof value === 'boolean' ? value : undefined;
      break;
    case 'groupInviteAllowlist':
      next.groupInviteAllowlist = Array.isArray(value)
        ? value.filter((x): x is string => typeof x === 'string')
        : undefined;
      break;
    case 'channelRules':
      next.channelRules = parseChannelRules(value);
      break;
    case 'defaultAuthorizedShips':
      next.defaultAuthorizedShips = Array.isArray(value)
        ? value.filter((x): x is string => typeof x === 'string')
        : undefined;
      break;
    case 'ownerShip':
      next.ownerShip = typeof value === 'string' ? value : undefined;
      break;
    case 'pendingApprovals':
      next.pendingApprovals = parsePendingApprovals(value);
      break;
    case 'lastOwnerMessageAt':
      next.lastOwnerMessageAt = typeof value === 'number' ? value : undefined;
      break;
    case 'lastOwnerMessageDate':
      next.lastOwnerMessageDate = typeof value === 'string' ? value : undefined;
      break;
    case 'pendingNudge':
      next.pendingNudge = parsePendingNudge(value);
      break;
    case 'lastNudgeStage':
      next.lastNudgeStage = parseLastNudgeStage(value);
      break;
    case 'nudgeActiveHoursStart':
      next.nudgeActiveHoursStart =
        typeof value === 'string' ? value : undefined;
      break;
    case 'nudgeActiveHoursEnd':
      next.nudgeActiveHoursEnd = typeof value === 'string' ? value : undefined;
      break;
    case 'nudgeActiveHoursTimezone':
      next.nudgeActiveHoursTimezone =
        typeof value === 'string' ? value : undefined;
      break;
    case 'ownerListenEnabled':
      next.ownerListenEnabled = typeof value === 'boolean' ? value : undefined;
      break;
    case 'ownerListenDisabledChannels':
      next.ownerListenDisabledChannels = Array.isArray(value)
        ? value.filter((x): x is string => typeof x === 'string')
        : undefined;
      break;
  }

  return next;
}

export type SettingsLogger = {
  log?: (msg: string) => void;
  error?: (msg: string) => void;
};

/**
 * Create a settings store subscription manager.
 *
 * Usage:
 *   const settings = createSettingsManager(api, logger);
 *   await settings.load();
 *   settings.subscribe((newSettings) => { ... });
 */
export function createSettingsManager(
  api: UrbitSSEClient,
  logger?: SettingsLogger
) {
  const state: TlonSettingsState = {
    current: {},
    loaded: false,
  };

  const listeners = new Set<(settings: TlonSettingsStore) => void>();

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener(state.current);
      } catch (err) {
        logger?.error?.(`[settings] Listener error: ${String(err)}`);
      }
    }
  };

  return {
    /**
     * Get current settings (may be empty if not loaded yet).
     */
    get current(): TlonSettingsStore {
      return state.current;
    },

    /**
     * Whether initial settings have been loaded.
     */
    get loaded(): boolean {
      return state.loaded;
    },

    /**
     * Load initial settings via scry.
     */
    async load(): Promise<{ settings: TlonSettingsStore; fresh: boolean }> {
      try {
        const raw = await api.scry('/settings/all.json');
        // Response shape: { all: { [desk]: { [bucket]: { [key]: value } } } }
        const allData = raw as {
          all?: Record<string, Record<string, unknown>>;
        };
        const deskData = allData?.all?.[SETTINGS_DESK];
        state.current = parseSettingsResponse(deskData ?? {});
        state.loaded = true;
        logger?.log?.(
          `[settings] Loaded: ${formatSettingsForLog(state.current)}`
        );
        return { settings: state.current, fresh: true };
      } catch (err) {
        // Preserve the last good snapshot on scry failure so refresh fallback
        // does not transiently clobber live runtime state with an empty object.
        logger?.log?.(
          `[settings] Load failed (keeping previous settings): ${String(err)}`
        );
        state.loaded = true;
        return { settings: state.current, fresh: false };
      }
    },

    /**
     * Subscribe to settings changes.
     */
    async startSubscription(): Promise<void> {
      await api.subscribe({
        app: 'settings',
        path: '/desk/' + SETTINGS_DESK,
        event: (event) => {
          const update = parseSettingsEvent(event);
          if (!update) {
            return;
          }

          logger?.log?.(
            `[settings] Update: ${update.key} = ${formatSettingsUpdateValueForLog(
              update.key,
              update.value
            )}`
          );
          state.current = applySettingsUpdate(
            state.current,
            update.key,
            update.value
          );
          notify();
        },
        err: (error) => {
          logger?.error?.(`[settings] Subscription error: ${String(error)}`);
        },
        quit: () => {
          logger?.log?.('[settings] Subscription ended');
        },
      });
      logger?.log?.('[settings] Subscribed to settings updates');
    },

    /**
     * Register a listener for settings changes.
     */
    onChange(listener: (settings: TlonSettingsStore) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
