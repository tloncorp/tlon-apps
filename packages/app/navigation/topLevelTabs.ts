import { CommonActions } from '@react-navigation/routers';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import type { IconType } from '@tloncorp/ui';

import type { RootStackParamList, TopLevelTabParamList } from './types';

export type TopLevelTabName = keyof TopLevelTabParamList;

// `MainTabs` and this param list keep the names they were given: both are
// written into saved navigation state and into deep links, so every route name
// spoken here still says "tab" even though a drawer now lists the sections.
export const TOP_LEVEL_TABS = {
  BotChat: {
    title: 'Bot',
    analyticsLabel: 'Bot Chat',
    icon: 'SmushStar',
  },
  ChatList: {
    title: 'Workspaces',
    analyticsLabel: 'Workspaces',
    icon: 'Channel',
  },
  Activity: {
    title: 'Activity',
    analyticsLabel: 'Activity',
    icon: 'Notifications',
  },
  Settings: {
    title: 'Settings',
    analyticsLabel: 'Settings',
    icon: 'Settings',
  },
} as const satisfies Record<
  TopLevelTabName,
  { title: string; analyticsLabel: string; icon: IconType }
>;

export function trackTopLevelTabSelection(tab: TopLevelTabName) {
  trackEvent(AnalyticsEvent.NavigationTabSelected, {
    tab: TOP_LEVEL_TABS[tab].analyticsLabel,
  });
}

export type RouteSnapshot = {
  name: string;
  key?: string;
  params?: object;
  state?: {
    index?: number;
    routes?: ReadonlyArray<RouteSnapshot>;
    history?: ReadonlyArray<unknown>;
  };
};
type NavigationSnapshot =
  | { index: number; routes: ReadonlyArray<RouteSnapshot> }
  | undefined;

function hasDestinationParams(params: object | undefined) {
  return Object.values(params ?? {}).some((value) => value !== undefined);
}

/**
 * Whether the app is still where a cold start left it: MainTabs, on the
 * initial Workspaces tab, with nothing asked of it. A group-invite deep link
 * or a notification resets to MainTabs/ChatList *with* destination params,
 * and an explicit `screen` on MainTabs names a tab on purpose — neither is the
 * default position, so the bot tab must not be claimed over them.
 */
export function isAtColdStartPosition(state: NavigationSnapshot): boolean {
  const rootRoute = state?.routes[state.index];
  if (rootRoute?.name !== 'MainTabs') return false;
  if ((rootRoute.params as { screen?: string } | undefined)?.screen) {
    return false;
  }
  const tabs = rootRoute.state;
  const focusedTab = tabs?.routes?.[tabs.index ?? 0];
  if (!focusedTab) return true;
  return (
    focusedTab.name === 'ChatList' && !hasDestinationParams(focusedTab.params)
  );
}

/**
 * Whether a restored position that named the bot tab is still waiting for it.
 * The tab is absent from the navigator while the hosted-bot flag loads, and
 * rehydration drops a route whose screen is not registered — so a restore that
 * asked for `BotChat` lands on `ChatList` instead. Selecting it once the tab
 * exists completes that restore. Only while `MainTabs` is still the focused
 * root route: anything pushed above it is somewhere the user has moved since.
 */
export function isAwaitingRestoredBotTab(state: NavigationSnapshot): boolean {
  const rootRoute = state?.routes[state.index];
  if (rootRoute?.name !== 'MainTabs') return false;
  // A deep link or notification that arrived after the restore names its own
  // tab and carries what it wants shown there. That intent is newer than the
  // saved position, so the restore has been overtaken — only the untouched
  // fallback is still waiting for the tab. A restored position that reached
  // the bot tab through the claim carries `screen: 'BotChat'` itself, which is
  // the position, not a newer instruction.
  const screen = (rootRoute.params as { screen?: string } | undefined)?.screen;
  if (screen != null && screen !== 'BotChat') return false;
  const tabs = rootRoute.state;
  const focusedTab = tabs?.routes?.[tabs.index ?? 0];
  if (!focusedTab) return true;
  if (focusedTab.name === 'BotChat') return false;
  return (
    focusedTab.name === 'ChatList' && !hasDestinationParams(focusedTab.params)
  );
}

/**
 * While first-run onboarding holds its navigation lock, the conversation is
 * the Bot tab itself; the other tabs would carry the user away from the
 * pickers, as a back gesture would, so their presses are refused.
 */
