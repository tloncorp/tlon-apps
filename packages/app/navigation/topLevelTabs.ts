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
