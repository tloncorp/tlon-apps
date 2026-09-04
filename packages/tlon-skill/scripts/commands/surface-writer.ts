import type { SurfaceSpec } from '@tloncorp/api';

import {
  type ObservationBudget,
  type SurfaceDeps,
  type SurfaceGroupChannel,
  type SurfacePostRecord,
  type SurfaceRecordKind,
  SURFACE_KIND_TAILS,
  buildSurfaceBlob,
  channelHostShip,
  observeUntil,
  parseSurfaceNest,
  surfaceError,
  surfaceWireKind,
} from './surface-common';
import {
  assertWriteInScope,
  surfacePreStateIdentity,
} from '../surface-write-scope';

/**
 * The shared writer layer for surface records, and the read that every
 * writer here confirms itself against.
 *
 * Nothing in this file treats a poke as a result. `sendPost` is an untracked
 * poke — it returns once the local agent has taken the action, which says
 * nothing about whether `%channels-server` accepted it — so a written post
 * is a post that has been read back, matched on content, shown to postdate
 * the channel's pre-write head, and confirmed to still carry its surface
 * kind. Content without the head check is not a weaker version of this
 * check; it is a different claim ("a post like this exists") that a silent
 * no-op over an identical earlier post satisfies with no write at all.
 */

export const DEFAULT_PAGE_SIZE = 200;
export const DEFAULT_MAX_POSTS = 5000;

export interface ResolvedSurfaceChannel {
  channelId: string;
  groupId: string;
  hostShip: string;
  channel: SurfaceGroupChannel;
}

/**
 * Why every caller has to say whether it is about to write.
 *
 * `resolveSurfaceChannel` is the only place in the surface commands that turns
 * a channel id into a group id, which makes it the only place a group fence can
 * be applied without every command having to remember to. Reads must stay
 * unfenced — the preflight reads channels it is not bound to write, and so does
 * anyone diagnosing one — so the fence needs an intent, and an intent that
 * DEFAULTED to `read` would let a new write command slip past it by saying
 * nothing at all. The argument is required, so adding a write command without
 * deciding is a type error rather than a silent hole.
 */
export type SurfaceAccess =
  | { intent: 'read' }
  | { intent: 'write'; operation: string };

/**
 * Locates a channel in both agents and returns its group listing.
 *
 * `%channels` is asked first because it is the only place that knows which
 * group a nest belongs to; `%groups` is asked second because it is the only
 * place that holds the description cell, which is where a surface's app
 * definition lives. A channel present in one and not the other is the
 * half-created state D50 describes, and it is reported as such rather than
 * as a plain "not found".
 *
 * On a write, the resolved group and channel are checked against the process's
 * write fence (`surface-write-scope.ts`) before the caller sees them.
 */
export async function resolveSurfaceChannel(
  deps: SurfaceDeps,
  channelId: string,
  access: SurfaceAccess
): Promise<ResolvedSurfaceChannel> {
  parseSurfaceNest(channelId);
  const nests = await deps.readChannelNests();
  const nest = Object.prototype.hasOwnProperty.call(nests, channelId)
    ? nests[channelId]
    : undefined;
  if (!nest) {
    throw surfaceError(
      'channel-not-found',
      `%channels does not hold ${channelId} on this ship.`,
      { channel: channelId }
    );
  }
  const groupId = nest.perms?.group;
  if (typeof groupId !== 'string' || !/^~[a-z-]+\/.+$/.test(groupId)) {
    throw surfaceError(
      'channel-not-found',
      `%channels holds ${channelId} but it belongs to no group (its group flag is ${
        groupId ? `"${groupId}"` : 'absent'
      }). That is the half-created state a deleted channel leaves behind; the channel cannot be used or repaired.`,
      { channel: channelId, groupFlag: groupId ?? null }
    );
  }
  const groupChannels = await deps.readGroupChannels(groupId);
  const channel = groupChannels
    ? Object.prototype.hasOwnProperty.call(groupChannels, channelId)
      ? groupChannels[channelId]
      : undefined
    : undefined;
  if (!channel) {
    throw surfaceError(
      'channel-not-found',
      `${groupId} does not list ${channelId}, although %channels holds it. The channel is half-created and cannot be used.`,
      { channel: channelId, group: groupId }
    );
  }
  if (access.intent === 'write') {
    assertWriteInScope(deps.writeScope, {
      channelId,
      groupId,
      operation: access.operation,
    });
  }
  return {
    channelId,
    groupId,
    hostShip: channelHostShip(channelId),
    channel,
  };
}

