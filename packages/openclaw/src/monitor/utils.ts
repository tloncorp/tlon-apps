import { normalizeShip } from '../targets.js';

export interface ParsedCite {
  type: 'chan' | 'group' | 'desk' | 'bait';
  nest?: string;
  postId?: string;
  replyId?: string;
  group?: string;
  flag?: string;
  where?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseChannelWhere(where: unknown): {
  postId?: string;
  replyId?: string;
} {
  if (typeof where !== 'string') {
    return {};
  }

  const legacyMatch = /^\/msg\/~[a-z-]+\/([^/]+)$/.exec(where);
  if (legacyMatch) {
    return { postId: legacyMatch[1] };
  }

  const currentMatch = /^\/(?:msg|note|curio)\/([^/]+)(?:\/([^/]+))?$/.exec(
    where
  );
  if (!currentMatch) {
    return {};
  }

  return {
    postId: currentMatch[1],
    ...(currentMatch[2] ? { replyId: currentMatch[2] } : {}),
  };
}

// Extract all cites from message content
export function extractCites(content: unknown): ParsedCite[] {
  if (!content || !Array.isArray(content)) {
    return [];
  }

  const cites: ParsedCite[] = [];

  for (const verse of content) {
    if (
      isRecord(verse) &&
      isRecord(verse.block) &&
      isRecord(verse.block.cite)
    ) {
      const cite = verse.block.cite;

      if (isRecord(cite.chan)) {
        const nest = cite.chan.nest;
        const where = cite.chan.where;
        const parsedWhere = parseChannelWhere(where);
        cites.push({
          type: 'chan',
          ...(typeof nest === 'string' ? { nest } : {}),
          ...(typeof where === 'string' ? { where } : {}),
          ...parsedWhere,
        });
      } else if (cite.group && typeof cite.group === 'string') {
        cites.push({ type: 'group', group: cite.group });
      } else if (isRecord(cite.desk)) {
        cites.push({
          type: 'desk',
          ...(typeof cite.desk.flag === 'string'
            ? { flag: cite.desk.flag }
            : {}),
          ...(typeof cite.desk.where === 'string'
            ? { where: cite.desk.where }
            : {}),
        });
      } else if (isRecord(cite.bait)) {
        cites.push({
          type: 'bait',
          ...(typeof cite.bait.group === 'string'
            ? { group: cite.bait.group }
            : {}),
          ...(typeof cite.bait.graph === 'string'
            ? { nest: cite.bait.graph }
            : {}),
          ...(typeof cite.bait.where === 'string'
            ? { where: cite.bait.where }
            : {}),
        });
      }
    }
  }

  return cites;
}

export function formatModelName(modelString?: string | null): string {
  if (!modelString) {
    return 'AI';
  }
  const modelName = modelString.includes('/')
    ? modelString.split('/')[1]
    : modelString;
  const modelMappings: Record<string, string> = {
    'claude-opus-4-5': 'Claude Opus 4.5',
    'claude-sonnet-4-5': 'Claude Sonnet 4.5',
    'claude-sonnet-3-5': 'Claude Sonnet 3.5',
    'gpt-4o': 'GPT-4o',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-pro': 'Gemini Pro',
  };

  if (modelMappings[modelName]) {
    return modelMappings[modelName];
  }
  return modelName
    .replace(/-/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function isBotMentioned(
  messageText: string,
  botShipName: string,
  nickname?: string
): boolean {
  if (!messageText || !botShipName) {
    return false;
  }

  // Check for ship mention
  const normalizedBotShip = normalizeShip(botShipName);
  const escapedShip = normalizedBotShip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionPattern = new RegExp(`(^|\\s)${escapedShip}(?=\\s|$)`, 'i');
  if (mentionPattern.test(messageText)) {
    return true;
  }

  // Check for nickname mention (case-insensitive, word boundary)
  if (nickname) {
    const escapedNickname = nickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nicknamePattern = new RegExp(
      `(^|\\s)${escapedNickname}(?=\\s|$|[,!?.])`,
      'i'
    );
    if (nicknamePattern.test(messageText)) {
      return true;
    }
  }

  return false;
}

export type EngageReason =
  | 'mention'
  | 'thread'
  | 'owner-blob'
  | 'owner-owned'
  | 'skip';

/**
 * Decide whether to engage on a group-channel message.
 *
 * - Mentions and participated threads always engage (legacy behavior).
 * - Owner blob-only messages engage when the caller asserts `isOwnerBlob`
 *   (preserves existing behavior — caller still computes that flag).
 * - Otherwise: engage when the sender is the owner AND the channel host is
 *   the owner or the bot itself AND the global owner-listen toggle is on AND
 *   the channel is not in the per-channel disabled list.
 */
export function shouldEngageInGroup(opts: {
  mentioned: boolean;
  inParticipatedThread: boolean;
  isOwnerBlob: boolean;
  senderShip: string;
  ownerShip: string | null;
  botShipName: string;
  channelNest: string;
  groupHost: string | null;
  ownerListenEnabled: boolean;
  ownerListenDisabledChannels: ReadonlySet<string>;
}): { engage: boolean; reason: EngageReason } {
  if (opts.mentioned) {
    return { engage: true, reason: 'mention' };
  }
  if (opts.inParticipatedThread) {
    return { engage: true, reason: 'thread' };
  }
  if (opts.isOwnerBlob) {
    return { engage: true, reason: 'owner-blob' };
  }

  if (!opts.ownerListenEnabled) {
    return { engage: false, reason: 'skip' };
  }

  const isOwner = opts.ownerShip !== null && opts.senderShip === opts.ownerShip;
  const isOwned =
    opts.groupHost !== null &&
    (opts.groupHost === opts.ownerShip || opts.groupHost === opts.botShipName);
  const disabled = opts.ownerListenDisabledChannels.has(opts.channelNest);

  if (isOwner && isOwned && !disabled) {
    return { engage: true, reason: 'owner-owned' };
  }
  return { engage: false, reason: 'skip' };
}

/** Parse "tlon:group:<nest>" → "<nest>", else null. */
export function nestFromCtxFrom(
  from: string | undefined | null
): string | null {
  if (!from) {
    return null;
  }
  const m = /^tlon:group:(.+)$/.exec(from);
  return m ? m[1] : null;
}

/** True for the exact /owner-listen slash command, with optional args. */
export function isOwnerListenSlashCommand(messageText: string): boolean {
  return /^\/owner-listen(?:\s|$)/i.test(messageText.trim());
}

/**
 * Strip bot ship mention from message text for command detection.
 * "~bot-ship /status" → "/status"
 */
export function stripBotMention(
  messageText: string,
  botShipName: string
): string {
  if (!messageText || !botShipName) {
    return messageText;
  }
  return messageText.replace(normalizeShip(botShipName), '').trim();
}

/**
 * Whether a line is one of extractMessageText's rendered cite placeholders.
 *
 * Cite nests and references are sender-controlled, so callers that search the
 * rendered message must treat these lines as metadata rather than live text.
 */
export function isCitePlaceholderLine(line: string): boolean {
  return (
    /^> \[quoted from .+\]$/.test(line) ||
    line === '> [quoted message]' ||
    /^> \[ref: .+\]$/.test(line)
  );
}

/**
 * Strip the first bot-ship occurrence outside extractMessageText cite
 * placeholders. Cite nests are sender-controlled, so a placeholder must not
 * consume the mention that the sender put in the current message.
 *
 * A user-authored line that happens to match a placeholder is treated as a
 * placeholder too. That ambiguity is acceptable because the rendered format
 * has no provenance once it reaches this helper.
 */
export function stripBotMentionOutsidePlaceholders(
  messageText: string,
  botShipName: string
): string {
  if (!messageText || !botShipName) {
    return messageText;
  }

  const normalizedBotShip = normalizeShip(botShipName);
  let stripped = false;
  const text = messageText
    .split('\n')
    .map((line) => {
      if (
        stripped ||
        isCitePlaceholderLine(line) ||
        !line.includes(normalizedBotShip)
      ) {
        return line;
      }

      stripped = true;
      return line.replace(normalizedBotShip, '');
    })
    .join('\n');

  return text.trim();
}

export function isDmAllowed(
  senderShip: string,
  allowlist: string[] | undefined
): boolean {
  if (!allowlist || allowlist.length === 0) {
    return false;
  }
  const normalizedSender = normalizeShip(senderShip);
  return allowlist
    .map((ship) => normalizeShip(ship))
    .some((ship) => ship === normalizedSender);
}

/**
 * Check if a ship is on the group-invite allowlist.
 *
 * Used by resolveGroupInviteAction: allowlist membership (plus a positive
 * "not blocked" confirmation) is sufficient for auto-accept. The
 * autoAcceptGroupInvites flag no longer governs invite authorization.
 *
 * SECURITY: Fail-safe to deny. If allowlist is empty or undefined,
 * ALL invites are rejected. This prevents misconfigured bots from
 * accepting malicious invites.
 */
export function isGroupInviteAllowed(
  inviterShip: string,
  allowlist: string[] | undefined
): boolean {
  // SECURITY: Fail-safe to deny when no allowlist configured
  if (!allowlist || allowlist.length === 0) {
    return false;
  }
  const normalizedInviter = normalizeShip(inviterShip);
  return allowlist
    .map((ship) => normalizeShip(ship))
    .some((ship) => ship === normalizedInviter);
}

/**
 * Parse a `/chat/blocked.json` scry payload into a ship list.
 *
 * SECURITY: throws when the payload is not an array. The block list decides
 * whether an allowlisted ship may auto-join, so "we could not understand the
 * response" must stay distinguishable from "nobody is blocked" — coercing a
 * malformed payload to `[]` would read as positive confirmation that the
 * inviter is not blocked and auto-accept them.
 *
 * Individual non-string entries are dropped rather than failing the whole
 * array. Throwing on a partially-malformed list would be *less* safe than the
 * lenient behavior it replaced: callers that fail open (`isShipBlocked`,
 * `getBlockedShips`) would catch the throw and report "not blocked", so one
 * bad element could unblock every genuinely blocked ship in the list.
 * Dropping bad elements keeps every ship we can actually read.
 *
 * The %ships mark serializes an empty block list as `[]`, so a well-formed
 * empty response is a valid array and is NOT an error.
 */
export function parseBlockedShips(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      `blocked list scry returned ${raw === null ? 'null' : typeof raw}, expected an array`
    );
  }
  return raw.filter((ship): ship is string => typeof ship === 'string');
}

/**
 * The action to take for a pending group invite.
 *
 * - `accept/owner`: inviter is the configured owner — auto-accept.
 * - `accept/allowlisted`: inviter is on `groupInviteAllowlist` and a
 *   block-list lookup positively confirmed they are not blocked — auto-accept.
 * - `queue`: inviter is not authorized (or authorization could not be
 *   confirmed) and an owner is configured — send an approval card.
 * - `ignore/blocked`: a block-list lookup positively confirmed the inviter
 *   is blocked — silently drop, no card.
 * - `ignore/no-owner`: inviter is not authorized and no owner is
 *   configured — silently drop.
 */
export type GroupInviteAction =
  | { action: 'accept'; reason: 'owner' | 'allowlisted' }
  | { action: 'queue' }
  | { action: 'ignore'; reason: 'blocked' | 'no-owner' };

/**
 * Resolve what to do with a group invite, fail-closed.
 *
 * SECURITY: auto-accept requires a positive "not blocked" confirmation.
 * `deps.fetchBlockedShips` must reject (not swallow) on failure — a
 * rejection means "unknown", which falls through to the queue/no-owner
 * path and must never auto-accept. The gate passes `scryBlockedShips`
 * (rejects on failure), not `isShipBlocked` (swallows errors to
 * "not blocked").
 *
 * Confirmed-blocked and lookup-unknown are distinct outcomes: a
 * confirmed-blocked inviter dispatches straight to silent ignore (routing
 * it through the queue path would re-ask a fail-open blocked lookup and
 * could card a ship already known to be blocked); only unknown falls
 * through to the queue path, where that second lookup is a genuine
 * recovery attempt.
 */
export async function resolveGroupInviteAction(
  params: {
    inviterShip: string;
    ownerShip: string | null; // normalized effective owner; null ⇒ no owner
    allowlist: string[];
  },
  deps: {
    /** Resolves the block list. MUST reject (not swallow) on failure —
     *  a rejection means "unknown", which must never auto-accept. */
    fetchBlockedShips: () => Promise<string[]>;
  }
): Promise<GroupInviteAction> {
  const { inviterShip, ownerShip, allowlist } = params;
  const hasOwner = ownerShip !== null;

  // Owner invites are always accepted, without consulting the block list
  // (keeps the owner path scry-free and preserves the existing ordering).
  if (hasOwner && normalizeShip(inviterShip) === ownerShip) {
    return { action: 'accept', reason: 'owner' };
  }

  const queueOrIgnore: GroupInviteAction = hasOwner
    ? { action: 'queue' }
    : { action: 'ignore', reason: 'no-owner' };

  if (!isGroupInviteAllowed(inviterShip, allowlist)) {
    return queueOrIgnore;
  }

  // Allowlisted: auto-accept only on a positive "not blocked" confirmation.
  let blockedShips: string[];
  try {
    blockedShips = await deps.fetchBlockedShips();
  } catch {
    // Lookup failed or timed out — unknown. Fall through to queue/no-owner;
    // never auto-accept on an unconfirmed lookup.
    return queueOrIgnore;
  }

  const normalizedInviter = normalizeShip(inviterShip);
  if (blockedShips.some((s) => normalizeShip(s) === normalizedInviter)) {
    // Confirmed blocked — silent ignore directly, not the queue path.
    return { action: 'ignore', reason: 'blocked' };
  }

  return { action: 'accept', reason: 'allowlisted' };
}

/**
 * Whether a channel's authorization mode gates senders against an allowlist.
 *
 * SECURITY: Fail-closed — a channel is access-controlled unless its mode is
 * explicitly "open". "allowlist" (what the app saves and Solaris stores),
 * legacy "restricted", and any unrecognized or missing value all count as
 * restricted. Enforcing only on "restricted" (as before) let an allowlisted
 * channel saved from the settings form fall through to open.
 */
export function isChannelRestricted(mode: string | undefined): boolean {
  return mode !== 'open';
}

// Helper to recursively extract text from inline content
function extractInlineText(items: any[]): string {
  return items
    .map((item: any) => {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object') {
        if (item.ship) {
          return item.ship;
        }
        if ('sect' in item) {
          return `@${item.sect || 'all'}`;
        }
        if (item['inline-code']) {
          return `\`${item['inline-code']}\``;
        }
        if (item.code) {
          return `\`${item.code}\``;
        }
        if (item.link && item.link.href) {
          return item.link.content || item.link.href;
        }
        if (item.bold && Array.isArray(item.bold)) {
          return `**${extractInlineText(item.bold)}**`;
        }
        if (item.italics && Array.isArray(item.italics)) {
          return `*${extractInlineText(item.italics)}*`;
        }
        if (item.strike && Array.isArray(item.strike)) {
          return `~~${extractInlineText(item.strike)}~~`;
        }
      }
      return '';
    })
    .join('');
}

