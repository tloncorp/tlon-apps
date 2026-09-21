import { A2UI } from '@tloncorp/api';
import { randomUUID } from 'node:crypto';

/**
 * Approval system for managing DM, channel mention, and group invite approvals.
 *
 * When an unknown ship tries to interact with the bot, the owner receives
 * a notification and can approve or deny the request via slash commands
 * (/allow, /reject, /ban).
 */
import { APPROVAL_TTL_MS, type PendingApproval } from '../settings.js';
import { type TlonA2UIBlob, makeA2UIBlob } from '../urbit/blob.js';

export type { PendingApproval };
export { APPROVAL_TTL_MS };

export type ApprovalType = 'dm' | 'channel' | 'group';

function assertNever(value: never): never {
  throw new Error(`Unexpected approval type: ${String(value)}`);
}

export type CreateApprovalParams = {
  type: ApprovalType;
  requestingShip: string;
  channelNest?: string;
  groupFlag?: string;
  groupTitle?: string;
  messagePreview?: string;
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
};

export function formatApprovalRequestNotification(
  approval: Pick<
    PendingApproval,
    'type' | 'requestingShip' | 'groupFlag' | 'groupTitle'
  >,
  ctx?: DisplayContext
): string {
  const ship = displayShipWithId(approval.requestingShip, ctx);
  if (approval.type === 'dm') {
    return `DM request from ${ship}`;
  }
  if (approval.type === 'channel') {
    return `Channel mention request from ${ship}`;
  }
  const groupLabel = formatGroupLabel(approval.groupTitle, approval.groupFlag);
  return groupLabel
    ? `Group invite request from ${ship} for ${groupLabel}`
    : `Group invite request from ${ship}`;
}

/**
 * In-channel status posted when a mention queues a channel approval, so the
 * wait for the owner doesn't read as a broken bot (TLON-6451). Written for
 * readers who don't know how bot channel authorization works. Deliberately
 * does not promise a reply to this specific message: dedup keeps only the
 * newest pending mention per ship+channel, so only that one is replayed
 * after approval. When the owner DM didn't go through (`ownerNotified`
 * false), don't claim it did — a later mention retries the notification.
 *
 * The requester prefix must stay a bare ~ship token (no nickname) so the
 * story parser turns it into a real mention — that's what keeps several
 * near-identical acks tellable apart when multiple people tag the bot.
 */
export function formatChannelApprovalAck(
  requestingShip: string,
  ownerShip: string,
  ctx?: DisplayContext,
  options: { ownerNotified?: boolean } = {}
): string {
  const owner = displayShipWithId(ownerShip, ctx);
  const lead = `${requestingShip}: I need approval from my owner, ${owner}, before I can respond in this channel`;
  if (options.ownerNotified === false) {
    return `${lead}. I couldn't reach them just now — please mention me again later.`;
  }
  return `${lead} — I've sent them the request.`;
}

// ============================================================================
// Display Context — pass human-readable names without breaking purity
// ============================================================================

/** Display hints for human-readable formatting. Callers resolve these from caches/lookups. */
export type DisplayContext = {
  /** Map from ship (~sampel-palnet) to human-readable contact nickname */
  contactNames?: Map<string, string>;
  /** Map from channel nest (chat/~host/name) to human-readable channel display name */
  channelNames?: Map<string, string>;
  /** Map from channel nest (chat/~host/name) to containing group flag */
  channelGroups?: Map<string, string>;
  /** Map from group flag (~host/name) to human-readable group title */
  groupNames?: Map<string, string>;
};

export type ApprovalA2UIOptions = {
  /**
   * Whether the notification recipient can open messages that live only in
   * the bot's own DM history (i.e. the recipient shares the bot's account).
   * Channel-mention sources live in the group channel, so they stay
   * navigable for a separate owner regardless. Defaults to true.
   */
  recipientSeesBotDms?: boolean;
};

function displayShipName(ship: string, ctx?: DisplayContext): string {
  return ctx?.contactNames?.get(ship) || ship;
}

function displayShipWithId(ship: string, ctx?: DisplayContext): string {
  const name = ctx?.contactNames?.get(ship);
  return name ? `${name} (${ship})` : ship;
}

function displayChannel(nest: string, ctx?: DisplayContext): string {
  const name = ctx?.channelNames?.get(nest);
  const groupFlag = ctx?.channelGroups?.get(nest);
  const groupName = groupFlag ? ctx?.groupNames?.get(groupFlag) : undefined;
  if (name && groupName) {
    return `${name} in ${groupName} (${nest})`;
  }
  if (name) {
    return `${name} (${nest})`;
  }
  if (groupName) {
    return `${groupName} (${nest})`;
  }
  return nest;
}

// Title and flag are bounded separately so an oversized title can neither
// push the host flag out of a label nor blow the a2ui per-node text cap.
const MAX_GROUP_TITLE_CHARS = 80;
const MAX_GROUP_FLAG_CHARS = 80;

