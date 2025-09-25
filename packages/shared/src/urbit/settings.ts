import { ThemeName } from 'tamagui';

import { Stringified } from '../utils';
import { DisplayMode, SortMode } from './channel';

export type AppTheme = ThemeName | 'auto';

export type TalkSidebarFilter =
  | 'Direct Messages'
  | 'All Messages'
  | 'Group Channels';

export const ALPHABETICAL_SORT = 'A → Z';
export const DEFAULT_SORT = 'Arranged';
export const RECENT_SORT = 'Recent';

export type SidebarSortMode =
  | typeof ALPHABETICAL_SORT
  | typeof DEFAULT_SORT
  | typeof RECENT_SORT;

interface GroupSideBarSort {
  [flag: string]:
    | typeof ALPHABETICAL_SORT
    | typeof RECENT_SORT
    | typeof DEFAULT_SORT;
}

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

export type CalmEngineSettings = {
  disableAppTileUnreads?: boolean;
  disableAvatars?: boolean;
  disableRemoteContent?: boolean;
  disableSpellcheck?: boolean;
  disableNicknames?: boolean;
};

export type DisplaySettings = {
  theme?: AppTheme;
};

export type GroupsSettings = {
  orderedGroupPins?: string[];
  sideBarSort?: SidebarSortMode;
  groupSideBarSort?: Stringified<GroupSideBarSort>;
  hasBeenUsed?: boolean;
  showActivityMessage?: boolean;
  enableTelemetry?: boolean;
  logActivity?: boolean; // Deprecated, use enableTelemetry
  analyticsId?: string;
  seenWelcomeCard?: boolean;
  newGroupFlags: string[];
  groupsNavState?: string;
  messagesNavState?: string;
  activitySeenTimestamp?: number;
  completedWayfindingSplash?: boolean;
  completedWayfindingTutorial?: boolean;
  disableTlonInfraEnhancement?: boolean;
  nagStateContactBookPrompt?: string;
  nagStateNotificationsPrompt?: string;
};

export type TalkSettings = {
  messagesFilter?: TalkSidebarFilter;
};

export type LandscapeTilesSettings = {
  tiles: {
    order?: string[];
  };
};

export type GallerySettings = {
  heapSettings: Stringified<HeapSetting[]>;
};

export type NotebookSettings = {
  settings: Stringified<DiarySetting[]>;
  markdown: boolean;
};

export type GroupsDeskSettings = {
  desk: {
    talk?: TalkSettings;
    heaps?: GallerySettings;
    diary?: NotebookSettings;
    groups?: GroupsSettings;
    calmEngine?: CalmEngineSettings;
    display?: DisplaySettings;
  };
};

export declare type Key = string;
export declare type Value = string | string[] | boolean | number;
export declare type Bucket = {
  [key: string]: Value;
};

export interface PutBucket {
  'put-bucket': {
    desk: string;
    'bucket-key': Key;
    bucket: Bucket;
  };
}
export interface DelBucket {
  'del-bucket': {
    desk: string;
    'bucket-key': Key;
  };
}
export interface PutEntry {
  'put-entry': {
    'bucket-key': Key;
    'entry-key': Key;
    value?: Value;
    desk: string;
  };
}
export interface DelEntry {
  'del-entry': {
    desk: string;
    'bucket-key': Key;
    'entry-key': Key;
  };
}

export interface SettingsEvent {
  'settings-event': PutEntry | PutBucket | DelEntry | DelBucket;
}
