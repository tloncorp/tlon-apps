/**
 * Decide which thread-unread record drives a post's reply-summary dot.
 *
 * When a channel-scoped map is available it is *authoritative*: a post with no
 * entry has no unread, even if the post object still carries a `threadUnread`
 * relation. That matters because the map comes from a live query that excludes
 * read threads, so falling back to the post's own copy would resurrect a dot
 * for a thread the user has already read.
 *
 * A `null` map means none is in scope (surfaces outside a channel, e.g. a
 * forwarded-post preview), in which case the post's own relation is all we
 * have.
 *
 * Generic over the unread record so this stays free of db imports; callers
 * supply `db.ThreadUnreadState`.
 */
export function resolveThreadUnread<T>(
  unreads: Map<string, T> | null,
  post: { id: string; threadUnread?: T | null }
): T | null {
  if (!unreads) {
    return post.threadUnread ?? null;
  }
  return unreads.get(post.id) ?? null;
}
