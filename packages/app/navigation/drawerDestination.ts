import { screenNameFromChannelId } from './routeHelpers';

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

/**
 * The route the drawer opens a channel through.
 *
 * Built here beside `isDrawerDestinationRoute`, which is the thing it has to
 * satisfy: a conversation picked out of the panel stands on its own, with the
 * section it was chosen from behind it and nothing else, so its header carries
 * the drawer button rather than a caret. A `DM` or `GroupDM` says that by its
 * route name; a channel of a group has to say it in a param.
 */
export function buildDrawerChannelRoute(channel: {
  id: string;
  groupId?: string | null;
}): {
  name: 'DM' | 'GroupDM' | 'Channel';
  params: {
    channelId: string;
    groupId?: string;
    isDrawerDestination: true;
  };
} {
  return {
    name: screenNameFromChannelId(channel.id) as 'DM' | 'GroupDM' | 'Channel',
    params: {
      channelId: channel.id,
      ...(channel.groupId ? { groupId: channel.groupId } : {}),
      isDrawerDestination: true,
    },
  };
}

type ChatLike =
  | { type: 'channel'; channel: { id: string } }
  | {
      type: 'group';
      group: { id: string; channels?: { id: string }[] | null };
    };

/**
 * Whether `route` is the screen this chat opens.
 *
 * For marking the row the drawer is currently standing in. A group answers for
 * whichever of the two screens it is entered through — its channel list, or
 * its only channel — because those are the two routes `getMainGroupRoute`
 * builds. Ids alone will not do it: a group and a channel pinned out of that
 * group carry the same `groupId`, so each would answer for the other.
 */
export function routeShowsChat(
  chat: ChatLike,
  route: RouteLike | undefined
): boolean {
  const params = route?.params as
    | { channelId?: string; groupId?: string }
    | undefined;
  if (chat.type === 'channel') {
    return params?.channelId === chat.channel.id;
  }
  if (route?.name === 'GroupChannels') {
    return params?.groupId === chat.group.id;
  }
  const only =
    chat.group.channels?.length === 1 ? chat.group.channels[0].id : null;
  return only != null && params?.channelId === only;
}

type StackSnapshot =
  | {
      index?: number;
      routes?: ReadonlyArray<RouteLike & { key?: string }>;
    }
  | undefined;

/**
 * Whether the drawer owns the left edge on a route, rather than the stack's
 * own back gesture.
 *
 * Being a drawer destination is not enough on its own. These same screens are
 * reached by being opened from somewhere — a participant's DM from a channel,
 * a group from a link in a message or in the bot's own conversation — and
 * there the screen behind is one the user was on a moment ago and expects to
 * get back to. Taking the edge there would leave no way back at all, since the
 * header on these screens shows the drawer button in place of a caret.
 *
 * So the edge is the drawer's only where the route sits directly on the
 * sections: there is nothing behind it but the section it was chosen from, and
 * reaching that section is what the panel is for.
 *
 * This deliberately does not ask *how* the conversation was reached. One at
 * this depth opened from a link inside a tab — a group linked in the bot's own
 * conversation, a DM opened from Activity — also gives up its back gesture,
 * and that is the intended behaviour rather than an oversight: the panel
 * carries a row for every section, so the tab is one tap away, and the
 * alternative reinstates the thing this branch exists to fix. Pinning it to
 * provenance instead, a conversation opened from the workspace list swipes
 * back to the workspace list, which is the report that started this.
 *
 * Pass `routeKey` to ask about a particular route; omit it to ask about
 * whichever route the stack has focused.
 */
export function drawerOwnsEdge(
  stackState: StackSnapshot,
  routeKey?: string
): boolean {
  const routes = stackState?.routes;
  if (!routes?.length) {
    return false;
  }
  const index =
    routeKey == null
      ? (stackState?.index ?? 0)
      : routes.findIndex((route) => route.key === routeKey);
  // Index 0 is `MainTabs` itself, and a route we cannot find is not one whose
  // gesture we should be claiming.
  if (index < 1) {
    return false;
  }
  if (routes[index - 1]?.name !== 'MainTabs') {
    return false;
  }
  return isDrawerDestinationRoute(routes[index]);
}

/**
 * The params that say what a conversation route *is*, lifted off a route so
 * they can be put back on one.
 *
 * `popTo` overwrites the params of the route it lands on, so returning from a
 * post would otherwise strip these and change the screen underneath the user:
 * without `isDrawerDestination` its header turns back into a caret. Gathered
 * here so that the next marker added to a conversation route is added in one
 * place rather than two, the second of which is easy to miss — a second marker
 * was added and missed here exactly once already.
 */
export function carriedConversationParams(params: object | undefined): {
  isDrawerDestination?: true;
} {
  const marks = params as { isDrawerDestination?: boolean } | undefined;
  return {
    ...(marks?.isDrawerDestination ? { isDrawerDestination: true } : {}),
  };
}
