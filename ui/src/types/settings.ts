import { Value, PutBucket, DelEntry, DelBucket } from '@urbit/api';
import { HeapDisplayMode, HeapSortMode } from '@/types/heap';

export interface ChannelSetting {
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

export interface PutEntry {
  // this is defined here because the PutEntry type in @urbit/api is missing the desk field
  'put-entry': {
    'bucket-key': string;
    'entry-key': string;
    value: Value;
    desk: string;
  };
}

export interface SettingsEvent {
  'settings-event': PutEntry | PutBucket | DelEntry | DelBucket;
}

export const ALPHABETICAL = 'A → Z';
export const DEFAULT = 'Arranged';
export const RECENT = 'Recent';

export type SidebarFilter =
  | 'Direct Messages'
  | 'All Messages'
  | 'Group Channels';

export const filters: Record<string, SidebarFilter> = {
  dms: 'Direct Messages',
  all: 'All Messages',
  groups: 'Group Channels',
};

export type ThemeType = 'light' | 'dark' | 'auto' | 'custom';
export type CustomTheme = {
  background: string;
  secondaryBackground: string;
  accent: string;
  accent2: string;
  accent3: string;
  primaryText: string;
  secondaryText: string;
};

export interface SettingsState {
  display: {
    theme: ThemeType;
    customTheme: Stringified<CustomTheme[]>;
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
    heapSettings: StringifiedWithKey<HeapSetting[]>;
  };
  diary: {
    settings: StringifiedWithKey<DiarySetting[]>;
  };
  talk: {
    messagesFilter: SidebarFilter;
    showVitaMessage: boolean;
  };
  groups: {
    orderedGroupPins: string[];
    sideBarSort: typeof ALPHABETICAL | typeof DEFAULT | typeof RECENT;
    groupSideBarSort: StringifiedWithKey<GroupSideBarSort>;
    showVitaMessage: boolean;
  };
  loaded: boolean;
  putEntry: (bucket: string, key: string, value: Value) => Promise<void>;
  fetchAll: () => Promise<void>;
  [ref: string]: unknown;
}
