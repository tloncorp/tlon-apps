import { appendContactIdToReplies } from '../logic';
import { getClientIdentity } from './client';
import { afterTransactionCommit, type QueryCtx } from './query';
import type { Post } from './types';

type ReplyMutation = { post: Post; removed: boolean };
export type ReplySnapshot = {
  readonly db: NonNullable<ReturnType<typeof getClientIdentity>>;
  readonly mutations: ReplyMutation[];
  readonly conflicts: Map<string, Post>;
};
const activeSnapshots = new Set<ReplySnapshot>();

export function sameReply(a: Post, b: Post) {
  if (a.channelId !== b.channelId || a.parentId !== b.parentId) return false;
  // Tombstones derive sentAt from their canonical ID, unlike the live essay.
  return a.id === b.id || (a.authorId === b.authorId && a.sentAt === b.sentAt);
}
export function hasReplySnapshots(ctx: QueryCtx) {
  return [...activeSnapshots].some(
    (snapshot) => snapshot.db === getClientIdentity()
  );
}
export function beginReplySnapshot(): ReplySnapshot {
  const db = getClientIdentity();
  if (!db) throw new Error('Database not set for reply snapshot');
  const snapshot: ReplySnapshot = { db, mutations: [], conflicts: new Map() };
  activeSnapshots.add(snapshot);
  return snapshot;
}
export function assertCurrentReplySnapshot(snapshot: ReplySnapshot) {
  if (!activeSnapshots.has(snapshot) || snapshot.db !== getClientIdentity())
    throw new Error('Reply snapshot database owner retired');
}
export function endReplySnapshot(snapshot: ReplySnapshot) {
  activeSnapshots.delete(snapshot);
  snapshot.mutations.length = 0;
  snapshot.conflicts.clear();
}

// Capture before/after membership inside the mutation transaction. Facts publish
// after COMMIT and before its promise resolves; rollback never publishes them.
export function recordReplyTransitions(
  ctx: QueryCtx,
  before: Post[],
  after: Post[]
) {
  if (!hasReplySnapshots(ctx)) return;
  const producingDb = getClientIdentity();
  const oldRows = before
    .filter((post) => post.parentId)
    .map((post) => ({ ...post }));
  const newRows = after
    .filter((post) => post.parentId)
    .map((post) => ({ ...post }));
  afterTransactionCommit(ctx, () => {
    for (const snapshot of activeSnapshots) {
      if (snapshot.db !== producingDb || producingDb !== getClientIdentity())
        continue;
      for (const post of newRows) {
        const prior = oldRows.find((row) => sameReply(row, post));
        const owned = snapshot.mutations.find((mutation) =>
          sameReply(mutation.post, post)
        );
        const transition = !prior || !!prior.isDeleted !== !!post.isDeleted;
        if (transition) {
          const next = { post, removed: !!post.isDeleted };
          if (owned) Object.assign(owned, next);
          else snapshot.mutations.push(next);
        } else if (owned && !owned.removed && !post.isDeleted) {
          // An echo may replace an optimistic ID/status; update that already
          // owned addition without turning unrelated edits into new additions.
          owned.post = post;
        }
      }
      for (const post of oldRows) {
        if (newRows.some((row) => sameReply(row, post))) continue;
        const owned = snapshot.mutations.find((mutation) =>
          sameReply(mutation.post, post)
        );
        if (owned) Object.assign(owned, { post, removed: true });
        else snapshot.mutations.push({ post, removed: true });
      }
    }
  });
}

function uniqueReplies(replies: Post[]) {
  const result: Post[] = [];
  for (const reply of replies) {
    const index = result.findIndex((existing) => sameReply(existing, reply));
    if (index < 0) result.push(reply);
    else result[index] = reply;
  }
  return result;
}
export function completeReplyMembership(parent: Post) {
  return (
    parent.replies != null &&
    uniqueReplies(parent.replies).filter((reply) => !reply.isDeleted).length ===
      parent.replyCount
  );
}

export function reconcileReplySnapshot(
  parent: Post,
  snapshot: ReplySnapshot | undefined,
  unconfirmed: Post[],
  previous?: Post
): Post {
  const mutations =
    snapshot?.mutations.filter(
      (mutation) => mutation.post.parentId === parent.id
    ) ?? [];
  const localPending = unconfirmed.filter(
    (reply) => reply.parentId === parent.id && !reply.isDeleted
  );
  if (!completeReplyMembership(parent)) {
    if (!snapshot || (!mutations.length && !localPending.length)) return parent;
    snapshot.conflicts.set(parent.id, parent);
    // A partial payload cannot identify which mutations it already includes.
    // Defer its summary and nested identities for one complete reread.
    return {
      ...parent,
      replies: null,
      replyCount: previous?.replyCount ?? null,
      replyTime: previous?.replyTime ?? null,
      replyContactIds: previous?.replyContactIds ?? null,
      optimisticReplyBumpCount: previous?.optimisticReplyBumpCount ?? 0,
    };
  }
  const incoming = uniqueReplies(parent.replies!);
  const merged = [...incoming];
  for (const reply of localPending) {
    if (!incoming.some((row) => sameReply(row, reply))) merged.push(reply);
  }
  for (const mutation of mutations) {
    const index = merged.findIndex((reply) => sameReply(reply, mutation.post));
    if (mutation.removed) {
      const tombstone = { ...mutation.post, isDeleted: true };
      if (index < 0) merged.push(tombstone);
      else merged[index] = tombstone;
    } else if (
      !incoming.some(
        (reply) => !reply.isDeleted && sameReply(reply, mutation.post)
      )
    ) {
      if (index < 0) merged.push(mutation.post);
      else merged[index] = mutation.post;
    }
  }
  const live = merged.filter((reply) => !reply.isDeleted);
  const optimisticReplyBumpCount = live.filter(
    (reply) =>
      reply.syncedAt == null && !incoming.some((row) => sameReply(row, reply))
  ).length;
  const unchangedMembership =
    live.length === parent.replyCount &&
    live.every((reply) =>
      incoming.some((row) => !row.isDeleted && sameReply(row, reply))
    );
  if (unchangedMembership)
    return { ...parent, replies: merged, optimisticReplyBumpCount };
  let replyTime: number | null = null;
  let replyContactIds: string[] = [];
  for (const reply of [...live].sort((a, b) => a.sentAt - b.sentAt)) {
    replyTime = Math.max(replyTime ?? 0, reply.sentAt);
    replyContactIds = appendContactIdToReplies(replyContactIds, reply.authorId);
  }
  return {
    ...parent,
    replies: merged,
    replyCount: live.length,
    replyTime,
    replyContactIds,
    optimisticReplyBumpCount,
  };
}
