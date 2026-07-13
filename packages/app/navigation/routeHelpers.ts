import {
  isDmChannelId,
  isGroupDmChannelId,
  parseNotesChannelId,
} from '@tloncorp/api/client';

// Pure, side-effect-light navigation route helpers.
//
// These live apart from `utils.ts` so they can be unit-tested under Vitest:
// `utils.ts` pulls in `@tloncorp/ui` and store hooks at module load, which the
// test transform can't process, but these helpers only depend on the api client
// and plain navigation-state shapes.

export function screenNameFromChannelId(channelId: string) {
  return isDmChannelId(channelId)
    ? 'DM'
    : isGroupDmChannelId(channelId)
      ? 'GroupDM'
      : 'Channel';
}

// The real desktop top-level drawer route names (see
// `navigation/desktop/TopLevelDrawer.tsx`). Shared with `getTab` in `utils.ts`
// so the two top-level-drawer detectors can't drift. Note the correct name is
// `Contacts`, not `Profile` (which `getTab` previously hard-coded by mistake).
export const TOP_LEVEL_DRAWER_ROUTES = [
  'Home',
  'Messages',
  'Activity',
  'Contacts',
  'Settings',
] as const;

// Minimal navigation surface this helper relies on, so tests can feed plain
// state objects and a `getParent()` chain instead of a live navigation object.
type NavigationStateLike = {
  type?: string;
  index?: number;
  routes: { name: string }[];
};

export type NavigationChainNode = {
  getState: () => NavigationStateLike | undefined;
  getParent: () => NavigationChainNode | undefined;
};

/**
 * Walk the parent navigator chain and return the name of the active route in
 * the OUTERMOST top-level drawer (one of `TOP_LEVEL_DRAWER_ROUTES`).
 *
 * Returning the outermost (rather than the first drawer encountered) matters:
 * from inside the desktop Activity drawer the inner drawer's active route is one
 * of `ActivityEmpty`/`GroupSettings`/`UserProfile`/`EditProfile`, not
 * `Activity`. Stopping at the first drawer would miss the top-level `Activity`
 * route. Likewise an in-channel caller sits under a `Channel`/`DM` inner drawer
 * whose top-level parent is `Home`/`Messages`; we must report the top-level
 * name so Activity detection stays false for those callers.
 */
export function getActiveTopLevelDrawerRouteName(
  navigation: NavigationChainNode
): string | undefined {
  let outermostTopLevel: string | undefined;
  let current: NavigationChainNode | undefined = navigation;

  while (current) {
    const state = current.getState();
    if (state?.type === 'drawer' && state.index != null) {
      const activeRouteName = state.routes[state.index]?.name;
      if (
        activeRouteName &&
        (TOP_LEVEL_DRAWER_ROUTES as readonly string[]).includes(activeRouteName)
      ) {
        // Keep walking; a higher (outer) drawer overrides, so we finish with
        // the outermost top-level drawer route.
        outermostTopLevel = activeRouteName;
      }
    }
    current = current.getParent();
  }

  return outermostTopLevel;
}

/**
 * Build a desktop nested route that opens a post's parent thread under the
 * Home/Messages channel stack. Mirrors `getDesktopChannelRoute`: the wrapper
 * route carries `channelId`/`groupId`/`selectedPostId` (read by
 * `HomeNavigator`/`ChannelStack` for sidebar focus and stack remount keys) in
 * addition to the nested `Post` params. The wrapper screen is derived from the
 * channel id so DM/group-DM threads route to `DM`/`GroupDM`, not `Channel`.
 */
export function getDesktopPostRoute(
  tab: 'Home' | 'Messages',
  postParams: {
    postId: string;
    authorId: string;
    channelId: string;
    groupId?: string;
    selectedPostId?: string | null;
  }
) {
  const screen = screenNameFromChannelId(postParams.channelId);
  // Notes channels always open under Home, where the notebook sidebar and
  // channel takeover providers are mounted.
  const resolvedTab = parseNotesChannelId(postParams.channelId) ? 'Home' : tab;
  return {
    name: resolvedTab,
    params: {
      screen,
      pop: true,
      params: {
        channelId: postParams.channelId,
        ...(postParams.groupId ? { groupId: postParams.groupId } : {}),
        // Preserve null/undefined rather than coercing; mirrors
        // getDesktopChannelRoute so ChannelStack.navKey() reads the same value
        // from the wrapper params as the nested Post params.
        selectedPostId: postParams.selectedPostId,
        screen: 'Post',
        pop: true,
        params: postParams,
      },
    },
  } as const;
}
