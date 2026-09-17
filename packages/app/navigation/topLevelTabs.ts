import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';

import type { RootStackParamList, TopLevelTabParamList } from './types';

export type TopLevelTabName = keyof TopLevelTabParamList;

export const TOP_LEVEL_TABS = {
  BotChat: {
    title: 'Bot',
    analyticsLabel: 'Bot Chat',
  },
  ChatList: {
    title: 'Workspaces',
    analyticsLabel: 'Workspaces',
  },
  Activity: {
    title: 'Activity',
    analyticsLabel: 'Activity',
  },
  Settings: {
    title: 'Settings',
    analyticsLabel: 'Settings',
  },
} as const satisfies Record<
  TopLevelTabName,
  { title: string; analyticsLabel: string }
>;

export function trackTopLevelTabSelection(tab: TopLevelTabName) {
  trackEvent(AnalyticsEvent.NavigationTabSelected, {
    tab: TOP_LEVEL_TABS[tab].analyticsLabel,
  });
}

type RouteSnapshot = {
  name: string;
  params?: object;
  state?: { index?: number; routes?: ReadonlyArray<RouteSnapshot> };
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
