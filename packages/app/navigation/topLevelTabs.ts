import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';

import type { RootStackParamList, TopLevelTabParamList } from './types';

export type TopLevelTabName = keyof TopLevelTabParamList;

export const TOP_LEVEL_TABS = {
  ChatList: {
    title: 'Home',
    analyticsLabel: 'Home',
  },
  Activity: {
    title: 'Activity',
    analyticsLabel: 'Activity',
  },
  Contacts: {
    title: 'Contacts',
    analyticsLabel: 'Contacts',
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