/**
 * How wide a window the pre-state identity reads when a channel has no spec.
 *
 * A sequenced channel is identified by its head alone and one post would do.
 * An unsequenced or empty one is identified by the id set, and the set has to
 * be wide enough that "a post arrived since the bound was taken" changes it.
 */
const PRE_STATE_HEAD_WINDOW = 25;

/**
 * What the channel looks like right now, in the one form the write fence
 * compares against (`surface-write-scope.ts`).
 *
 * A definition that exists but does not validate still has a raw cell, so it
 * still has an identity — a binding taken over an unreadable definition is
 * checkable, which matters because `--allow-unreadable` exists.
 */
export async function readSurfacePreState(
  deps: SurfaceDeps,
  channelId: string,
  current: SurfaceSpecRead
): Promise<string> {
  if (current.status !== 'absent') {
    return surfacePreStateIdentity({
      description: current.raw,
      hasSpec: true,
      postHead: null,
      sha256Hex: deps.sha256Hex,
    });
  }
  const head = await readPostHead(deps, channelId, PRE_STATE_HEAD_WINDOW);
  const postHead =
    head.sequenceNum !== null
      ? `seq:${head.sequenceNum}`
      : head.ids.size === 0
        ? 'empty'
        : `ids:${deps.sha256Hex(
            new TextEncoder().encode([...head.ids].sort().join(','))
          )}`;
  return surfacePreStateIdentity({
    description: null,
    hasSpec: false,
    postHead,
    sha256Hex: deps.sha256Hex,
  });
}

/**
 * The definition a write is about to replace, in a form two reads can be
 * compared in.
 *
 * NARROWER than `readSurfacePreState` on purpose. That one is the operator's
 * bound — it folds the post head in, so "a member chatted" changes it, which
 * is right for "is this the channel you asserted about" and wrong for "is
 * this still the definition I read". A write-time fence built on it would
 * refuse a publish because somebody said hello during the upload.
 *
 * `absent` is a value here, not a hole: "no definition, still no definition"
 * is exactly the claim `surface fork` and `channels update` make, and a
 * fence that could not express it would have nothing to check.
 */
export function surfaceDefinitionIdentity(
  deps: SurfaceDeps,
  read: SurfaceSpecRead
): string {
  if (read.status === 'absent') {
    return 'absent';
  }
  return `spec:${deps.sha256Hex(new TextEncoder().encode(read.raw))}`;
}

/**
 * The write-time half of "the pre-state must still hold at write time".
 *
 * Every surface write is read-modify-write across seconds of asynchronous
 * work — a gate run, a bundle upload, an observation budget — and %groups
 * takes a whole channel value with no version or CAS token. So a check that
 * ran before the upload proves nothing about the state the write lands on:
 * publish reads revision 1, another admin publishes revision 2, and the
 * first command overwrites 2 and then reads ITS OWN WRITE back as
 * confirmation. The readback certifies the overwrite.
 *
 * This re-reads the target immediately before the write and refuses on any
 * change, naming both identities. It also RETURNS the fresh channel, and
 * every caller builds its payload from that rather than from the value it
 * read minutes ago — otherwise the full-cell overwrite drops a concurrent
 * edit to an unrelated field (title, image) even when the definition itself
 * did not move.
 *
 * Residual, stated plainly: this narrows the window from "the whole command"
 * to "one round trip", it does not close it. Closing it needs a
 * compare-and-swap on the description cell in %groups — a backend change,
 * recorded as a v1 item, not something v0 claims (D188).
 */
