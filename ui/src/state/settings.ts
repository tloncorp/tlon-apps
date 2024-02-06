import { useMemo } from 'react';
import cookies from 'browser-cookies';
import { v4 as uuidv4 } from 'uuid';
import { Value, PutBucket, DelEntry, DelBucket } from '@urbit/api';
import _ from 'lodash';
import produce from 'immer';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ALPHABETICAL_SORT,
  DEFAULT_SORT,
  lsDesk,
  RECENT_SORT,
  SortMode as SidebarSortMode,
} from '@/constants';
import { DisplayMode, SortMode } from '@/types/channel';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { isHosted, isTalk } from '@/logic/utils';
import { isNativeApp } from '@/logic/native';
import api from '@/api';

interface ChannelSetting {
  flag: string;
}

export interface HeapSetting extends ChannelSetting {
  sortMode: SortMode;
  displayMode: DisplayMode;
}

export interface DiarySetting extends ChannelSetting {
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

interface PutEntry {
  // this is defined here because the PutEntry type in @urbit/api is missing the desk field
  'put-entry': {
    'bucket-key': string;
    'entry-key': string;
    value: Value;
    desk: string;
  };
}

interface SettingsEvent {
  'settings-event': PutEntry | PutBucket | DelEntry | DelBucket;
}

export type SidebarFilter =
  | 'Direct Messages'
  | 'All Messages'
  | 'Group Channels';

export const filters: Record<string, SidebarFilter> = {
  dms: 'Direct Messages',
  all: 'All Messages',
  groups: 'Group Channels',
};

export type Theme = 'light' | 'dark' | 'auto';

export interface SettingsState {
  display: {
    theme: Theme;
  };
  calmEngine: {
    disableAppTileUnreads: boolean;
    disableAvatars: boolean;
    disableRemoteContent: boolean;
    disableSpellcheck: boolean;
    disableNicknames: boolean;
    disableWayfinding: boolean;
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
  };
  loaded: boolean;
  putEntry: (bucket: string, key: string, value: Value) => Promise<void>;
  fetchAll: () => Promise<void>;
  [ref: string]: unknown;
}

export const useLandscapeSettings = () => {
  const { data, isLoading } = useReactQuerySubscription({
    scry: `/desk/${lsDesk}`,
    scryApp: 'settings',
    app: 'settings',
    path: `/desk/${lsDesk}`,
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

export const useSettings = () => {
  const { data, isLoading } = useReactQuerySubscription({
    scry: `/desk/${window.desk}`,
    scryApp: 'settings',
    app: 'settings',
    path: `/desk/${window.desk}`,
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

export const useMergedSettings = () => {
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

export const useSettingsLoaded = () => {
  const { isLoading } = useMergedSettings();

  return !isLoading;
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

const emptyCalm: SettingsState['calmEngine'] = {
  disableAppTileUnreads: false,
  disableAvatars: false,
  disableRemoteContent: false,
  disableSpellcheck: false,
  disableNicknames: false,
  disableWayfinding: false,
};

const loadingCalm: SettingsState['calmEngine'] = {
  disableAppTileUnreads: true,
  disableAvatars: true,
  disableRemoteContent: true,
  disableSpellcheck: true,
  disableNicknames: true,
  disableWayfinding: true,
};

export function useCalm() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading) {
      return loadingCalm;
    }

    if (!data || !data.calmEngine) {
      return emptyCalm;
    }

    const { calmEngine } = data;

    return calmEngine as SettingsState['calmEngine'];
  }, [isLoading, data]);
}

export function useCalmSetting(key: keyof SettingsState['calmEngine']) {
  const data = useCalm();

  return data[key];
}

export function usePutEntryMutation({
  bucket,
  key,
}: {
  bucket: string;
  key: string;
}) {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { val: Value }) => {
    const { val } = variables;
    await api.trackedPoke<PutEntry, SettingsEvent>(
      {
        app: 'settings',
        mark: 'settings-event',
        json: {
          'put-entry': {
            desk: window.desk,
            'bucket-key': bucket,
            'entry-key': key,
            value: val,
          },
        },
      },
      {
        app: 'settings',
        path: `/desk/${window.desk}`,
      },
      (event) => {
        // default validator was not working
        const { 'settings-event': data } = event;

        if (data && 'put-entry' in data) {
          const { 'put-entry': entry } = data;
          if (entry) {
            const { 'bucket-key': bk, 'entry-key': ek, value: v } = entry;

            if (bk === bucket && ek === key) {
              return v === val;
            }

            return false;
          }
          return false;
        }
        return false;
      }
    );
  };

  return useMutation(['put-entry', bucket, key], mutationFn, {
    onMutate: ({ val }) => {
      const previousSettings = queryClient.getQueryData<{
        desk: SettingsState;
      }>(['settings', window.desk]);
      queryClient.setQueryData<{ desk: SettingsState }>(
        ['settings', window.desk],
        // eslint-disable-next-line consistent-return
        produce((draft) => {
          if (!draft) {
            return { desk: { [bucket]: { [key]: val } } };
          }

          if (!(draft.desk as any)[bucket]) {
            (draft.desk as any)[bucket] = { [key]: val };
          } else {
            (draft.desk as any)[bucket][key] = val;
          }
        })
      );

      return { previousSettings };
    },
    onError: (err, variables, rollback) => {
      queryClient.setQueryData<{ desk: SettingsState }>(
        ['settings', window.desk],
        rollback?.previousSettings
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(['settings', window.desk]);
    },
  });
}

export function useCalmSettingMutation(key: keyof SettingsState['calmEngine']) {
  const { mutate, status } = usePutEntryMutation({
    bucket: 'calmEngine',
    key,
  });

  return {
    mutate: (val: boolean) => mutate({ val }),
    status,
  };
}

export function useMarkdownInDiaries() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.diary === undefined) {
      return false;
    }

    const { diary } = data;

    return diary.markdown || false;
  }, [isLoading, data]);
}

export function useLogActivity() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    // Do not capture any analytics events for Talk
    if (isTalk || isNativeApp()) {
      return false;
    }

