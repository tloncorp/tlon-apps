import { useEffect, useState } from 'react';

/**
 * Fewer posts than this may not fill the screen, so more are requested before
 * a conversation is considered loaded.
 */
export const ENOUGH_POSTS_TO_FILL_SCREEN = 20;

/**
 * A conversation opened on a particular post shows it mid-screen, so it needs
 * about this many older posts to fill the screen above it. With fewer, the
 * oldest loaded post is in view, and the page that then arrives above it is
 * seen landing.
 */
export const ENOUGH_POSTS_BEFORE_ANCHOR = 12;

// How long to hold a conversation back waiting for its first screenful. Past
// this, what is there is shown: an older page that never arrives (offline, a
// failing host) must not leave the conversation blank.
const INITIAL_FILL_TIMEOUT_MS = 3000;

/**
 * How many loaded posts are older than the one a conversation opens on, or
 * null when it opens at the newest post or that post is not loaded. `posts`
 * are newest first.
 */
export function countPostsBeforeAnchor(
  posts: { id: string }[] | null | undefined,
  anchorPostId: string | null | undefined
) {
  if (!posts || !anchorPostId) {
    return null;
  }
  const index = posts.findIndex((post) => post.id === anchorPostId);
  return index === -1 ? null : posts.length - 1 - index;
}

/** Whether the loaded posts are too few to open on, with more to load. */
export function needsOlderPostsToFill({
  postCount,
  postsBeforeAnchor = null,
}: {
  postCount: number;
  postsBeforeAnchor?: number | null;
}) {
  // Opened on a particular post, what matters is the screen above it: the
  // posts after it may be few (a single unread at the end is the usual case)
  // without leaving anything unfilled.
  return postsBeforeAnchor === null
    ? postCount < ENOUGH_POSTS_TO_FILL_SCREEN
    : postsBeforeAnchor < ENOUGH_POSTS_BEFORE_ANCHOR;
}

export function isInitialFillComplete({
  postCount,
  postsBeforeAnchor = null,
  hasOlderPosts,
  hasError,
}: {
  postCount: number | null;
  postsBeforeAnchor?: number | null;
  hasOlderPosts: boolean;
  hasError: boolean;
}) {
  if (hasError) {
    return true;
  }
  return (
    postCount !== null &&
    (!hasOlderPosts || !needsOlderPostsToFill({ postCount, postsBeforeAnchor }))
  );
}

/**
 * Whether a conversation's posts should be held back because its first
 * screenful is still arriving.
 *
 * The first read of a conversation is often a single message: only the
 * unbroken run of newest posts is read locally, and the newest usually arrived
 * by itself. The screen then tops that up a page at a time. Handing each step
 * to the list as it lands means the list is positioning itself on data that
 * keeps changing, which is where it jumped, landed in the wrong place, or
 * went blank. So the conversation waits for the top-up and mounts once.
 *
 * `postCount` is null until the first read returns, which is held too: a list
 * mounted empty and then handed its first rows is the same problem.
 *
 * `postsBeforeAnchor` extends that to a conversation opened on a particular
 * post: a local page with only a few posts older than it is topped up too.
 *
 * `scopeKey` identifies the query (channel and cursor); the hold applies once
 * per scope, and later pages reach the list as they arrive.
 */
export function useInitialPostFill({
  scopeKey,
  postCount,
  postsBeforeAnchor,
  hasOlderPosts,
  hasError,
}: {
  scopeKey: string;
  postCount: number | null;
  postsBeforeAnchor?: number | null;
  hasOlderPosts: boolean;
  hasError: boolean;
}) {
  const [filledScopeKey, setFilledScopeKey] = useState<string | null>(null);
  const isComplete = isInitialFillComplete({
    postCount,
    postsBeforeAnchor,
    hasOlderPosts,
    hasError,
  });
  if (isComplete && filledScopeKey !== scopeKey) {
    setFilledScopeKey(scopeKey);
  }
  const isPending = !isComplete && filledScopeKey !== scopeKey;

  // The wait starts over when the first read returns. A slow first read used
  // to use the whole allowance up, so the top-up it led to was never waited
  // for and landed above a conversation that was already showing.
  const isAwaitingFirstRead = postCount === null;
  useEffect(() => {
    if (!isPending) {
      return;
    }
    const timeout = setTimeout(
      () => setFilledScopeKey(scopeKey),
      INITIAL_FILL_TIMEOUT_MS
    );
    return () => clearTimeout(timeout);
  }, [isAwaitingFirstRead, isPending, scopeKey]);

  return isPending;
}