/** Bounded "title (flag)" label; whichever parts exist, nothing when neither does. */
export function formatGroupLabel(
  title: string | undefined,
  flag: string | undefined
): string {
  const boundedTitle = title ? truncate(title, MAX_GROUP_TITLE_CHARS) : '';
  const boundedFlag = flag ? truncate(flag, MAX_GROUP_FLAG_CHARS) : '';
  if (boundedTitle && boundedFlag && boundedTitle !== boundedFlag) {
    return `${boundedTitle} (${boundedFlag})`;
  }
  return boundedTitle || boundedFlag;
}

function displayGroup(
  flag: string,
  ctx?: DisplayContext,
  titleOverride?: string
): string {
  const name = titleOverride || ctx?.groupNames?.get(flag);
  return formatGroupLabel(name, flag || undefined);
}

// ============================================================================
// Emoji Reaction Mapping
// ============================================================================

/** Map a reaction emoji to an approval action. Returns undefined for unrecognized emoji. */
export function emojiToApprovalAction(
  emoji: string
): 'approve' | 'deny' | 'block' | undefined {
  switch (emoji) {
    case '👍':
      return 'approve';
    case '👎':
      return 'deny';
    case '🛑':
      return 'block';
    default:
      return undefined;
  }
}

// ============================================================================
// Notification Message ID Normalization
// ============================================================================

/**
 * Normalize a message ID for comparison between sendDm return values and SSE event IDs.
 * sendDm returns "~ship/170.141.184.XXX", SSE events use "170.141.184.XXX" (bare timestamp).
 * This strips the ship prefix and dots so both forms compare equal.
 */
export function normalizeNotificationId(id: string): string {
  // Strip ship prefix: "~zod/170.141..." → "170.141..."
  if (id.includes('/') && id.startsWith('~')) {
    id = id.slice(id.indexOf('/') + 1);
  }
  // Strip dots: "170.141.184..." → "170141184..."
  return id.replace(/\./g, '');
}

// ============================================================================
// Approval Expiration
// ============================================================================

/** Check if a pending approval has expired (TTL defined in settings.ts). */
export function isExpired(approval: PendingApproval): boolean {
  return Date.now() - approval.timestamp > APPROVAL_TTL_MS;
}

/** Filter out expired approvals from a list. */
export function pruneExpired(approvals: PendingApproval[]): PendingApproval[] {
  return approvals.filter((a) => !isExpired(a));
}

// ============================================================================
// Approval ID Generation
// ============================================================================

/**
 * Generate a short approval ID: type-prefix char + 4 hex chars.
 * e.g. "da1b2" for dm, "cc3d4" for channel, "g5f6e" for group invite.
 */
export function generateApprovalId(
  type: ApprovalType,
  existingIds: string[] = []
): string {
  const prefix = type[0]; // 'd', 'c', or 'g'
  for (let attempt = 0; attempt < 10; attempt++) {
    const shortId = randomUUID().slice(0, 4);
    const id = `${prefix}${shortId}`;
    if (!existingIds.includes(id)) {
      return id;
    }
  }
  // Fallback: use 8 chars to avoid collision
  return `${prefix}${randomUUID().slice(0, 8)}`;
}

/**
 * Create a pending approval object.
 */
