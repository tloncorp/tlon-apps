import { da } from '@urbit/aura';

import { sharedMap, sharedSlot } from './shared-state.js';
import { normalizeShip } from './targets.js';

/**
 * Owner-credentialed posts, edits, reactions and reaction removals this
 * process made through the tlon tool. The monitor treats a match as this bot's own action: never a
 * command, never an engagement trigger, never owner activity. Matching uses
 * provenance only (author, the plugin-assigned `sent`, post ids, the reaction
 * the tool sent); message text is never read.
 *
 * In memory only, process-wide via sharedMap: an in-process monitor restart
 * keeps it, a gateway restart loses it. The window that leaves open is a
 * restart between the tool's send and the monitor handling the post, with
 * restart replay then re-delivering it to an empty ledger.
 *
 * Top-level post edits are recorded although the monitor does not read
 * `r-post.essay` today, so a future reader of edits is already covered.
 */

/**
 * Entries expire only by time. Restart replay is keyed on ship receipt time
 * and a remote host can deliver late, so this is far longer than the replay
 * window; a post first delivered more than 6 h after the send is the accepted
 * residual.
 */
export const OWNER_TOOL_POST_TTL_MS = 6 * 60 * 60_000;
/**
 * Unresolved provenance is never evicted: once an account has this many live
 * entries, further owner writes are refused instead. Released entries make
 * room for new ones, oldest first.
 */
export const OWNER_TOOL_POST_LIMIT = 500;
/**
 * How long after it is recorded a shortcode reaction entry matches any
 * reaction: the desk rewrites the shortcode to Unicode, which this plugin
 * cannot predict, and the tool's own reaction arrives within seconds. Every
 * reaction matched in the window is taken as the tool's and keeps matching
 * exactly until the entry expires, since channel reaction snapshots replay it
 * on every later change to the post.
 */
export const SHORTCODE_MATCH_WINDOW_MS = 30_000;
// The ship stores `sent` as @da and re-emits it in ms; depending on rounding
// the value that comes back can be one below the one sent.
const SENT_TOLERANCE_MS = 1;

type OwnerToolPostBase = {
  accountId: string;
  /**
   * null when the acting ship is not known; the target still must match.
   * Only a send, which its `sentAt` pins down, matches with no author.
   */
  author: string | null;
  /** Nest, DM ship or club id, as the command named it. */
  target: string;
};

export type OwnerToolPost =
  | (OwnerToolPostBase & { kind: 'send'; sentAt: number })
  | (OwnerToolPostBase & { kind: 'edit'; postId: string; parentId?: string })
  | (OwnerToolPostBase & {
      kind: 'react';
      postId: string;
      parentId?: string;
      /**
       * As the command gave it. The desk converts a recognized `:shortcode:`
       * to its Unicode emoji before the reaction reaches the firehose, so a
       * shortcode entry matches on author and post alone within
       * SHORTCODE_MATCH_WINDOW_MS, and afterwards only the reactions it
       * matched then (see isShortcodeReaction); anything else must match
       * exactly.
       */
      reaction: string;
    })
  | (OwnerToolPostBase & {
      kind: 'unreact';
      postId: string;
      parentId?: string;
    });

/** What the monitor knows about an inbound post, edit or reaction. */
export type InboundPost = {
  author: string;
  /** Nest, DM partner ship or club id. */
  target: string;
  /**
   * The ship whose monitor received it. A one-to-one DM's `target` is the
   * partner, while a ledger entry names the recipient, so an entry addressed
   * to a ship matches against this instead.
   */
  receivingShip?: string;
  sent?: number;
  /** Channel post id, reply id or writ id. */
  postId?: string;
  /** The thread's top-level post, when postId is a channel reply. */
  parentId?: string;
  /** Set for a reaction, and only then. */
  reaction?: string;
  /** Set for a reaction removal, which names no reaction, and only then. */
  reactionRemoved?: true;
};

export type OwnerToolPostReservation = {
  /**
   * The run failed: free the capacity slot. The entry stays matchable until
   * it expires, since a failed run may still have reached the ship, unless
   * the account needs its room first (see OWNER_TOOL_POST_LIMIT).
   */
  release(): void;
};

export type OwnerToolPostLedger = {
  /** A fresh `sent`: monotonic in this process, max(now, last + 1). */
  allocateSentAt(): number;
  /** Records the post before it runs; null when the account is full. */
  reserve(post: OwnerToolPost): OwnerToolPostReservation | null;
  match(inbound: InboundPost | null): OwnerToolPost | null;
};

type StoredEntry = {
  post: OwnerToolPost;
  /** For a shortcode reaction: the reactions it matched in the window. */
  seen: Set<string>;
  recordedAt: number;
  holdsSlot: boolean;
};

type SentAtSlot = { get(): number | null; set(value: number | null): void };

const ENTRIES_SLOT = 'ownerToolPosts.entries';
const LAST_SENT_AT_SLOT = 'ownerToolPosts.lastSentAt';

/** A post or writ id as digits: no `author/` prefix, no dots. */
export function canonicalPostId(id: string): string {
  return id.slice(id.indexOf('/') + 1).replace(/\./g, '');
}