export async function readDefinitionForWrite(
  deps: SurfaceDeps,
  input: {
    groupId: string;
    channelId: string;
    operation: string;
    /** the identity observed when this command decided to write */
    checked: string;
  }
): Promise<{ channel: SurfaceGroupChannel; identity: string }> {
  const channels = await deps.readGroupChannels(input.groupId);
  // `readGroupChannels` returns null for ANY read failure, so "could not read"
  // and "is not there" arrive as the same value and must not leave as the same
  // sentence. Both refuse — a fence that cannot see its target fails closed —
  // but a bot told the channel was deleted when the scry merely failed will go
  // and create a replacement.
  if (channels === null) {
    throw surfaceError(
      'write-target-moved',
      `${input.operation} could not re-read ${input.channelId} from ${input.groupId} immediately before writing, so it cannot tell whether the definition it read is still the one it would replace. Nothing was written. This is a read failure, not a missing channel: try again.`,
      {
        operation: input.operation,
        channel: input.channelId,
        group: input.groupId,
        checkedIdentity: input.checked,
        observedIdentity: 'unreadable',
      }
    );
  }
  const channel = channels[input.channelId];
  if (!channel) {
    throw surfaceError(
      'write-target-moved',
      `${input.operation} was about to write to ${input.channelId}, but ${input.groupId} no longer lists it. Nothing was written.`,
      {
        operation: input.operation,
        channel: input.channelId,
        group: input.groupId,
        checkedIdentity: input.checked,
        observedIdentity: 'gone',
      }
    );
  }
  const identity = surfaceDefinitionIdentity(
    deps,
    readChannelSpec(deps, channel)
  );
  if (identity !== input.checked) {
    throw surfaceError(
      'write-target-moved',
      `${input.operation} checked ${input.channelId} and found ${describeDefinitionIdentity(input.checked)}, but by the time it came to write, the channel carries ${describeDefinitionIdentity(identity)}. Somebody else wrote to this channel while this command was working. Nothing was written — overwriting would have replaced their revision with one derived from a definition that no longer exists, and the read-back afterwards would have confirmed this command's own overwrite. Re-run over the current definition.`,
      {
        operation: input.operation,
        channel: input.channelId,
        checkedIdentity: input.checked,
        observedIdentity: identity,
      }
    );
  }
  return { channel, identity };
}

/** Renders a definition identity for a refusal a person has to read. */
function describeDefinitionIdentity(identity: string): string {
  return identity === 'absent' ? 'no definition' : `the definition ${identity}`;
}

export type SurfaceSpecRead =
  | { status: 'valid'; spec: SurfaceSpec; raw: string }
  | { status: 'absent' }
  | { status: 'invalid'; raw: string }
  | { status: 'version-too-new'; version: number; raw: string };

/** The channel's app definition, read from the authoritative cell. */
export function readChannelSpec(
  deps: SurfaceDeps,
  channel: SurfaceGroupChannel
): SurfaceSpecRead {
  const raw = deps.description.rawSurfaceSpec(channel.meta.description);
  const result = deps.readSpecText(raw);
  if (result.status === 'valid') {
    return { status: 'valid', spec: result.spec, raw: raw ?? '' };
  }
  if (result.status === 'absent') {
    return { status: 'absent' };
  }
  if (result.status === 'version-too-new') {
    return {
      status: 'version-too-new',
      version: result.version,
      raw: raw ?? '',
    };
  }
  return { status: 'invalid', raw: raw ?? '' };
}

/** The spec, or a distinct error naming which of the four states it is in. */
export function requireChannelSpec(
  deps: SurfaceDeps,
  resolved: ResolvedSurfaceChannel
): SurfaceSpec {
  const read = readChannelSpec(deps, resolved.channel);
  if (read.status === 'valid') return read.spec;
  if (read.status === 'absent') {
    throw surfaceError(
      'spec-absent',
      `${resolved.channelId} carries no app definition — it is an ordinary channel, not a dashboard. Publish one with \`tlon surface publish\`.`,
      { channel: resolved.channelId }
    );
  }
  if (read.status === 'version-too-new') {
    throw surfaceError(
      'spec-version-too-new',
      `${resolved.channelId}'s app definition declares version ${read.version}, which this build does not understand. Update the CLI.`,
      { channel: resolved.channelId, version: read.version }
    );
  }
  throw surfaceError(
    'spec-invalid',
    `${resolved.channelId}'s app definition is present but fails validation. It must be republished before anything can be read or written against it.`,
    { channel: resolved.channelId }
  );
}

