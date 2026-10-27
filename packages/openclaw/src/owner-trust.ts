/**
 * Where owner privilege can be trusted.
 *
 * A post's author is only as trustworthy as the ship that relays it. A 1:1 DM
 * names its partner in `whom`, so the partner is verified. A channel post
 * arrives through the channel's host, and %channels-server lets the host set
 * any author on posts and reactions. So an owner-attributed channel post is
 * verified only when the host is the owner or this bot. Even there, an edit is
 * never verified: an edit replaces a post or reply without re-checking the
 * author it declares, so only a newly created post or reply can carry owner
 * privilege.
 *
 * Owner ACCESS (skipping the channel allowlist and the approval card, owner
 * engagement) may follow the declared author: a host can forge any allowlisted
 * member anyway, so an approval card buys nothing. Owner PRIVILEGE (the
 * 'owner' sender role and everything keyed on it: commands, owner-only tools,
 * the owner session, onboarding/campaign flags, owner activity) is granted only
 * where `isOwnerPrivilegeTrusted` says so.
 */
import type { SenderRole } from './session-roles.js';
import { isDmNest, normalizeShip, parseChannelNest } from './targets.js';

/** Whether a channel message is a newly created post or reply, or an edit. */
export type MessageOrigin = 'create' | 'edit';

export type OwnerTrustSource =
  | { kind: 'dm'; partnerShip: string }
  | { kind: 'channel'; hostShip: string | null; origin: MessageOrigin };

export type ConversationKind =
  | 'dm'
  | 'ownerHostedChannel'
  | 'botHostedChannel'
  | 'foreignHostedChannel';

export type OwnerTrustContext = {
  ownerShip: string | null;
  botShip: string;
};

/** Shown where an owner command or owner-only tool cannot run. */
export const OWNER_PRIVILEGE_ELSEWHERE_TEXT =
  'I only take owner commands in our DM or in a group you or I host.';

/**
 * The trust source for a conversation id (a DM ship or a channel nest) and the
 * message's origin. The origin only matters for channels.
 */
export function ownerTrustSourceFor(
  conversation: string,
  origin: MessageOrigin
): OwnerTrustSource {
  if (isDmNest(conversation)) {
    return { kind: 'dm', partnerShip: conversation };
  }
  return {
    kind: 'channel',
    hostShip: parseChannelNest(conversation)?.hostShip ?? null,
    origin,
  };
}

/** What a channel post's `/v4` revision says: revision 0, a later one, or none. */
export type ChannelRevisionState = 'create' | 'edit' | 'missing revision';

export function channelRevisionState(
  set: { revision?: unknown } | null | undefined
): ChannelRevisionState {
  const revision = set?.revision;
  if (revision === undefined || revision === null || revision === '') {
    return 'missing revision';
  }
  return revision === '0' || revision === 0 ? 'create' : 'edit';
}

/**
 * The origin of a channel post or reply from its `/v4` `set` payload. Hosts
 * create posts and replies at revision 0 and bump the revision on every edit,
 * so anything else, including a missing revision, is an edit.
 */
export function channelMessageOrigin(
  set: { revision?: unknown } | null | undefined
): MessageOrigin {
  return channelRevisionState(set) === 'create' ? 'create' : 'edit';
}

/**
 * Why an owner-attributed channel message runs without owner privilege, for
 * logs: an operator can tell a host that omits revisions from a real edit.
 * Called only once privilege was withheld, so on a trusted host the revision
 * state is the reason.
 */
export function channelPrivilegeWithheldReason(
  hostTrusted: boolean,
  revision: ChannelRevisionState
): ChannelRevisionState | 'host is neither the owner nor this bot' {
  return hostTrusted ? revision : 'host is neither the owner nor this bot';
}

/**
 * The sender identity handed to OpenClaw core. Core matches it against
 * `commands.ownerAllowFrom` on its own and does not read SenderRole, so an
 * owner attribution without owner privilege is qualified by its conversation
 * and cannot match any owner entry.
 */
export function coreSenderId(
  senderShip: string,
  senderRole: SenderRole,
  conversation: string,
  context: OwnerTrustContext
): string {
  const ship = normalizeShip(senderShip);
  const claimsOwner =
    context.ownerShip !== null && ship === normalizeShip(context.ownerShip);
  return claimsOwner && senderRole !== 'owner'
    ? `${ship}@${conversation}`
    : ship;
}

export function conversationKindOf(
  source: OwnerTrustSource,
  context: OwnerTrustContext
): ConversationKind {
  if (source.kind === 'dm') return 'dm';
  const host = source.hostShip ? normalizeShip(source.hostShip) : null;
  if (host && context.ownerShip && host === normalizeShip(context.ownerShip)) {
    return 'ownerHostedChannel';
  }
  if (host && host === normalizeShip(context.botShip)) {
    return 'botHostedChannel';
  }
  return 'foreignHostedChannel';
}

/**
 * Whether an owner-attributed message from this source can carry owner
 * privilege: a DM whose partner is the owner, or a newly created post or reply
 * in a channel hosted by the owner or the bot.
 */
export function isOwnerPrivilegeTrusted(
  source: OwnerTrustSource,
  context: OwnerTrustContext
): boolean {
  if (!context.ownerShip) return false;
  if (source.kind === 'dm') {
    return (
      normalizeShip(source.partnerShip) === normalizeShip(context.ownerShip)
    );
  }
  if (source.origin !== 'create') return false;
  const kind = conversationKindOf(source, context);
  return kind === 'ownerHostedChannel' || kind === 'botHostedChannel';
}

/** The sender role: 'owner' only for the owner, from a trusted source. */
export function resolveSenderRole(
  senderShip: string,
  source: OwnerTrustSource,
  context: OwnerTrustContext
): SenderRole {
  return context.ownerShip !== null &&
    normalizeShip(senderShip) === normalizeShip(context.ownerShip) &&
    isOwnerPrivilegeTrusted(source, context)
    ? 'owner'
    : 'user';
}
