import { useMemo } from 'react';
import { Value, PutBucket, DelEntry, DelBucket } from '@urbit/api';
import _ from 'lodash';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lsDesk } from '@/constants';
import { HeapDisplayMode, HeapSortMode } from '@/types/heap';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import api from '../api';

interface ChannelSetting {
  flag: string;
}

export interface HeapSetting extends ChannelSetting {
  sortMode: HeapSortMode;
  displayMode: HeapDisplayMode;
}

export interface DiarySetting extends ChannelSetting {
  sortMode: 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc';
  commentSortMode: 'asc' | 'dsc';
}

interface GroupSideBarSort {
  [flag: string]: typeof ALPHABETICAL | typeof RECENT | typeof DEFAULT;
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

const ALPHABETICAL = 'A → Z';
const DEFAULT = 'Arranged';
const RECENT = 'Recent';

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
  };
  talk: {
    messagesFilter: SidebarFilter;
    showVitaMessage: boolean;
  };
  groups: {
    orderedGroupPins: string[];
    sideBarSort: typeof ALPHABETICAL | typeof DEFAULT | typeof RECENT;
    groupSideBarSort: Stringified<GroupSideBarSort>;
    showVitaMessage: boolean;
    hasBeenUsed: boolean;
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

export function useTheme() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.display === undefined) {
      return 'auto';
    }

    const { display } = data;

    return display.theme;
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
    onMutate: () => {
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

export function useHeapSortMode(flag: string): HeapSortMode {
  const settings = useHeapSettings();
  const heapSetting = getChannelSetting(settings, flag);
  return heapSetting?.sortMode ?? 'time';
}

export function useHeapDisplayMode(flag: string): HeapDisplayMode {
  const settings = useHeapSettings();
  const heapSetting = getChannelSetting(settings, flag);
  return heapSetting?.displayMode ?? 'grid';
}

export function useDiarySettings(): DiarySetting[] {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.diary === undefined) {
      return [];
    }

    const { diary } = data;

    return parseSettings(diary.settings) as DiarySetting[];
  }, [isLoading, data]);
}

export function useDiarySortMode(
  flag: string
): 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc' {
  const settings = useDiarySettings();
  const heapSetting = getChannelSetting(settings, flag);
  return heapSetting?.sortMode ?? 'time-dsc';
}

export function useDiaryCommentSortMode(flag: string): 'asc' | 'dsc' {
  const settings = useDiarySettings();
  const setting = getChannelSetting(settings, flag);
  return setting?.commentSortMode ?? 'asc';
}

const emptyGroupSideBarSort = { '~': 'A → Z' };
export function useGroupSideBarSort() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      return emptyGroupSideBarSort;
    }

    const { groups } = data;

    return JSON.parse(groups.groupSideBarSort ?? '{"~": "A → Z"}');
  }, [isLoading, data]);
}

export function useSideBarSortMode() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      return DEFAULT;
    }

    const { groups } = data;

    return groups.sideBarSort ?? DEFAULT;
  }, [isLoading, data]);
}

export function useShowVitaMessage() {
  const { data, isLoading } = useMergedSettings();

  return useMemo(() => {
    if (isLoading || data === undefined) {
      return false;
    }

    const setting = data[window.desk as 'groups' | 'talk']?.showVitaMessage;
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
