// Pure decision helper for the thread back-stack loop fix (TLON-5872).
//
// Kept dependency-free (no React Navigation, store, UI, or RN imports) so it
// can be unit-tested without pulling in a navigation/render harness.
//
// React Navigation v7's `navigate(name, params, { pop: true })` matches by
// route *name* only when the stack screens declare no `getId` — it pops to the
// nearest same-name route via `findLast`, ignoring `channelId`. So we can only
// safely pop when the route directly beneath the focused `Post` is the exact
// target channel (same screen name AND same channelId). In every other case we
// must replace the `Post` route in place, which preserves everything beneath it
// (notably the originating DM) and never mispops onto a different same-name
// route.

export type ChannelBackTarget = 'pop-to-existing' | 'replace-post';

export function resolveChannelBackTarget(
  previousRoute:
    | { name: string; params?: { channelId?: string } | undefined }
    | undefined,
  focusedRouteName: string | undefined,
  target: { screenName: string; channelId: string }
): ChannelBackTarget {
  // Guard: only the `Post` back path may replace. If the focused route isn't
  // `Post` (helper reused from an unexpected origin), fall back to the existing
  // pop behavior.
  if (focusedRouteName !== 'Post') {
    return 'pop-to-existing';
  }

  if (
    previousRoute?.name === target.screenName &&
    previousRoute?.params?.channelId === target.channelId
  ) {
    return 'pop-to-existing';
  }

  return 'replace-post';
}
