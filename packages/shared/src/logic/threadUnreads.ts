import type { ThreadUnreadState } from '../db/types';

/** Thread unreads for one channel, keyed by the parent post's id. */
export type ThreadUnreadMap = Map<string, ThreadUnreadState>;

/**
 * Decide which thread-unread record drives a post's reply-summary dot.
 *
 * When a channel-scoped map is available it is *authoritative*: a post with no
 * entry has no unread, even if the post object still carries a `threadUnread`
 * relation. That matters because the map comes from a live query that excludes
 * read threads, so falling back to the post's own copy would resurrect a dot
 * for a thread the user has already read.
 *
 * `null` means no map is in scope (surfaces outside a channel, e.g. a
 * forwarded-post preview), in which case the post's own relation is all we
 * have.
 */
export function resolveThreadUnread(
  unreads: ThreadUnreadMap | null,
  post: { id: string; threadUnread?: ThreadUnreadState | null }
): ThreadUnreadState | null {
  if (!unreads) {
    return post.threadUnread ?? null;
  }
  return unreads.get(post.id) ?? null;
}
