type RouteLike = {
  name?: string;
  params?: { isOnlyChannel?: boolean } | object;
};

/**
 * Whether a route is a conversation the app enters in its own right rather
 * than a detail pushed over something else: a direct message, a group DM, or
 * the single channel a one-channel group is opened through.
 *
 * These screens carry the drawer button where a pushed screen carries its back
 * caret, and with no caret the edge belongs to the drawer rather than to the
 * back gesture. One answer has to serve all three, so it is read off the route
 * — which the stack's screen options and the drawer's can both see — rather
 * than off the channel's own record, which only the screen has.
 *
 * `DM` and `GroupDM` are named from the channel id itself, so every way of
 * reaching one lands on a route that says so. A one-channel group is stamped
 * by `getMainGroupRoute`, the one place that decides to enter a group through
 * its channel instead of its channel list; a route to that same channel built
 * anywhere else keeps its caret.
 */
export function isConversationRootRoute(route: RouteLike | undefined): boolean {
  if (route?.name === 'DM' || route?.name === 'GroupDM') {
    return true;
  }
  return (
    route?.name === 'Channel' &&
    !!(route.params as { isOnlyChannel?: boolean } | undefined)?.isOnlyChannel
  );
}
