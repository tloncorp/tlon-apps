import {
  SettingsUpdate,
  Value,
  getDeskSettings,
  DeskData,
  PutBucket,
  DelEntry,
  DelBucket,
} from '@urbit/api';
import _ from 'lodash';
import { lsDesk } from '@/constants';
import { HeapDisplayMode, HeapSortMode } from '@/types/heap';
import {
  BaseState,
  createState,
  createSubscription,
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
    tiles: {
      order: [],
    },
    calmEngine: {
      disableAppTileUnreads: false,
      disableAvatars: false,
      disableRemoteContent: false,
      disableSpellcheck: false,
      disableNicknames: false,
      disableWayfinding: false,
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
      showVitaMessage: false,
    },
    talk: {
      messagesFilter: filters.dms,
      showVitaMessage: false,
    },
    loaded: false,
    putEntry: async (bucket, key, val) => {
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
          const { 'settings-event': data } = event;
          if (
            data &&
            'put-entry' in data &&
            data['put-entry']['bucket-key'] === bucket &&
            data['put-entry']['entry-key'] === key &&
            data['put-entry'].value === val
          ) {
            reduceStateN(get(), data, reduceUpdate);

            return true;
          }
          return false;
        }
      );
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

export async function setCalmSetting(
  key: keyof SettingsState['calmEngine'],
  val: boolean
) {
  await useSettingsState.getState().putEntry('calmEngine', key, val);
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

const selHeapSettings = (s: SettingsState) => s.heaps.heapSettings;

export function useHeapSettings(): HeapSetting[] {
  const settings = useSettingsState(selHeapSettings);
  return parseSettings(settings ?? '');
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

const selDiarySettings = (s: SettingsState) => s.diary.settings;

export function useDiarySettings(): DiarySetting[] {
  const settings = useSettingsState(selDiarySettings);
  return parseSettings(settings ?? '');
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

const selGroupSideBarSort = (s: SettingsState) => s.groups.groupSideBarSort;

export function useGroupSideBarSort() {
  const settings = useSettingsState(selGroupSideBarSort);
  return JSON.parse(settings ?? '{"~": "A → Z"}');
}

export function useSideBarSortMode() {
  const settings = useSettingsState((s) => s.groups.sideBarSort);
  return settings ?? DEFAULT;
}

export function useShowVitaMessage() {
  const setting = useSettingsState(
    (s) => s[window.desk as 'groups' | 'talk']?.showVitaMessage
  );
  return setting;
}

const selLoaded = (s: SettingsState) => s.loaded;
export function useSettingsLoaded() {
  const loaded = useSettingsState(selLoaded);
  return loaded;
}
