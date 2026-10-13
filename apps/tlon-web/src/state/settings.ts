import { base } from '@tloncorp/api/client/requests';
import { DisplayMode, SortMode } from '@tloncorp/api/urbit/channel';
import { Value } from '@urbit/api';
import _ from 'lodash';
import { useMemo } from 'react';

import {
  ALPHABETICAL_SORT,
  DEFAULT_SORT,
  RECENT_SORT,
  SortMode as SidebarSortMode,
  lsDesk,
} from '@/constants';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';

interface ChannelSetting {
  flag: string;
}

interface HeapSetting extends ChannelSetting {
  sortMode: SortMode;
  displayMode: DisplayMode;
}

interface DiarySetting extends ChannelSetting {
  sortMode: 'arranged' | 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc';
  commentSortMode: 'asc' | 'dsc';
  displayMode: DisplayMode;
}

interface GroupSideBarSort {
  [flag: string]:
    | typeof ALPHABETICAL_SORT
    | typeof RECENT_SORT
    | typeof DEFAULT_SORT;
}

type SidebarFilter =
  | 'Direct Messages'
  | 'All Messages'
  | 'Group Channels'
  | 'Broadcasts';

type Theme = 'light' | 'dark' | 'auto';

interface SettingsState {
  display: {
    theme: Theme;
  };
  calmEngine: {
    disableAppTileUnreads: boolean;
    disableAvatars: boolean;
    disableRemoteContent: boolean;
    disableSpellcheck: boolean;
    disableNicknames: boolean;
    showUnreadCounts: boolean;
  };
  tiles: {
    order: string[];
  };
  heaps: {
    heapSettings: Stringified<HeapSetting[]>;
  };
  diary: {
    settings: Stringified<DiarySetting[]>;
    markdown: boolean;
  };
  talk: {
    messagesFilter: SidebarFilter;
    showVitaMessage: boolean;
    seenSunsetMessage: boolean;
  };
  groups: {
    orderedGroupPins: string[];
    sideBarSort: SidebarSortMode;
    groupSideBarSort: Stringified<GroupSideBarSort>;
    hasBeenUsed: boolean;
    showActivityMessage?: boolean;
    logActivity?: boolean;
    analyticsId?: string;
    seenWelcomeCard?: boolean;
    newGroupFlags: string[];
    groupsNavState?: string;
    messagesNavState?: string;
  };
  loaded: boolean;
  putEntry: (bucket: string, key: string, value: Value) => Promise<void>;
  fetchAll: () => Promise<void>;
  [ref: string]: unknown;
}

const useLandscapeSettings = () => {
  const { data, isLoading } = useReactQuerySubscription({
    scry: base.settingsDesk,
    scryParams: { desk: lsDesk },
    watch: base.settingsDeskUpdates,
    watchParams: { desk: lsDesk },
    queryKey: ['settings', lsDesk],
  });

  return useMemo(() => {
    if (!data) {
      return { data: {} as SettingsState, isLoading };
    }

    const { desk } = data as { desk: SettingsState };

    return { data: desk, isLoading };
  }, [isLoading, data]);
};

const useSettings = () => {
  const { data, isLoading } = useReactQuerySubscription({
    scry: base.settingsDesk,
    scryParams: { desk: window.desk },
    watch: base.settingsDeskUpdates,
    watchParams: { desk: window.desk },
    queryKey: ['settings', window.desk],
  });

  return useMemo(() => {
    if (!data) {
      return { data: {} as SettingsState, isLoading };
    }

    const { desk } = data as { desk: SettingsState };

    return { data: desk, isLoading };
  }, [isLoading, data]);
};

const useMergedSettings = () => {
  const { data: settings, isLoading: isSettingsLoading } = useSettings();
  const { data: lsSettings, isLoading: isLandscapeSettingsLoading } =
    useLandscapeSettings();

  return useMemo(() => {
    if (isSettingsLoading || isLandscapeSettingsLoading) {
      return { data: {} as SettingsState, isLoading: true };
    }

    return {
      data: {
        ..._.mergeWith(
          lsSettings as Record<string, unknown>,
          settings as Record<string, unknown>,
          (obj, src) => (_.isArray(src) ? src : undefined)
        ),
      } as SettingsState,
      isLoading: isSettingsLoading || isLandscapeSettingsLoading,
    };
  }, [isSettingsLoading, isLandscapeSettingsLoading, settings, lsSettings]);
};

export function useTheme() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.display === undefined) {
      return 'auto';
    }

    const { display } = data;

    return display.theme || 'auto';
  }, [isLoading, data]);
}