/**
 * Nest, ship or club id in one spelling, for comparing targets. A nest's
 * channel name is case-sensitive and kept as given (see canonicalizeNest).
 */
export function canonicalTarget(target: string): string {
  const trimmed = target.trim();
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    return `${parts[0].toLowerCase()}/${normalizeShip(parts[1])}/${parts[2]}`;
  }
  const lower = trimmed.toLowerCase();
  return lower.startsWith('0v') ? lower : normalizeShip(lower);
}

/**
 * The forms the desk's +kill:emojimart parses: `:name:` or `::name::`, then
 * an optional `:skin-tone-1:` through `:skin-tone-6:`. The desk takes any
 * non-colon characters as the name; every name in its table uses this set.
 */
const SHORTCODE_REACTION =
  /^(?::[A-Za-z0-9_+-]+:|::[A-Za-z0-9_+-]+::)(?::skin-tone-[1-6]:)?$/;

/**
 * A shortcode the desk may normalize to Unicode. The reaction match only
 * keeps the bot from waking on its own reactions (reactions are never command
 * input), so ignoring the reaction string for these is a safe over-match.
 */
export function isShortcodeReaction(reaction: string): boolean {
  return SHORTCODE_REACTION.test(reaction);
}

function isShipTarget(canonical: string): boolean {
  return canonical.startsWith('~') && !canonical.includes('/');
}

function targetMatches(entryTarget: string, inbound: InboundPost) {
  const target = canonicalTarget(entryTarget);
  if (isShipTarget(target)) {
    // Only a one-to-one DM names its partner rather than its recipient; a
    // club or channel post that reaches that ship was not sent to it.
    return (
      isShipTarget(canonicalTarget(inbound.target)) &&
      inbound.receivingShip !== undefined &&
      target === normalizeShip(inbound.receivingShip)
    );
  }
  return target === canonicalTarget(inbound.target);
}

function sameParent(entryParent?: string, inboundParent?: string) {
  if (entryParent === undefined || inboundParent === undefined) {
    return entryParent === inboundParent;
  }
  return canonicalPostId(inboundParent) === entryParent;
}

function matchesEntry(
  post: OwnerToolPost,
  inbound: InboundPost,
  age: number,
  seen: ReadonlySet<string>
): boolean {
  // The target is compared for a known author too: edit and reaction entries
  // carry no timestamp, so the same post id elsewhere would otherwise match.
  // A one-to-one DM with a known author reaches this only at another account
  // of this process whose bot was the recipient: an owner DM to this bot
  // itself is refused by checkOwnerSelfDm.
  if (
    post.author === null
      ? post.kind !== 'send'
      : normalizeShip(post.author) !== normalizeShip(inbound.author)
  ) {
    return false;
  }
  if (!targetMatches(post.target, inbound)) return false;
  if (post.kind === 'unreact') {
    return (
      inbound.reactionRemoved === true &&
      inbound.postId !== undefined &&
      canonicalPostId(inbound.postId) === post.postId &&
      sameParent(post.parentId, inbound.parentId)
    );
  }
  if (inbound.reactionRemoved) return false;
  if (post.kind === 'react') {
    return (
      inbound.reaction !== undefined &&
      inbound.postId !== undefined &&
      canonicalPostId(inbound.postId) === post.postId &&
      sameParent(post.parentId, inbound.parentId) &&
      (inbound.reaction === post.reaction ||
        (isShortcodeReaction(post.reaction) &&
          (age <= SHORTCODE_MATCH_WINDOW_MS || seen.has(inbound.reaction))))
    );
  }
  if (inbound.reaction !== undefined) return false;
  if (post.kind === 'edit') {
    return (
      inbound.postId !== undefined &&
      canonicalPostId(inbound.postId) === post.postId &&
      sameParent(post.parentId, inbound.parentId)
    );
  }
  if (
    inbound.sent !== undefined &&
    Math.abs(inbound.sent - post.sentAt) <= SENT_TOLERANCE_MS
  ) {
    return true;
  }
  // DM and club writ ids are client-assigned from `sent`, so they match
  // exactly whatever the ship does to the timestamp.
  return (
    inbound.postId !== undefined &&
    inbound.postId.includes('/') &&
    canonicalPostId(inbound.postId) === da.fromUnix(post.sentAt).toString()
  );
}