/* ------------------------------------------------------------------ */
/* Hydration                                                           */
/* ------------------------------------------------------------------ */

export interface HydratedPosts {
  posts: SurfacePostRecord[];
  /** false when paging stopped before reaching the start of the channel */
  complete: boolean;
  pages: number;
  /**
   * The channel's head — the greatest `sequenceNum` the SHIP returned — or
   * null when nothing sequenced came back (D190).
   *
   * This is the CLI's half of the D175 guard. The client passes
   * `channels.lastPostSequenceNum` because its local rows can lag the
   * server; the CLI has no local store, so every post here came from the
   * ship on this call and the greatest one IS the server's head. Without it
   * the CLI folded from a snapshot the client refuses as future-covering and
   * could then write a fresh snapshot from that fold, laundering the bad
   * boundary into a post the client would accept.
   *
   * Only meaningful alongside `complete`: a truncated page walk has not seen
   * the head and every caller already refuses on `complete === false` before
   * reducing.
   */
  head: number | null;
}

export interface HydrateOptions {
  pageSize?: number;
  maxPosts?: number;
}

/**
 * Pages a channel's posts back to its start.
 *
 * `complete` is reported rather than assumed because §6 makes it load
 * bearing: a partial fold is not stale state, it is *wrong* state, so a
 * caller that cannot reach the channel's start must refuse to present a
 * reduction rather than present one with a caveat.
 */
export async function hydratePosts(
  deps: SurfaceDeps,
  channelId: string,
  options: HydrateOptions = {}
): Promise<HydratedPosts> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPosts = options.maxPosts ?? DEFAULT_MAX_POSTS;
  const posts: SurfacePostRecord[] = [];
  let head: number | null = null;
  let cursor: string | undefined;
  let mode: 'newest' | 'older' = 'newest';
  let pages = 0;

  while (posts.length < maxPosts) {
    const page = await deps.readPostPage({
      channelId,
      cursor,
      mode,
      count: pageSize,
    });
    pages += 1;
    posts.push(...page.posts);
    for (const post of page.posts) {
      if (
        typeof post.sequenceNum === 'number' &&
        post.sequenceNum > (head ?? -1)
      ) {
        head = post.sequenceNum;
      }
    }
    if (page.older === null) {
      return { posts, complete: true, pages, head };
    }
    if (page.posts.length === 0) {
      // A cursor that returns nothing but still claims more history is a
      // page we cannot advance past; treating it as the end would silently
      // fold a truncated history.
      return { posts, complete: false, pages, head };
    }
    cursor = page.older;
    mode = 'older';
  }

  return { posts, complete: false, pages, head };
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export interface WrittenSurfacePost {
  postId: string;
  sequenceNum: number | null;
  kind: string | null;
  attempts: number;
}

export interface PostSurfaceRecordInput {
  channelId: string;
  kind: SurfaceRecordKind;
  entry: unknown;
  fallback: string;
  budget?: ObservationBudget;
  matchWindow?: number;
}

/**
 * The channel's head as it stood immediately before a write.
 *
 * Content alone cannot prove a write landed. Author, `sent` and blob are all
 * things the SENDER chose — `sent` especially (D53), which is why two runs of
 * the same command in the same millisecond carry the same one — so a post
 * matching all three may be a post this command wrote, or a post that was
 * already sitting there when it started. The two are told apart by
 * host-stamped identity: the sequence number `%channels-server` assigns, or
 * failing that the id it stamps, neither of which the sender can pick.
 */
interface PostHead {
  /** the highest sequence number the channel held before the write */
  sequenceNum: number | null;
  /** the ids the pre-write window held, for a channel without sequencing */
  ids: Set<string>;
}

