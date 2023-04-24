import { useMemo } from 'react';
import { Value } from '@urbit/api';
import _ from 'lodash';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lsDesk } from '@/constants';
import { HeapDisplayMode, HeapSortMode } from '@/types/heap';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import {
  ChannelSetting,
  CustomTheme,
  DEFAULT,
  DiarySetting,
  filters,
  HeapSetting,
  PutEntry,
  SettingsEvent,
  SettingsState,
  ThemeType,
} from '@/types/settings';
import api from '../api';

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
        app: 'settings-store',
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
        app: 'settings-store',
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

export const useSettings = () => {
  const { data, isLoading } = useReactQuerySubscription({
    scry: `/desk/${window.desk}`,
    scryApp: 'settings-store',
    app: 'settings-store',
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

export const useLandscapeSettings = () => {
  const { data, isLoading } = useReactQuerySubscription({
    scry: `/desk/${lsDesk}`,
    scryApp: 'settings-store',
    app: 'settings-store',
    path: `/desk/${lsDesk}`,
    queryKey: ['settings', lsDesk],
  });

  const { desk } = data as { desk: SettingsState };

  return { data: desk, isLoading };
};
export const useMergedSettings = () => {
  const { data: settings, isLoading: isSettingsLoading } = useSettings();
  const { data: lsSettings, isLoading: isLandscapeSettingsLoading } =
    useLandscapeSettings();

  return {
    data: {
      ..._.mergeWith(
        settings as Record<string, unknown>,
        lsSettings as Record<string, unknown>,
        (obj, src) => (_.isArray(src) ? src : undefined)
      ),
    } as { desk: SettingsState },
    isLoading: isSettingsLoading || isLandscapeSettingsLoading,
  };
};

export function useTheme() {
  const { data, isLoading } = useSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.display === undefined) {
      return 'auto';
    }

    const { display } = data;

    return display.theme;
  }, [isLoading, data]);
}

export function useThemeMutation() {
  const { mutate, status } = usePutEntryMutation({
    bucket: 'display',
    key: 'theme',
  });

  return {
    mutate: (theme: ThemeType) => mutate({ val: theme }),
    status,
  };
}

const emptyCustomTheme: CustomTheme = {
  background: '#FFFFFF',
  secondaryBackground: '#F5F5F5',
  accent: '#008EFF',
  accent2: '#E5F4FF',
  accent3: '#008EFF1A',
  primaryText: '#333333',
  secondaryText: '#999999',
};

export function useCustomTheme(): CustomTheme {
  const { data, isLoading } = useSettings();

  return useMemo(() => {
    if (
      isLoading ||
      data === undefined ||
      data.display?.customTheme === undefined
    ) {
      return emptyCustomTheme;
    }

    const { display } = data;

    return JSON.parse(display.customTheme);
  }, [isLoading, data]);
}

export function useCustomThemeMutation() {
  const currentTheme = useCustomTheme();
  const { mutate, status } = usePutEntryMutation({
    bucket: 'display',
    key: 'customTheme',
  });

  return {
    mutate: (theme: CustomTheme) =>
      mutate({ val: JSON.stringify({ ...currentTheme, ...theme }) }),
    status,
  };
}

export function useResetCustomThemeMutation() {
  const { mutate, status } = usePutEntryMutation({
    bucket: 'display',
    key: 'customTheme',
  });

  return {
    mutate: () => mutate({ val: JSON.stringify(emptyCustomTheme) }),
    status,
  };
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
  const { data, isLoading } = useSettings();

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

export function parseSettings<T>(settings: StringifiedWithKey<T[]>): T[] {
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
  const { data, isLoading } = useSettings();

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
  const { data, isLoading } = useSettings();

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
  const { data, isLoading } = useSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      return emptyGroupSideBarSort;
    }

    const { groups } = data;

    return JSON.parse(groups.groupSideBarSort ?? '{"~": "A → Z"}');
  }, [isLoading, data]);
}

export function useSideBarSortMode() {
  const { data, isLoading } = useSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.groups === undefined) {
      return DEFAULT;
    }

    const { groups } = data;

    return groups.sideBarSort ?? DEFAULT;
  }, [isLoading, data]);
}

export function useShowVitaMessage() {
  const { data, isLoading } = useSettings();

  return useMemo(() => {
    if (isLoading || data === undefined) {
      return false;
    }

    const setting = data[window.desk as 'groups' | 'talk']?.showVitaMessage;
    return setting;
  }, [isLoading, data]);
}

export function useMessagesFilter() {
  const { data, isLoading } = useSettings();

  return useMemo(() => {
    if (isLoading || data === undefined || data.talk === undefined) {
      return filters.dms;
    }

    const { talk } = data;

    return talk.messagesFilter ?? filters.dms;
  }, [isLoading, data]);
}

export function useTiles() {
  const { data, isLoading } = useSettings();

  return useMemo(
    () => ({
      order: data?.tiles?.order ?? [],
      loaded: !isLoading,
    }),
    [data, isLoading]
  );
}