    if (isLoading || data === undefined || data.groups === undefined) {
      return isHosted;
    }

    return data.groups?.logActivity ?? isHosted;
  }, [isLoading, data]);
}

export function useLogActivityMutation() {
  const { mutate, status } = usePutEntryMutation({
    bucket: 'groups',
    key: 'logActivity',
  });

  // also wrap vita toggling
  return {
    mutate: (val: boolean) => {
      api.poke({
        app: 'groups-ui',
        mark: 'ui-vita-toggle',
        json: val,
      });
      return mutate({ val });
    },
    status,
  };
}

export function parseSettings<T>(settings: Stringified<T[]>): T[] {
  return settings !== '' ? JSON.parse(settings) : [];
}

export function getChannelSetting<T extends ChannelSetting>(
  settings: T[],
  flag: string
): T | undefined {
  return settings.find((el) => el.flag === flag);
}

export function setChannelSetting<T extends ChannelSetting>(
  settings: T[],
  newSetting: Partial<T>,
  flag: string
): T[] {
  const oldSettings = settings.slice(0);
  const oldSettingIndex = oldSettings.findIndex((s) => s.flag === flag);
  const setting = {
    ...oldSettings[oldSettingIndex],
    flag,
    ...newSetting,
  };

  if (oldSettingIndex >= 0) {
    oldSettings.splice(oldSettingIndex, 1);
  }

  return [...oldSettings, setting];
}

export function useHeapSettings(): HeapSetting[] {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.heaps === undefined) {
      return [];
    }

    const { heaps } = data;

    return parseSettings(heaps.heapSettings) as HeapSetting[];
  }, [isLoading, data]);
}

export function useHeapSortMode(flag: string): SortMode {
  const settings = useHeapSettings();
  const heapSetting = getChannelSetting(settings, flag);
  return heapSetting?.sortMode ?? 'time';
}

export function useHeapDisplayMode(flag: string): DisplayMode {
  const settings = useHeapSettings();
  const heapSetting = getChannelSetting(settings, flag);
  return heapSetting?.displayMode ?? 'grid';
}

export function useDiarySettings(): DiarySetting[] {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (
      isLoading ||
      data === undefined ||
      data.diary === undefined ||
      data.diary.settings === undefined
    ) {
      return [];
    }

    const { diary } = data;

    return parseSettings(diary.settings) as DiarySetting[];
  }, [isLoading, data]);
}