export async function readPostHead(
  deps: SurfaceDeps,
  channelId: string,
  window: number
): Promise<PostHead> {
  const page = await deps.readPostPage({
    channelId,
    mode: 'newest',
    count: window,
  });
  const ids = new Set<string>();
  let sequenceNum: number | null = null;
  for (const post of page.posts) {
    ids.add(post.id);
    if (
      typeof post.sequenceNum === 'number' &&
      (sequenceNum === null || post.sequenceNum > sequenceNum)
    ) {
      sequenceNum = post.sequenceNum;
    }
  }
  return { sequenceNum, ids };
}

/**
 * Whether a post is one this command's write produced.
 *
 * A channel that was sequenced before the write answers directly, and answers
 * strictly: `%channels-server` hands out sequence numbers in order, so a post
 * at or below the pre-write head was already there, and a post the host has
 * not sequenced AT ALL is not evidence of anything the host did.
 *
 * The id set is for the one case that has no head to sit above — a channel
 * with no sequenced post in it, which is an empty one. It is sound for the
 * same reason: the baseline window is read at the SAME size as the
 * observation window, so any post the observation can see that the baseline
 * did not hold arrived after the baseline was taken. (A post old enough to
 * have fallen out of the baseline window has, by then, been pushed out of the
 * observation window too.)
 */
function postdatesHead(head: PostHead, post: SurfacePostRecord): boolean {
  if (head.sequenceNum !== null) {
    return (
      typeof post.sequenceNum === 'number' &&
      post.sequenceNum > head.sequenceNum
    );
  }
  return !head.ids.has(post.id);
}

/**
 * Writes one surface record and confirms it landed.
 *
 * The post's id is stamped by the host at `%add` time, so a writer cannot
 * know it in advance and cannot look the post up by id. What it can do is
 * recognise its own post: same author, same `sent` value it supplied, same
 * blob bytes — AND a host-stamped identity above the head the channel had
 * before the poke went out. Matching content is not proof of a write; it is
 * proof that content like this is present, which a silent no-op over an
 * identical earlier post satisfies without writing anything. Once found, the
 * raw `essay.kind` is read straight from `%channels` — a post that came back
 * as a plain `/chat` message is a failure even though every poke succeeded.
 */
export async function postSurfaceRecord(
  deps: SurfaceDeps,
  input: PostSurfaceRecordInput
): Promise<WrittenSurfacePost> {
  const validation = deps.validateEntry(input.kind, input.entry);
  if (!validation.ok) {
    throw surfaceError(
      'invalid-ops',
      `The ${input.kind} record does not satisfy its schema: ${validation.issues.join('; ')}`,
      { kind: input.kind, issues: validation.issues }
    );
  }

  const blob = buildSurfaceBlob(input.entry);
  const sentAt = deps.now();
  const author = deps.normalizeShip(deps.actingShip());
  const window = input.matchWindow ?? 25;
  const head = await readPostHead(deps, input.channelId, window);

  await deps.sendSurfacePost({
    channelId: input.channelId,
    kindTail: SURFACE_KIND_TAILS[input.kind],
    fallback: input.fallback,
    blob,
    sentAt,
  });

  const budget = input.budget ?? deps.observationBudget;
  /** the newest matching post that was already there, if the write left none */
  let matchedExisting: string | null = null;
  const observation = await observeUntil(deps, budget, async () => {
    const page = await deps.readPostPage({
      channelId: input.channelId,
      mode: 'newest',
      count: window,
    });
    const matches = page.posts.filter(
      (post) =>
        deps.normalizeShip(post.authorId) === author &&
        post.sentAt === sentAt &&
        post.blob === blob
    );
    const match = matches.find((post) => postdatesHead(head, post));
    if (match) {
      matchedExisting = null;
      return { done: true, value: match };
    }
    const stale = matches[0];
    matchedExisting = stale?.id ?? null;
    return {
      done: false,
      detail: stale
        ? `${input.channelId} holds a ${input.kind} record by ${author} with exactly this content, but it is post ${stale.id}, which was already there before this write — the send left no new post behind`
        : `no post by ${author} carrying this ${input.kind} record has appeared in ${input.channelId}`,
    };
  });

  if (!observation.ok) {
    throw surfaceError(
      'post-unconfirmed',
      `The ${input.kind} record was poked but never appeared in ${input.channelId}: ${observation.detail}. ` +
        'A poke that resolves is not a post that landed — %channels acks locally, and %channels-server may still have rejected it.',
      {
        channel: input.channelId,
        kind: input.kind,
        observed: observation.detail,
        attempts: observation.attempts,
        matchedExistingPost: matchedExisting,
      }
    );
  }

  const post = observation.value;
  const kind = await deps.readPostKind(input.channelId, post.id);
  assertKindTail(deps, input.channelId, post.id, input.kind, kind);

  return {
    postId: post.id,
    sequenceNum: post.sequenceNum ?? null,
    kind,
    attempts: observation.attempts,
  };
}