export function createPendingApproval(
  params: CreateApprovalParams,
  existingIds: string[] = []
): PendingApproval {
  return {
    id: generateApprovalId(params.type, existingIds),
    type: params.type,
    requestingShip: params.requestingShip,
    channelNest: params.channelNest,
    groupFlag: params.groupFlag,
    groupTitle: params.groupTitle,
    messagePreview: params.messagePreview,
    originalMessage: params.originalMessage,
    timestamp: Date.now(),
  };
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Approval Queueing (applyApprovalRequest)
// ============================================================================

/**
 * Minimum interval between owner-notification attempts for the same pending
 * approval. Value shared with hermes' RENOTIFY_COOLDOWN_MS
 * (packages/hermes-tlon-adapter/adapter.py).
 */
export const RENOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * What applyApprovalRequest did with the request: 'queued' created a new
 * record, 'updated' refreshed an existing one (owner re-notified), 'blocked'
 * dropped it silently, 'suppressed' left a group record untouched
 * (already delivered, or within the re-notify cooldown).
 */
export type ApprovalRequestOutcome =
  | 'queued'
  | 'updated'
  | 'blocked'
  | 'suppressed';

export type ApprovalQueueContext = {
  /**
   * Live accessors, read at each use: the settings subscription replaces
   * the pending list wholesale, so no captured array.
   */
  getPending(): PendingApproval[];
  setPending(next: PendingApproval[]): void;
  isShipBlocked(ship: string): Promise<boolean>;
  /** Send the owner DM for an approval. Success = defined message ID. */
  notify(approval: PendingApproval): Promise<string | undefined>;
  persist(): Promise<void>;
  now(): number;
  log?: (msg: string) => void;
};

/**
 * Queue an approval request and notify the owner, idempotently.
 *
 * Group approvals dedup by groupFlag alone; the persisted record suppresses
 * re-notification once delivered (notificationMessageId set) and gates
 * retries of failed sends via notifyAttemptAt + RENOTIFY_COOLDOWN_MS.
 * dm/channel keep their existing semantics: dedup by ship (+nest), preview
 * update, unconditional re-notify.
 *
 * Returns the outcome so callers can distinguish a live request from one
 * silently dropped (blocked ship) or suppressed (group dedup/cooldown).
 */
export async function applyApprovalRequest(
  approval: PendingApproval,
  ctx: ApprovalQueueContext
): Promise<ApprovalRequestOutcome> {
  ctx.setPending(
    ctx.getPending().filter((a) => ctx.now() - a.timestamp <= APPROVAL_TTL_MS)
  );

  if (approval.type === 'group') {
    return applyGroupApprovalRequest(approval, ctx);
  }

  // Check if ship is blocked - silently ignore
  if (await ctx.isShipBlocked(approval.requestingShip)) {
    ctx.log?.(
      `[tlon] Ignoring request from blocked ship ${approval.requestingShip}`
    );
    return 'blocked';
  }

  const existing = ctx
    .getPending()
    .find(
      (a) =>
        a.type === approval.type &&
        a.requestingShip === approval.requestingShip &&
        (approval.type !== 'channel' || a.channelNest === approval.channelNest)
    );

  if (existing) {
    // Update existing approval with new content (preserves the original ID)
    if (approval.originalMessage) {
      existing.originalMessage = approval.originalMessage;
      existing.messagePreview = approval.messagePreview;
    }
    ctx.log?.(
      `[tlon] Updated existing approval for ${approval.requestingShip} (${approval.type}) - re-sending notification`
    );
    // Send notification first, then save once with the notification ID.
    // Saving before notify causes a race: the settings subscription event
    // replaces the pending list in-memory, so the notificationMessageId set
    // on the old object reference is lost.
    const existNotifId = await ctx.notify(existing);
    if (existNotifId) {
      existing.notificationMessageId = normalizeNotificationId(existNotifId);
    }
    await ctx.persist();
    return 'updated';
  }

  // Send notification before saving so notificationMessageId is included
  // in the single save. See comment above about the settings subscription race.
  const notifId = await ctx.notify(approval);
  if (notifId) {
    approval.notificationMessageId = normalizeNotificationId(notifId);
  }
  ctx.setPending([...ctx.getPending(), approval]);
  await ctx.persist();
  ctx.log?.(
    `[tlon] Queued approval request: ${approval.id} (${approval.type} from ${approval.requestingShip})`
  );
  return 'queued';
}

/**
 * Persisted JSON can carry a null/empty/non-string marker; only a real
 * message ID proves the owner DM landed. Exported so the channel-ack path
 * can detect the undelivered→delivered transition on a retry mention.
 */
export function isNotificationDelivered(approval: PendingApproval): boolean {
  return (
    typeof approval.notificationMessageId === 'string' &&
    approval.notificationMessageId.length > 0
  );
}

/** A bogus persisted stamp reads as 0 so the retry is allowed, not blocked. */
function lastNotifyAttempt(approval: PendingApproval): number {
  return typeof approval.notifyAttemptAt === 'number' &&
    Number.isFinite(approval.notifyAttemptAt)
    ? approval.notifyAttemptAt
    : 0;
}

async function applyGroupApprovalRequest(
  approval: PendingApproval,
  ctx: ApprovalQueueContext
): Promise<ApprovalRequestOutcome> {
  // Dedup by groupFlag alone (hermes already dedups groups by flag).
  const existing = ctx
    .getPending()
    .find((a) => a.type === 'group' && a.groupFlag === approval.groupFlag);

  if (existing) {
    // Delivered ⇒ never re-DM while the record lives; the TTL prune plus the
    // next observation provide the eventual fresh reminder.
    if (isNotificationDelivered(existing)) {
      return 'suppressed';
    }
    if (ctx.now() - lastNotifyAttempt(existing) < RENOTIFY_COOLDOWN_MS) {
      return 'suppressed';
    }
  }

  // Every path past here sends the owner a DM or creates the record, so the
  // blocked-list scry runs only when an action is imminent — a no-op
  // re-observation of a suppressed approval must not cost a scry per tick.
  if (await ctx.isShipBlocked(approval.requestingShip)) {
    ctx.log?.(
      `[tlon] Ignoring request from blocked ship ${approval.requestingShip}`
    );
    return 'blocked';
  }

  if (existing) {
    const attemptAt = ctx.now();
    existing.notifyAttemptAt = attemptAt;
    const notifId = await ctx.notify(existing);
    // The settings subscription may have replaced the pending list during the
    // notify, detaching `existing`; stamp the live record instead. Gone from
    // the list ⇒ removed meanwhile, so persisting it back would resurrect it.
    const live = ctx.getPending().find((a) => a.id === existing.id);
    if (!live) {
      return 'updated';
    }
    if (notifId) {
      live.notificationMessageId = normalizeNotificationId(notifId);
    }
    // A replacement can carry a stale persisted stamp; without taking the
    // newer attempt a failed send would then retry on every poll instead of
    // honoring the cooldown.
    live.notifyAttemptAt = Math.max(lastNotifyAttempt(live), attemptAt);
    await ctx.persist();
    return 'updated';
  }

  // New group approval: push first so /pending shows it regardless of the
  // send outcome, then re-sync after the (possibly long) notify — the
  // settings subscription may have replaced the pending list wholesale.
  approval.notifyAttemptAt = ctx.now();
  ctx.setPending([...ctx.getPending(), approval]);
  const notifId = await ctx.notify(approval);
  if (notifId) {
    approval.notificationMessageId = normalizeNotificationId(notifId);
  }
  const current = ctx.getPending();
  if (!current.some((a) => a.id === approval.id)) {
    ctx.setPending([...current, approval]);
  }
  await ctx.persist();
  ctx.log?.(
    `[tlon] Queued approval request: ${approval.id} (${approval.type} from ${approval.requestingShip})`
  );
  return 'queued';
}

/**
 * Carry in-memory delivery state across a wholesale pending-list replacement
 * (settings echo/refresh can predate what this process already sent; adopting
 * it verbatim would re-DM the owner and break reaction matching). Gap-filling
 * only: an incoming record's own markers win, and records absent from
 * `incoming` are never resurrected.
 */
export function mergeApprovalDeliveryState(
  incoming: PendingApproval[],
  current: PendingApproval[]
): PendingApproval[] {
  if (incoming.length === 0 || current.length === 0) {
    return incoming;
  }
  const live = new Map(current.map((a) => [a.id, a]));
  return incoming.map((approval) => {
    const known = live.get(approval.id);
    if (!known) {
      return approval;
    }
    return {
      ...approval,
      ...(approval.notificationMessageId === undefined &&
      known.notificationMessageId !== undefined
        ? { notificationMessageId: known.notificationMessageId }
        : {}),
      ...(approval.notifyAttemptAt === undefined &&
      known.notifyAttemptAt !== undefined
        ? { notifyAttemptAt: known.notifyAttemptAt }
        : {}),
    };
  });
}

// ============================================================================
// Ban Action (runBanAction)
// ============================================================================

export type BanActionDeps = {
  /** False on submission failure (see blockShip). */
  blockShip: (ship: string) => Promise<boolean>;
  /**
   * Persists the revocation; false when the write failed (the caller's
   * in-memory entry is restored so a retry can re-attempt it).
   */
  removeFromDmAllowlist: (ship: string) => Promise<boolean>;
  /**
   * Rejects on *submission* failure only: the poke resolves from the channel
   * PUT's status and a later %groups nack is log-only, so this carries no
   * stronger delivery guarantee than the deny branch's decline.
   */
  declineInvite: (groupFlag: string) => Promise<void>;
};

export type BanActionResult =
  | { outcome: 'done' }
  | { outcome: 'block-failed' }
  | { outcome: 'revoke-failed' }
  | { outcome: 'decline-failed'; error: unknown };

/**
 * The /ban side effects in their required order: block the ship, revoke its DM
 * grant, then decline the group invite.
 *
 * The DM revocation runs before the decline so that a block-OK/decline-failed
 * partial ban has still taken the ship's DM access away — that outcome keeps
 * the approval record for a retry, and leaving the grant in place until the
 * retry succeeded would be a live authorization the owner believes is gone.
 * `done` is the only outcome that may remove the record.
 */
export async function runBanAction(
  approval: PendingApproval,
  deps: BanActionDeps
): Promise<BanActionResult> {
  const blocked = await deps.blockShip(approval.requestingShip);
  if (!blocked && approval.type === 'group') {
    return { outcome: 'block-failed' };
  }
  const revoked = await deps.removeFromDmAllowlist(approval.requestingShip);
  if (!revoked && approval.type === 'group') {
    // Completing anyway would drop the only record through which a retry can
    // re-attempt the failed revocation write; dm/channel bans stay best-effort
    // like their block leg.
    return { outcome: 'revoke-failed' };
  }
  if (approval.type === 'group' && approval.groupFlag) {
    try {
      await deps.declineInvite(approval.groupFlag);
    } catch (error) {
      return { outcome: 'decline-failed', error };
    }
  }
  return { outcome: 'done' };
}

// ============================================================================
// Approval Request A2UI
// ============================================================================

type ApprovalA2UIParams = {
  type: ApprovalType;
  requestId: string;
  requestingShip: string;
  requestingShipName?: string;
  requestingShipLabel?: string;
  messagePreview?: string;
  channelName?: string;
  channelContext?: string;
  channelNest?: string;
  groupName?: string;
  groupFlag?: string;
  sourceTarget?: A2UI.NavigationTarget;
};

function approvalRequesterName(params: ApprovalA2UIParams): string {
  return params.requestingShipName ?? params.requestingShip;
}

function approvalRequesterLabel(params: ApprovalA2UIParams): string {
  return params.requestingShipLabel ?? params.requestingShip;
}

function approvalTarget(params: ApprovalA2UIParams): string | undefined {
  if (params.type === 'channel') {
    return params.channelName;
  }
  if (params.type === 'group') {
    return params.groupName;
  }
  return undefined;
}

function approvalTitle(params: ApprovalA2UIParams): string {
  const target = approvalTarget(params);
  switch (params.type) {
    case 'dm':
      return `Allow ${approvalRequesterName(params)} to DM the bot?`;
    case 'channel':
      return `Let the bot reply to ${approvalRequesterName(params)} in ${approvalChannelLabel(params)}?`;
    case 'group':
      return `Let the bot join ${truncate(target ?? 'this group', 60)}?`;
  }
  return assertNever(params.type);
}

function approvalEyebrow(params: ApprovalA2UIParams): string {
  switch (params.type) {
    case 'dm':
      return 'DM access';
    case 'channel':
      return 'Channel access';
    case 'group':
      return 'Group invite';
  }
  return assertNever(params.type);
}

function approvalChannelLabel(params: ApprovalA2UIParams): string {
  return params.channelName ?? params.channelNest ?? 'this channel';
}

function approvalContextLines(params: ApprovalA2UIParams): string[] {
  switch (params.type) {
    case 'dm':
      return [`Sender: ${approvalRequesterLabel(params)}`];
    case 'channel':
      return [
        `Sender: ${approvalRequesterLabel(params)}`,
        `Channel: ${approvalChannelLabel(params)}`,
        ...(params.channelContext ? [`Group: ${params.channelContext}`] : []),
      ];
    case 'group': {
      const groupLabel = formatGroupLabel(
        approvalTarget(params),
        params.groupFlag
      );
      return [
        `Inviter: ${approvalRequesterLabel(params)}`,
        ...(groupLabel ? [`Group: ${groupLabel}`] : []),
      ];
    }
  }
  return assertNever(params.type);
}

function approvalCopy(params: ApprovalA2UIParams): string | undefined {
  if (params.messagePreview) {
    return `Message: "${truncate(params.messagePreview, 100)}"`;
  }
  return undefined;
}

function approvalAllowNote(params: ApprovalA2UIParams): string {
  switch (params.type) {
    case 'dm':
      return 'The bot will be able to read and reply to future DMs from this user.';
    case 'channel':
      return 'The bot will be able to read and reply to this user in this channel.';
    case 'group':
      return 'The bot will be able to read and respond in channels it joins.';
  }
  return assertNever(params.type);
}

function buildApprovalA2UIBlobFromParams(
  params: ApprovalA2UIParams
): TlonA2UIBlob {
  const contextLines = approvalContextLines(params);
  const contextIds = contextLines.map((_, index) => `context${index}`);
  const copy = approvalCopy(params);
  const actionChildren = ['allow', 'reject', 'ban'];
  const bodyChildren = [
    'eyebrow',
    'title',
    'titleDivider',
    ...contextIds,
    ...(copy ? ['copy'] : []),
    ...(params.sourceTarget ? ['sourceAction'] : []),
    'divider',
    'details',
    'actions',
  ];
  const contextComponents: A2UI.Component[] = contextLines.map(
    (line, index) => ({
      id: `context${index}`,
      component: 'Text',
      variant: 'caption',
      text: line,
    })
  );
  const copyComponents: A2UI.Component[] = copy
    ? [
        {
          id: 'copy',
          component: 'Text',
          variant: 'caption',
          text: copy,
        },
      ]
    : [];
  const sourceActionComponents: A2UI.Component[] = params.sourceTarget
    ? [{ id: 'sourceAction', component: 'Row', children: ['viewMessage'] }]
    : [];

  const components: A2UI.Component[] = [
    { id: 'root', component: 'Card', child: 'body' },
    {
      id: 'body',
      component: 'Column',
      children: bodyChildren,
    },
    {
      id: 'eyebrow',
      component: 'Text',
      variant: 'caption',
      text: approvalEyebrow(params),
    },
    {
      id: 'title',
      component: 'Text',
      variant: 'h3',
      text: approvalTitle(params),
    },
    { id: 'titleDivider', component: 'Divider' },
    ...contextComponents,
    ...copyComponents,
    ...sourceActionComponents,
    { id: 'divider', component: 'Divider' },
    {
      id: 'details',
      component: 'Column',
      children: ['allowNote'],
    },
    {
      id: 'allowNote',
      component: 'Text',
      variant: 'caption',
      text: approvalAllowNote(params),
    },
    {
      id: 'actions',
      component: 'Row',
      children: actionChildren,
    },
    ...(params.sourceTarget
      ? [
          {
            id: 'viewMessage',
            component: 'Button',
            variant: 'secondary',
            child: 'viewMessageLabel',
            action: {
              event: {
                name: A2UI.action.navigate,
                context: { target: params.sourceTarget },
              },
            },
          } as const,
          {
            id: 'viewMessageLabel',
            component: 'Text',
            text: 'View message',
          } as const,
        ]
      : []),
    {
      id: 'allow',
      component: 'Button',
      variant: 'primary',
      child: 'allowLabel',
      action: {
        event: {
          name: A2UI.action.sendMessage,
          context: { text: `/allow ${params.requestId}` },
        },
      },
    },
    { id: 'allowLabel', component: 'Text', text: 'Allow' },
    {
      id: 'reject',
      component: 'Button',
      child: 'rejectLabel',
      action: {
        event: {
          name: A2UI.action.sendMessage,
          context: { text: `/reject ${params.requestId}` },
        },
      },
    },
    { id: 'rejectLabel', component: 'Text', text: 'Reject' },
    {
      id: 'ban',
      component: 'Button',
      variant: 'borderless',
      child: 'banLabel',
      action: {
        event: {
          name: A2UI.action.sendMessage,
          context: { text: `/ban ${params.requestId}` },
        },
      },
    },
    { id: 'banLabel', component: 'Text', text: 'Block' },
  ];

  return makeA2UIBlob(`approval-${params.requestId}`, 'root', components);
}

function displayChannelForApproval(
  nest: string | undefined,
  ctx?: DisplayContext
): string | undefined {
  if (!nest) {
    return undefined;
  }
  return ctx?.channelNames?.get(nest) ?? 'this channel';
}

function displayChannelContextForApproval(
  nest: string | undefined,
  ctx?: DisplayContext
): string | undefined {
  if (!nest) {
    return undefined;
  }
  const groupFlag = ctx?.channelGroups?.get(nest);
  const groupName = groupFlag ? ctx?.groupNames?.get(groupFlag) : undefined;
  if (groupName) {
    return groupName;
  }
  if (groupFlag) {
    return groupFlag;
  }
  return undefined;
}

function displayGroupForApproval(
  flag: string | undefined,
  titleOverride: string | undefined,
  ctx?: DisplayContext
): string | undefined {
  if (!flag && !titleOverride) {
    return undefined;
  }
  if (!flag) {
    return titleOverride;
  }
  return titleOverride || ctx?.groupNames?.get(flag) || flag;
}

function approvalSourceTarget(
  approval: PendingApproval,
  ctx?: DisplayContext
): A2UI.NavigationTarget | undefined {
  const messageId = approval.originalMessage?.messageId;
  if (!messageId) {
    return undefined;
  }

  const base = {
    type: 'message' as const,
    postId: messageId,
    authorId: approval.requestingShip,
    parentId: approval.originalMessage?.parentId,
    parentAuthorId: approval.originalMessage?.parentAuthorId,
  };

  if (approval.type === 'dm') {
    return {
      ...base,
      channelId: approval.requestingShip,
    };
  }

  if (approval.type === 'channel' && approval.channelNest) {
    return {
      ...base,
      channelId: approval.channelNest,
      groupId: ctx?.channelGroups?.get(approval.channelNest),
    };
  }

  return undefined;
}

function approvalSourceTargetForRecipient(
  approval: PendingApproval,
  ctx: DisplayContext | undefined,
  options: ApprovalA2UIOptions
): A2UI.NavigationTarget | undefined {
  if (approval.type === 'dm' && options.recipientSeesBotDms === false) {
    return undefined;
  }
  return approvalSourceTarget(approval, ctx);
}

export function buildApprovalA2UIBlob(
  approval: PendingApproval,
  ctx?: DisplayContext,
  options: ApprovalA2UIOptions = {}
): TlonA2UIBlob {
  return buildApprovalA2UIBlobFromParams({
    type: approval.type,
    requestId: approval.id,
    requestingShip: approval.requestingShip,
    requestingShipName: displayShipName(approval.requestingShip, ctx),
    requestingShipLabel: displayShipWithId(approval.requestingShip, ctx),
    messagePreview: approval.messagePreview,
    channelNest: approval.channelNest,
    channelName: displayChannelForApproval(approval.channelNest, ctx),
    channelContext: displayChannelContextForApproval(approval.channelNest, ctx),
    groupFlag: approval.groupFlag,
    groupName: displayGroupForApproval(
      approval.groupFlag,
      approval.groupTitle,
      ctx
    ),
    sourceTarget: approvalSourceTargetForRecipient(approval, ctx, options),
  });
}

// ============================================================================
// Pending Requests A2UI
// ============================================================================

const MAX_PENDING_APPROVALS_A2UI = 4;

function shouldUsePendingApprovalsA2UI(
  activeApprovals: PendingApproval[]
): boolean {
  return (
    activeApprovals.length > 0 &&
    activeApprovals.length <= MAX_PENDING_APPROVALS_A2UI
  );
}

function pendingItemFields(
  approval: PendingApproval,
  ctx?: DisplayContext
): { title: string; context: string; preview?: string } {
  const name = displayShipName(approval.requestingShip, ctx);
  const ship = displayShipWithId(approval.requestingShip, ctx);
  const preview = approval.messagePreview
    ? `Message: "${truncate(approval.messagePreview, 100)}"`
    : undefined;

  switch (approval.type) {
    case 'dm':
      return { title: `DM from ${name}`, context: `Sender: ${ship}`, preview };
    case 'channel':
      return {
        title: `Channel access for ${name}`,
        context: `Channel: ${displayChannel(approval.channelNest ?? '', ctx)}`,
        preview,
      };
    case 'group':
      return {
        title: `Group invite from ${name}`,
        context: `Group: ${displayGroup(approval.groupFlag ?? '', ctx, approval.groupTitle)}`,
      };
  }
  return assertNever(approval.type);
}

export function buildPendingApprovalsA2UIBlob(
  approvals: PendingApproval[],
  ctx?: DisplayContext,
  options: ApprovalA2UIOptions = {}
): TlonA2UIBlob | undefined {
  const active = pruneExpired(approvals);
  if (!shouldUsePendingApprovalsA2UI(active)) {
    return undefined;
  }

  const text = (
    id: string,
    value: string,
    variant?: A2UI.Text['variant']
  ): A2UI.Component =>
    variant
      ? { id, component: 'Text', variant, text: value }
      : { id, component: 'Text', text: value };
  const button = (
    id: string,
    labelId: string,
    command: string,
    variant?: A2UI.Button['variant']
  ): A2UI.Component => ({
    id,
    component: 'Button',
    ...(variant ? { variant } : {}),
    child: labelId,
    action: {
      event: {
        name: A2UI.action.sendMessage,
        context: { text: command },
      },
    },
  });

  const bodyChildren = ['eyebrow', 'title', 'titleDivider'];
  const components: A2UI.Component[] = [
    { id: 'root', component: 'Card', child: 'body' },
    { id: 'body', component: 'Column', children: bodyChildren },
    text('eyebrow', 'Pending requests', 'caption'),
    text(
      'title',
      `${active.length} approval ${active.length === 1 ? 'request' : 'requests'}`,
      'h3'
    ),
    { id: 'titleDivider', component: 'Divider' },
    text('allowLabel', 'Allow'),
    text('rejectLabel', 'Reject'),
    text('blockLabel', 'Block'),
    text('viewMessageLabel', 'View message'),
  ];

  for (const [index, approval] of active.entries()) {
    const prefix = `item${index}`;
    const fields = pendingItemFields(approval, ctx);
    const sourceTarget = approvalSourceTargetForRecipient(
      approval,
      ctx,
      options
    );

    if (index > 0) {
      const dividerId = `${prefix}Divider`;
      bodyChildren.push(dividerId);
      components.push({ id: dividerId, component: 'Divider' });
    }

    bodyChildren.push(prefix);
    components.push(
      {
        id: prefix,
        component: 'Column',
        children: [
          `${prefix}Title`,
          `${prefix}Context`,
          ...(fields.preview ? [`${prefix}Preview`] : []),
          `${prefix}Actions`,
        ],
      },
      text(`${prefix}Title`, fields.title, 'h4'),
      text(`${prefix}Context`, fields.context, 'caption'),
      ...(fields.preview
        ? [text(`${prefix}Preview`, fields.preview, 'caption')]
        : []),
      // The view button shares the actions row (instead of getting its own
      // row like the single-approval card) to stay under the a2ui
      // 50-component limit at the 4-approval maximum.
      ...(sourceTarget
        ? ([
            {
              id: `${prefix}View`,
              component: 'Button',
              variant: 'secondary',
              child: 'viewMessageLabel',
              action: {
                event: {
                  name: A2UI.action.navigate,
                  context: { target: sourceTarget },
                },
              },
            },
          ] satisfies A2UI.Component[])
        : []),
      {
        id: `${prefix}Actions`,
        component: 'Row',
        children: [
          `${prefix}Allow`,
          `${prefix}Reject`,
          `${prefix}Block`,
          ...(sourceTarget ? [`${prefix}View`] : []),
        ],
      },
      button(
        `${prefix}Allow`,
        'allowLabel',
        `/allow ${approval.id}`,
        'primary'
      ),
      button(`${prefix}Reject`, 'rejectLabel', `/reject ${approval.id}`),
      button(
        `${prefix}Block`,
        'blockLabel',
        `/ban ${approval.id}`,
        'borderless'
      )
    );
  }

  return makeA2UIBlob('pending-approvals', 'root', components);
}

export function buildPendingApprovalsResponse(
  approvals: PendingApproval[],
  ctx: DisplayContext | undefined,
  serializeBlob: (blob: TlonA2UIBlob) => string | undefined,
  onError?: (error: unknown) => void,
  options: ApprovalA2UIOptions = {}
): { text: string; mode: 'text' } | { text: string; mode: 'ui'; blob: string } {
  const text = formatPendingList(approvals, ctx);
  if (!shouldUsePendingApprovalsA2UI(approvals)) {
    return { text, mode: 'text' };
  }

  try {
    const blob = buildPendingApprovalsA2UIBlob(approvals, ctx, options);
    const serialized = blob ? serializeBlob(blob) : undefined;
    return serialized
      ? { text, blob: serialized, mode: 'ui' }
      : { text, mode: 'text' };
  } catch (error) {
    onError?.(error);
    return { text, mode: 'text' };
  }
}

// ============================================================================
// Approval Lookup & Removal
// ============================================================================

/**
 * Find a pending approval by ID, or return the most recent if no ID specified.
 * Supports prefix matching for shortened IDs.
 * Skips expired approvals.
 */
export function findPendingApproval(
  pendingApprovals: PendingApproval[],
  id?: string
): PendingApproval | undefined {
  const active = pruneExpired(pendingApprovals);
  if (id) {
    // Exact match first
    const exact = active.find((a) => a.id === id);
    if (exact) {
      return exact;
    }
    // Prefix match (for partial input or old-format IDs)
    const prefixMatches = active.filter((a) => a.id.startsWith(id));
    if (prefixMatches.length === 1) {
      return prefixMatches[0];
    }
    return undefined;
  }
  // Return most recent
  return active[active.length - 1];
}

/**
 * Remove a pending approval from the list by ID.
 */
export function removePendingApproval(
  pendingApprovals: PendingApproval[],
  id: string
): PendingApproval[] {
  return pendingApprovals.filter((a) => a.id !== id);
}

// ============================================================================
// Approval Confirmation Formatting
// ============================================================================

/**
 * Format a confirmation message after an approval action.
 */
export function formatApprovalConfirmation(
  approval: PendingApproval,
  action: 'approve' | 'deny' | 'block',
  ctx?: DisplayContext
): string {
  const ship = displayShipWithId(approval.requestingShip, ctx);

  if (action === 'block') {
    return `Blocked ${ship}. They will no longer be able to contact the bot.`;
  }

  switch (approval.type) {
    case 'dm':
      if (action === 'approve') {
        return `Approved DM access for ${ship}. They will be able to message the bot.`;
      }
      return `Denied DM request from ${ship}.`;

    case 'channel': {
      const channel = displayChannel(approval.channelNest ?? '', ctx);
      if (action === 'approve') {
        return `Approved ${ship} for ${channel}. They will be able to interact in this channel.`;
      }
      return `Denied ${ship} for ${channel}.`;
    }

    case 'group': {
      const group = displayGroup(
        approval.groupFlag ?? '',
        ctx,
        approval.groupTitle
      );
      if (action === 'approve') {
        return `Approved group invite from ${ship} to ${group}. Joining group...`;
      }
      return `Denied group invite from ${ship} to ${group}.`;
    }
  }
  return assertNever(approval.type);
}

// ============================================================================
// List Formatting
// ============================================================================

/**
 * Format the list of blocked users for display to owner.
 */
export function formatBlockedList(ships: string[]): string {
  if (ships.length === 0) {
    return 'No users are currently blocked.';
  }
  const lines = ships.map((s) => `  ${s}`);
  return [
    `Blocked users (${ships.length}):`,
    ...lines,
    '',
    'To unban: `/unban ~sampel-palnet`',
  ].join('\n');
}

/**
 * Format the list of pending approvals for display to owner.
 */
export function formatPendingList(
  approvals: PendingApproval[],
  ctx?: DisplayContext
): string {
  const active = pruneExpired(approvals);
  if (active.length === 0) {
    return 'No pending approval requests.';
  }

  const entries = active.map((a) => {
    const ship = displayShipWithId(a.requestingShip, ctx);
    const preview = a.messagePreview
      ? `\n    "${truncate(a.messagePreview, 80)}"`
      : '';

    switch (a.type) {
      case 'dm':
        return `  #${a.id} - DM from ${ship}${preview}`;
      case 'channel':
        return `  #${a.id} - Mention in ${displayChannel(a.channelNest ?? '', ctx)} by ${ship}${preview}`;
      case 'group':
        return `  #${a.id} - Group invite from ${ship} to ${displayGroup(a.groupFlag ?? '', ctx, a.groupTitle)}`;
    }
    return assertNever(a.type);
  });

  return [
    `Pending requests (${active.length}):`,
    '',
    ...entries,
    '',
    'Use /allow, /reject, or /ban with the ID.',
  ].join('\n');
}
