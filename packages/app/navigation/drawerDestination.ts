type RouteLike = {
  name?: string;
  params?: { isDrawerDestination?: boolean } | object;
};

/**
 * Whether a route is something the drawer opens in its own right rather than a
 * detail pushed over something else: a direct message, a group DM, a group's
 * channel list, or the single channel a one-channel group is opened through.
 *
 * These screens carry the drawer button where a pushed screen carries its back
 * caret. Nothing sits behind them but the section they were chosen from, so a
 * caret would only ever mean "leave", which is what the drawer is for. It is
 * read off the route rather than off the channel's own record so that every
 * screen involved can answer the same question the same way.
 *
 * `DM` and `GroupDM` are named from the channel id itself, so every way of
 * reaching one lands on a route that says so. A plain channel says so with a
 * param instead, stamped by the two places that open one as a destination:
 * `getMainGroupRoute`, for the single channel a one-channel group is entered
 * through, and the drawer, for a channel pinned out of a group it lists. A
 * route to that same channel built anywhere else keeps its caret.
 */
export function isDrawerDestinationRoute(
  route: RouteLike | undefined
): boolean {
  if (
    route?.name === 'DM' ||
    route?.name === 'GroupDM' ||
    route?.name === 'GroupChannels'
  ) {
    return true;
  }
  return (
    route?.name === 'Channel' &&
    !!(route.params as { isDrawerDestination?: boolean } | undefined)
      ?.isDrawerDestination
  );
}
