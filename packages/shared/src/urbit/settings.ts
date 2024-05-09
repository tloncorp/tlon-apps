import { DisplayMode, SortMode } from './channel';

export type Theme = 'light' | 'dark' | 'auto';

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

type Stringified<T> = string & {
  [P in keyof T]: { '_ value': T[P] };
};

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
  theme?: Theme;
};

export type GroupsSettings = {
  orderedGroupPins?: string[];
  sideBarSort?: SidebarSortMode;
  groupSideBarSort?: Stringified<GroupSideBarSort>;
  hasBeenUsed?: boolean;
  showActivityMessage?: boolean;
  logActivity?: boolean;
  analyticsId?: string;
  seenWelcomeCard?: boolean;
  newGroupFlags: string[];
  groupsNavState?: string;
  messagesNavState?: string;
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