export function isTabPressBlockedByOnboardingLock(
  locked: boolean,
  tab: TopLevelTabName
) {
  return locked && tab !== 'BotChat';
}

export function getTopLevelTabRoute<Tab extends TopLevelTabName>(
  screen: Tab,
  params?: TopLevelTabParamList[Tab]
): {
  name: 'MainTabs';
  params: NonNullable<RootStackParamList['MainTabs']>;
} {
  return {
    name: 'MainTabs',
    params: {
      screen,
      ...(params === undefined ? {} : { params }),
    } as NonNullable<RootStackParamList['MainTabs']>,
  };
}

/**
 * The action that takes the app to a section, for the drawer to dispatch at
 * the stack that owns `MainTabs`.
 *
 * `pop` is what makes that stack reuse the `MainTabs` it already has. A
 * NAVIGATE without it only reuses the *focused* route, so choosing a section
 * from anywhere deeper — a channel, a settings sub-screen — would append a
 * second `MainTabs`, and with it a second copy of every section screen, rather
 * than returning to the one already there.
 */
export function getTopLevelTabNavigateAction<Tab extends TopLevelTabName>(
  section: Tab,
  params?: TopLevelTabParamList[Tab]
) {
  const route = getTopLevelTabRoute(section, params);
  return CommonActions.navigate(route.name, route.params, { pop: true });
}

/**
 * The section the navigator starts on: the bot's own conversation when the
 * account has one, the workspace list otherwise.
 */
export function getInitialTopLevelTab(botEnabled: boolean): TopLevelTabName {
  return botEnabled ? 'BotChat' : 'ChatList';
}

/**
 * Where the app goes once a chat the user was in is gone — left, or deleted:
 * the bot's own conversation when the account has one, Activity otherwise.
 * Leaving the bot's conversation itself goes to Activity too, since its
 * section would open on the conversation just left.
 */
export function getLeftChatTopLevelTab(
  botChannelId: string | null,
  leftChannelId?: string
): TopLevelTabName {
  return botChannelId && botChannelId !== leftChannelId
    ? 'BotChat'
    : 'Activity';
}

/**
 * The section a position in the root stack is inside, or null when the stack
 * has not built `MainTabs` yet. Whatever is pushed above MainTabs does not
 * change the answer: a channel opened from Workspaces is still a position
 * within Workspaces, and the drawer marks that section.
 *
 * Distinct from the mobile persistence module's `getFocusedTopLevelTab`, which
 * asks the narrower question of whether a saved position *is* a section — and
 * answers null for anything deeper, since there is no section to re-select.
 */
export function getActiveTopLevelTab(
  state: RouteSnapshot['state']
): TopLevelTabName | null {
  const mainTabs = state?.routes?.find((route) => route.name === 'MainTabs');
  const sections = mainTabs?.state;
  const focused = sections?.routes?.[sections.index ?? 0]?.name;
  return focused != null && focused in TOP_LEVEL_TABS
    ? (focused as TopLevelTabName)
    : null;
}

/**
 * The `MainTabs` route exactly as it stands, sections untouched.
 *
 * For opening a chat over wherever the user already is. The sibling below
 * brings a named section to the front first; a chat picked out of the drawer
 * wants neither. It is not a position inside any section — the panel marks the
 * chat's own row, not a section's — so naming one underneath it only claims
 * the user is somewhere they never went, and the claim is visible: the stack
 * animates the outgoing screen away before the incoming one arrives, so a
 * section switched to in the same dispatch gets a moment on screen, still
 * half-drawn, between the chat being left and the chat being opened.
 *
 * Falls back to a fresh route naming `fallbackSection` only when the stack has
 * no `MainTabs` yet, which is a cold position with nothing to preserve.
 */
export function getStandingTopLevelTabRoute(
  stackState: RouteSnapshot['state'],
  fallbackSection: TopLevelTabName
): {
  name: 'MainTabs';
  key?: string;
  params?: NonNullable<RootStackParamList['MainTabs']>;
  state?: {
    index?: number;
    routes?: ReadonlyArray<RouteSnapshot>;
    history?: ReadonlyArray<unknown>;
  };
} {
  const mainTabs = stackState?.routes?.find(
    (route) => route.name === 'MainTabs'
  );
  if (!mainTabs?.state) {
    return getTopLevelTabRoute(fallbackSection);
  }
  return mainTabs as typeof mainTabs & {
    name: 'MainTabs';
    key?: string;
    params?: NonNullable<RootStackParamList['MainTabs']>;
  };
}