function assertKindTail(
  deps: SurfaceDeps,
  channelId: string,
  postId: string,
  kind: SurfaceRecordKind,
  observed: string | null
): void {
  const expected = surfaceWireKind(kind);
  if (observed === expected) return;
  throw surfaceError(
    'kind-tail-lost',
    `Post ${postId} in ${channelId} should carry kind ${expected} but the ship reports ${
      observed === null ? 'no kind at all' : observed
    }. The record will not be recognised as a surface record.`,
    { channel: channelId, post: postId, expected, observed }
  );
}

export interface RetractSurfacePostInput {
  channelId: string;
  postId: string;
  kind: SurfaceRecordKind;
  fallback: string;
  budget?: ObservationBudget;
}

/**
 * Retracts a surface record by editing it.
 *
 * The reducer skips any surface post marked edited (§6), so an edit is the
 * retraction mechanism. The kind tail is passed back explicitly because the
 * server's `%edit` arm replaces the essay wholesale WITHOUT re-checking
 * kind: an edit that omits it silently rewrites a surface post's kind to
 * `/chat`, which is not a retraction but a quiet mutation of the record's
 * identity. The read-back below confirms both halves.
 */
export async function retractSurfacePost(
  deps: SurfaceDeps,
  input: RetractSurfacePostInput
): Promise<WrittenSurfacePost> {
  const existing = await findPostById(deps, input.channelId, input.postId);
  if (!existing) {
    throw surfaceError(
      'post-not-found',
      `No post ${input.postId} was found in ${input.channelId}.`,
      { channel: input.channelId, post: input.postId }
    );
  }

  await deps.editSurfacePost({
    channelId: input.channelId,
    postId: input.postId,
    kindTail: SURFACE_KIND_TAILS[input.kind],
    fallback: input.fallback,
    sentAt: existing.sentAt,
  });

  const budget = input.budget ?? deps.observationBudget;
  const observation = await observeUntil(deps, budget, async () => {
    const post = await findPostById(deps, input.channelId, input.postId);
    if (post?.isEdited) {
      return { done: true, value: post };
    }
    return {
      done: false,
      detail: post
        ? `post ${input.postId} is not marked edited yet`
        : `post ${input.postId} is no longer visible in ${input.channelId}`,
    };
  });

  if (!observation.ok) {
    throw surfaceError(
      'post-unconfirmed',
      `The retraction of ${input.postId} was poked but never observed: ${observation.detail}.`,
      {
        channel: input.channelId,
        post: input.postId,
        observed: observation.detail,
        attempts: observation.attempts,
      }
    );
  }

  const kind = await deps.readPostKind(input.channelId, input.postId);
  assertKindTail(deps, input.channelId, input.postId, input.kind, kind);

  return {
    postId: input.postId,
    sequenceNum: observation.value.sequenceNum ?? null,
    kind,
    attempts: observation.attempts,
  };
}

async function findPostById(
  deps: SurfaceDeps,
  channelId: string,
  postId: string
): Promise<SurfacePostRecord | null> {
  const hydrated = await hydratePosts(deps, channelId);
  return hydrated.posts.find((post) => post.id === postId) ?? null;
}
