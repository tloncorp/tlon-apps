import {
  SettingsUpdate,
  Value,
  putEntry as doPutEntry,
  getDeskSettings,
  DeskData,
} from '@urbit/api';
import _ from 'lodash';
import { lsDesk } from '@/constants';
import { HeapDisplayMode, HeapSortMode } from '@/types/heap';
import {
  BaseState,
  createState,
  createSubscription,
  pokeOptimisticallyN,
  reduceStateN,
} from './base';
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

interface BaseSettingsState {
  display: {
    theme: 'light' | 'dark' | 'auto';
  };
  calmEngine: {
    disableAppTileUnreads: boolean;
    disableAvatars: boolean;
    disableRemoteContent: boolean;
    disableSpellcheck: boolean;
    disableNicknames: boolean;
  };
  heaps: {
    heapSettings: Stringified<HeapSetting[]>;
  };
  diary: {
    settings: Stringified<DiarySetting[]>;
  };
  talk: {
    messagesFilter: SidebarFilter;
  };
  groups: {
    orderedGroupPins: string[];
    sideBarSort: typeof ALPHABETICAL | typeof DEFAULT | typeof RECENT;
    groupSideBarSort: Stringified<GroupSideBarSort>;
  };
  loaded: boolean;
  putEntry: (bucket: string, key: string, value: Value) => Promise<void>;
  fetchAll: () => Promise<void>;
  [ref: string]: unknown;
}

export type SettingsState = BaseSettingsState & BaseState<BaseSettingsState>;

function putBucket(json: SettingsUpdate, draft: SettingsState): SettingsState {
  const data = _.get(json, 'put-bucket', false);
  if (data) {
    draft[data['bucket-key']] = data.bucket;
  }
  return draft;
}

function delBucket(json: SettingsUpdate, draft: SettingsState): SettingsState {
  const data = _.get(json, 'del-bucket', false);
  if (data) {
    delete draft[data['bucket-key']];
  }
  return draft;
}

function putEntry(json: SettingsUpdate, draft: any): SettingsState {
  const data: Record<string, string> = _.get(json, 'put-entry', false);
  if (data) {
    if (!draft[data['bucket-key']]) {
      draft[data['bucket-key']] = {};
    }
    draft[data['bucket-key']][data['entry-key']] = data.value;
  }
  return draft;
}

function delEntry(json: SettingsUpdate, draft: any): SettingsState {
  const data = _.get(json, 'del-entry', false);
  if (data) {
    delete draft[data['bucket-key']][data['entry-key']];
  }
  return draft;
}

export const reduceUpdate = [putBucket, delBucket, putEntry, delEntry];

export const useSettingsState = createState<BaseSettingsState>(
  'Settings',
  (set, get) => ({
    display: {
      theme: 'auto',
    },
    calmEngine: {
      disableAppTileUnreads: false,
      disableAvatars: false,
      disableRemoteContent: false,
      disableSpellcheck: false,
      disableNicknames: false,
    },
    heaps: {
      heapSettings: '' as Stringified<HeapSetting[]>,
    },
    diary: {
      settings: '' as Stringified<DiarySetting[]>,
    },
    groups: {
      orderedGroupPins: [],
      sideBarSort: DEFAULT,
      groupSideBarSort: '{"~": "A → Z"}' as Stringified<GroupSideBarSort>,
    },
    talk: {
      messagesFilter: filters.dms,
    },
    loaded: false,
    putEntry: async (bucket, key, val) => {
      const poke = doPutEntry(window.desk, bucket, key, val);
      await pokeOptimisticallyN(useSettingsState, poke, reduceUpdate);
    },
    fetchAll: async () => {
      const grResult = (await api.scry<DeskData>(getDeskSettings(window.desk)))
        .desk;
      const lsResult = (await api.scry<DeskData>(getDeskSettings(lsDesk))).desk;
      const newState = {
        ..._.mergeWith(get(), grResult, lsResult, (obj, src) =>
          _.isArray(src) ? src : undefined
        ),
        loaded: true,
      };
      set(newState);
    },
  }),
  ['display', 'heaps', 'diary', 'groups', 'talk'],
  [
    (set, get) =>
      createSubscription('settings-store', `/desk/${window.desk}`, (e) => {
        const data = _.get(e, 'settings-event', false);
        if (data) {
          reduceStateN(get(), data, reduceUpdate);
          set({ loaded: true });
        }
      }),
    (set, get) =>
      createSubscription('settings-store', `/desk/${lsDesk}`, (e) => {
        const data = _.get(e, 'settings-event', false);
        if (data) {
          reduceStateN(get(), data, reduceUpdate);
          set({ loaded: true });
        }
      }),
  ]
);

const selTheme = (s: SettingsState) => s.display.theme;
export function useTheme() {
  return useSettingsState(selTheme);
}

const selCalm = (s: SettingsState) => s.calmEngine;
export function useCalm() {
  return useSettingsState(selCalm);
}

export function parseSettings<T>(settings: Stringified<T[]>): T[] {
  return settings !== '' ? JSON.parse(settings) : [];
}

export function getSetting<T extends ChannelSetting>(
  settings: T[],
  flag: string
): T | undefined {
  return settings.find((el) => el.flag === flag);
}

export function setSetting<T extends ChannelSetting>(
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

const selHeapSettings = (s: SettingsState) => s.heaps.heapSettings;

export function useHeapSettings(): HeapSetting[] {
  const settings = useSettingsState(selHeapSettings);
  return parseSettings(settings ?? '');
}

export function useHeapSortMode(flag: string): HeapSortMode {
  const settings = useHeapSettings();
  const heapSetting = getSetting(settings, flag);
  return heapSetting?.sortMode ?? 'time';
}

export function useHeapDisplayMode(flag: string): HeapDisplayMode {
  const settings = useHeapSettings();
  const heapSetting = getSetting(settings, flag);
  return heapSetting?.displayMode ?? 'grid';
}

const selDiarySettings = (s: SettingsState) => s.diary.settings;

export function useDiarySettings(): DiarySetting[] {
  const settings = useSettingsState(selDiarySettings);
  return parseSettings(settings ?? '');
}

export function useDiarySortMode(
  flag: string
): 'time-dsc' | 'quip-dsc' | 'time-asc' | 'quip-asc' {
  const settings = useDiarySettings();
  const heapSetting = getSetting(settings, flag);
  return heapSetting?.sortMode ?? 'time-dsc';
}

export function useDiaryCommentSortMode(flag: string): 'asc' | 'dsc' {
  const settings = useDiarySettings();
  const setting = getSetting(settings, flag);
  return setting?.commentSortMode ?? 'dsc';
}

const selGroupSideBarSort = (s: SettingsState) => s.groups.groupSideBarSort;

export function useGroupSideBarSort() {
  const settings = useSettingsState(selGroupSideBarSort);
  return JSON.parse(settings ?? '{"~": "A → Z"}');
}