export function extractMessageText(
  content: unknown,
  opts: { omitCites?: boolean } = {}
): string {
  if (!content || !Array.isArray(content)) {
    return '';
  }

  return content
    .map((verse: any) => {
      // Handle inline content (text, ships, links, etc.)
      if (verse.inline && Array.isArray(verse.inline)) {
        return verse.inline
          .map((item: any) => {
            if (typeof item === 'string') {
              return item;
            }
            if (item && typeof item === 'object') {
              if (item.ship) {
                return item.ship;
              }
              // Handle sect (role mentions like @all)
              if ('sect' in item) {
                return `@${item.sect || 'all'}`;
              }
              if (item.break !== undefined) {
                return '\n';
              }
              if (item.link && item.link.href) {
                return item.link.href;
              }
              // Handle inline code (Tlon uses "inline-code" key)
              if (item['inline-code']) {
                return `\`${item['inline-code']}\``;
              }
              if (item.code) {
                return `\`${item.code}\``;
              }
              // Handle bold/italic/strike - recursively extract text
              if (item.bold && Array.isArray(item.bold)) {
                return `**${extractInlineText(item.bold)}**`;
              }
              if (item.italics && Array.isArray(item.italics)) {
                return `*${extractInlineText(item.italics)}*`;
              }
              if (item.strike && Array.isArray(item.strike)) {
                return `~~${extractInlineText(item.strike)}~~`;
              }
              // Handle blockquote inline
              if (item.blockquote && Array.isArray(item.blockquote)) {
                return `> ${extractInlineText(item.blockquote)}`;
              }
            }
            return '';
          })
          .join('');
      }

      // Handle block content (images, code blocks, etc.)
      if (verse.block && typeof verse.block === 'object') {
        const block = verse.block;

        // Image blocks
        if (block.image && block.image.src) {
          const alt = block.image.alt ? ` (${block.image.alt})` : '';
          return `\n${block.image.src}${alt}\n`;
        }

        // Code blocks
        if (block.code && typeof block.code === 'object') {
          const lang = block.code.lang || '';
          const code = block.code.code || '';
          return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
        }

        // Header blocks
        if (block.header && typeof block.header === 'object') {
          const text =
            block.header.content
              ?.map((item: any) => (typeof item === 'string' ? item : ''))
              .join('') || '';
          return `\n## ${text}\n`;
        }

        // Cite/quote blocks - parse the reference structure
        if (block.cite && typeof block.cite === 'object') {
          if (opts.omitCites) {
            return '';
          }
          const cite = block.cite;

          // ChanCite - reference to a channel message
          if (cite.chan && typeof cite.chan === 'object') {
            const { nest, where } = cite.chan;
            if (typeof nest === 'string' && nest.length > 0) {
              return `\n> [quoted from ${nest}]\n`;
            }
            return '\n> [quoted message]\n';
          }

          // GroupCite - reference to a group
          if (cite.group && typeof cite.group === 'string') {
            return `\n> [ref: group ${cite.group}]\n`;
          }

          // DeskCite - reference to an app/desk
          if (cite.desk && typeof cite.desk === 'object') {
            return `\n> [ref: ${cite.desk.flag}]\n`;
          }

          // BaitCite - reference with group+graph context
          if (cite.bait && typeof cite.bait === 'object') {
            return `\n> [ref: ${cite.bait.graph} in ${cite.bait.group}]\n`;
          }

          return `\n> [quoted message]\n`;
        }
      }

      return '';
    })
    .join('\n')
    .trim();
}