export function createOwnerToolPostLedger(
  opts: {
    now?: () => number;
    store?: Map<string, StoredEntry[]>;
    lastSentAt?: SentAtSlot;
  } = {}
): OwnerToolPostLedger {
  const now = opts.now ?? Date.now;
  const store = opts.store ?? new Map<string, StoredEntry[]>();
  let localLastSentAt: number | null = null;
  const lastSentAt: SentAtSlot = opts.lastSentAt ?? {
    get: () => localLastSentAt,
    set: (value) => {
      localLastSentAt = value;
    },
  };
  const live = (entry: StoredEntry, at: number) =>
    at - entry.recordedAt <= OWNER_TOOL_POST_TTL_MS;

  return {
    allocateSentAt() {
      const last = lastSentAt.get();
      const sentAt = last === null ? now() : Math.max(now(), last + 1);
      lastSentAt.set(sentAt);
      return sentAt;
    },
    reserve(post) {
      const at = now();
      let entries = (store.get(post.accountId) ?? []).filter((entry) =>
        live(entry, at)
      );
      store.set(post.accountId, entries);
      if (
        entries.filter((entry) => entry.holdsSlot).length >=
        OWNER_TOOL_POST_LIMIT
      ) {
        return null;
      }
      let excess = entries.length + 1 - OWNER_TOOL_POST_LIMIT;
      entries = entries.filter((entry) => entry.holdsSlot || excess-- <= 0);
      store.set(post.accountId, entries);
      const entry: StoredEntry = {
        post,
        seen: new Set(),
        recordedAt: at,
        holdsSlot: true,
      };
      entries.push(entry);
      return {
        release() {
          entry.holdsSlot = false;
        },
      };
    },
    match(inbound) {
      if (!inbound) return null;
      const at = now();
      // Every account's entries: a second account's monitor with the same
      // owner sees the same owner-authored post. A different owner never
      // matches, because the author differs. The scan continues past the
      // first hit so every shortcode entry it matches records the reaction:
      // another account's entry for the same post may outlive the hit.
      let hit: OwnerToolPost | null = null;
      for (const entries of store.values()) {
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          const entry = entries[i];
          if (
            !live(entry, at) ||
            !matchesEntry(
              entry.post,
              inbound,
              at - entry.recordedAt,
              entry.seen
            )
          ) {
            continue;
          }
          hit ??= entry.post;
          if (
            entry.post.kind === 'react' &&
            inbound.reaction !== undefined &&
            isShortcodeReaction(entry.post.reaction)
          ) {
            entry.seen.add(inbound.reaction);
          }
        }
      }
      return hit;
    },
  };
}

/** The process-wide ledger: the tool records, the monitor matches. */
export function sharedOwnerToolPostLedger(): OwnerToolPostLedger {
  return createOwnerToolPostLedger({
    store: sharedMap<string, StoredEntry[]>(ENTRIES_SLOT),
    lastSentAt: sharedSlot<number>(LAST_SENT_AT_SLOT),
  });
}

type ChannelPostResponse = {
  post?: {
    id?: string;
    'r-post'?: {
      set?: { essay?: { sent?: number } };
      reply?: {
        id?: string;
        'r-reply'?: { set?: { 'reply-essay'?: { sent?: number } } };
      };
    };
  };
};

/**
 * A channel firehose post or reply (new or edited) as the monitor reads it:
 * `r-post.set.essay` or `r-reply.set.reply-essay`.
 */
export function channelInboundPost(
  nest: string,
  response: unknown,
  author: string
): InboundPost | null {
  const post = (response as ChannelPostResponse | null)?.post;
  const reply = post?.['r-post']?.reply;
  const replyEssay = reply?.['r-reply']?.set?.['reply-essay'];
  const content = replyEssay ?? post?.['r-post']?.set?.essay;
  if (!content) return null;
  const postId = replyEssay ? reply?.id : post?.id;
  return {
    author,
    target: nest,
    ...(typeof content.sent === 'number' ? { sent: content.sent } : {}),
    ...(postId ? { postId } : {}),
    ...(replyEssay && post?.id ? { parentId: post.id } : {}),
  };
}

type ChatWritEvent = {
  whom: unknown;
  id: string;
  response: unknown;
};

type ChatWritResponse = {
  add?: { essay?: { sent?: number } };
  reply?: {
    id?: string;
    delta?: { add?: { 'reply-essay'?: { sent?: number }; id?: string } };
  };
};

function whomTarget(whom: unknown): string {
  if (typeof whom === 'string') return whom;
  if (whom && typeof whom === 'object') {
    const { ship, club } = whom as { ship?: unknown; club?: unknown };
    if (typeof ship === 'string') return ship;
    if (typeof club === 'string') return club;
  }
  return '';
}

/**
 * A DM or club writ, or a DM thread reply, as the monitor reads it, received
 * by `receivingShip`. A writ's post id is the writ id; a reply's is its own
 * id, and a reply event without one carries no post id rather than the
 * parent writ's, which would identify the parent.
 */
export function chatInboundPost(
  event: ChatWritEvent,
  author: string,
  receivingShip: string
): InboundPost | null {
  const response = event.response as ChatWritResponse | null;
  const replyEssay = response?.reply?.delta?.add?.['reply-essay'];
  const content = replyEssay ?? response?.add?.essay;
  if (!content) return null;
  const postId = replyEssay
    ? (response?.reply?.id ?? response?.reply?.delta?.add?.id)
    : event.id;
  return {
    author,
    target: whomTarget(event.whom),
    receivingShip,
    ...(typeof content.sent === 'number' ? { sent: content.sent } : {}),
    ...(postId ? { postId } : {}),
  };
}

export const _testing = {
  clear() {
    sharedMap(ENTRIES_SLOT).clear();
    sharedSlot<number>(LAST_SENT_AT_SLOT).set(null);
  },
};
