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