export function prepareInboundText(
  content: unknown,
  botShipName: string,
  nickname?: string
): { rawText: string; engagementText: string; mentioned: boolean } {
  const rawText = extractMessageText(content);
  const engagementText = extractMessageText(content, { omitCites: true });
  return {
    rawText,
    engagementText,
    mentioned: isBotMentioned(engagementText, botShipName, nickname),
  };
}

export function isSummarizationRequest(messageText: string): boolean {
  const patterns = [
    /summarize\s+(this\s+)?(channel|chat|conversation)/i,
    /what\s+did\s+i\s+miss/i,
    /catch\s+me\s+up/i,
    /channel\s+summary/i,
    /tldr/i,
  ];
  return patterns.some((pattern) => pattern.test(messageText));
}

export function formatChangesDate(daysAgo = 5): string {
  const now = new Date();
  const targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();
  return `~${year}.${month}.${day}..20.19.51..9b9d`;
}

/**
 * Sanitize user message text to prevent prompt injection via role tags
 * and control directives.
 *
 * Role tags like [owner] in message bodies could trick the LLM into
 * granting elevated privileges. Block directives could trigger automated
 * actions if echoed back by the LLM.
 *
 * Converts role tags from [brackets] to (parentheses) to preserve meaning
 * while breaking the structured format the LLM recognizes.
 * Strips block directives entirely as they have no legitimate user purpose.
 */
export function sanitizeMessageText(text: string): string {
  if (!text) {
    return text;
  }

  // Strip [BLOCK_USER: ~ship | reason] directives entirely
  let sanitized = text.replace(/\[BLOCK_USER:\s*~[\w-]+\s*\|\s*.+?\]/gi, '');

  // Convert role tags from [brackets] to (parentheses)
  sanitized = sanitized.replace(/\[(owner|user|admin|system)\]/gi, '($1)');

  return sanitized;
}