export function useUserDiarySortMode(
  flag: string
): 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc' | 'arranged' | undefined {
  const settings = useDiarySettings();
  const diarySetting = getChannelSetting(settings, flag);
  return diarySetting?.sortMode;
}

export function useUserDiaryDisplayMode(flag: string): DisplayMode | undefined {
  const settings = useDiarySettings();
  const diarySetting = getChannelSetting(settings, flag);
  return diarySetting?.displayMode;
}

export function useDiaryCommentSortMode(flag: string): 'asc' | 'dsc' {
  const settings = useDiarySettings();
  const setting = getChannelSetting(settings, flag);
  return setting?.commentSortMode ?? 'asc';
}

const emptyGroupSideBarSort = { '~': 'A → Z' };
export function useGroupSideBarSort(): Record<string, SidebarSortMode> {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      return emptyGroupSideBarSort;
    }

    const { groups } = data;

    return JSON.parse(groups.groupSideBarSort ?? '{"~": "A → Z"}');
  }, [isLoading, data]);
}

export function useSeenWelcomeCard() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      console.log('returning default');
      return true;
    }

    return data.groups.seenWelcomeCard ?? false;
  }, [isLoading, data]);
}

export function useSeenTalkSunset() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      console.log('returning sunset default');
      return false;
    }

    return data.talk.seenSunsetMessage ?? false;
  }, [isLoading, data]);
}

export function useNewGroupFlags() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      return [];
    }

    return data.groups.newGroupFlags ?? [];
  }, [isLoading, data]);
}

export function useSideBarSortMode(): SidebarSortMode {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      return RECENT_SORT;
    }

    const { groups } = data;

    return groups.sideBarSort ?? RECENT_SORT;
  }, [isLoading, data]);
}

export function useShowActivityMessage() {
  const { data, isLoading } = useMergedSettings();
  const cookie = cookies.get('hasUsedGroups');

  return useMemo(() => {
    if (
      isLoading ||
      data === undefined ||
      window.desk !== 'groups' ||
      import.meta.env.DEV ||
      isNativeApp()
    ) {
      return false;
    }

    if ((!cookie || cookie === '1') && data.groups?.showActivityMessage) {
      return false;
    }

    if (
      cookie &&
      cookie !== '1' &&
      data.groups?.showActivityMessage === undefined
    ) {
      return true;
    }

    return data.groups?.showActivityMessage || false;
  }, [isLoading, data, cookie]);
}

export function useShowVitaMessage() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || window.desk !== 'talk') {
      return false;
    }

    const setting = data[window.desk]?.showVitaMessage;
    return setting;
  }, [isLoading, data]);
}

export function useMessagesFilter() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.talk === undefined) {
      return filters.dms;
    }

    const { talk } = data;

    return talk.messagesFilter ?? filters.dms;
  }, [isLoading, data]);
}

export function useTiles() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(
    () => ({
      order: data?.tiles?.order ?? [],
      loaded: !isLoading,
    }),
    [data, isLoading]
  );
}

export function useThemeMutation() {
  const { mutate, status } = usePutEntryMutation({
    bucket: 'display',
    key: 'theme',
  });

  return {
    mutate: (theme: Theme) => mutate({ val: theme }),
    status,
  };
}

export function createAnalyticsId() {
  return uuidv4();
}

export function useAnalyticsIdMutation() {
  const { mutate, status } = usePutEntryMutation({
    bucket: 'groups',
    key: 'analyticsId',
  });

  return {
    mutate: (analyticsId: string) => mutate({ val: analyticsId }),
    status,
  };
}

export function useResetAnalyticsIdMutation() {
  const { mutate, status } = useAnalyticsIdMutation();

  const newAnalyticsId = createAnalyticsId();

  return {
    mutate: () => mutate(newAnalyticsId),
    status,
  };
}

export const useAnalyticsId = () => {
  const { data, isLoading } = useMergedSettings();
  const { mutate, status } = useAnalyticsIdMutation();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      return '';
    }

    if (
      status !== 'loading' &&
      (data.groups.analyticsId === undefined || data.groups.analyticsId === '')
    ) {
      const newAnalyticsId = createAnalyticsId();

      mutate(newAnalyticsId);

      if (status !== 'success') {
        return '';
      }

      return newAnalyticsId;
    }

    return data.groups.analyticsId;
  }, [isLoading, data, mutate, status]);
};
