import {IconName} from '@components/ochre';
import Realm from 'realm';

export const DEFAULT_ACCOUNT_ID = 'default';

export type Contact = {
  id: string;
  nickname?: string;
  bio?: string;
  status?: string;
  color?: string;
  avatar?: string | null;
  cover?: string | null;
  groups?: string[];
};

const contactSchema = {
  name: 'Contact',
  properties: {
    id: 'string',
    nickname: 'string?',
    bio: 'string?',
    status: 'string?',
    color: 'string?',
    avatar: 'string?',
    cover: 'string?',
    groups: 'string[]',
  },
  primaryKey: 'id',
};

export type Account = {
  id: string;
  ship: string;
  url: string;
  cookie?: string;
};

const accountSchema = {
  name: 'Account',
  properties: {
    id: 'string',
    ship: 'string',
    url: 'string',
    cookie: 'string?',
  },
  primaryKey: 'id',
};

export type Group = {
  id: string;
  roles?: GroupRole[];
  navSections?: GroupNavSection[];
  members?: GroupMember[];
  latestPost?: Post;
  iconImage?: string;
  iconImageColor?: string;
  title?: string;
  coverImage?: string;
  coverColor?: string;
  description?: string;
  isSecret: boolean;
  isPreview?: boolean;

  // Linked objects
  channels?: Channel[];
  posts?: Post[];
};

const groupSchema = {
  name: 'Group',
  properties: {
    id: 'string',
    roles: 'GroupRole[]',
    navSections: 'GroupNavSection[]',
    members: 'GroupMember[]',
    iconImage: 'string?',
    iconImageColor: 'string?',
    coverImage: 'string?',
    coverImageColor: 'string?',
    title: 'string?',
    description: 'string?',
    isSecret: 'bool',
    latestPost: 'Post?',
    channels: {
      type: 'linkingObjects',
      objectType: 'Channel',
      property: 'group',
    },
  },
  primaryKey: 'id',
} as const;

export type GroupMember = {
  id: string;
  roles: string[];
  joinedAt: number;
};

const groupMemberSchema = {
  name: 'GroupMember',
  embedded: true,
  properties: {
    id: 'string',
    roles: 'string[]',
    joinedAt: 'int',
  },
} as const;

export type GroupRole = {
  name: string;
  image?: string;
  title?: string;
  cover?: string;
  description?: string;
};

const groupRoleSchema = {
  name: 'GroupRole',
  embedded: true,
  properties: {
    name: 'string',
    image: 'string?',
    title: 'string?',
    cover: 'string?',
    description: 'string?',
  },
};

export type GroupNavSection = {
  id: string;
  channelIds?: string[];
  image?: string;
  title?: string;
  cover?: string;
  description?: string;
};

const groupNavSectionSchema = {
  name: 'GroupNavSection',
  embedded: true,
  properties: {
    id: 'string',
    channelIds: 'string[]',
    image: 'string?',
    title: 'string?',
    cover: 'string?',
    description: 'string?',
  },
};

export type Channel = {
  id: string;
  loadedOldest?: boolean;
  nextOldestPage?: string;
  syncedAt?: number;
  addedAt?: number;
  image?: string;
  title?: string;
  cover?: string;
  description?: string;
  joined?: boolean;
  // Direct relations
  group?: Group;
  // Linked objects
  latestPost?: Post;
  posts?: Realm.Results<Post>;
  totalPosts?: number;
  unreadState?: ChannelUnreadState;
  syncing?: boolean;
};

const channelSchema = {
  name: 'Channel',
  properties: {
    id: 'string',
    loadedOldest: 'bool?',
    nextOldestPage: 'string?',
    syncedAt: 'int?',
    addedAt: 'int?',
    image: 'string?',
    title: 'string?',
    cover: 'string?',
    description: 'string?',
    group: 'Group?',
    latestPost: 'Post?',
    joined: 'bool?',
    syncing: 'bool?',
    totalPosts: 'int?',
    posts: {
      type: 'linkingObjects',
      objectType: 'Post',
      property: 'channel',
    },
    unreadState: 'ChannelUnreadState?',
  },
  primaryKey: 'id',
} as const;

export type ChannelUnreadState = {
  count: number;
  firstUnreadId?: string;
  unreadThreads: ThreadUnreadState[];
  updatedAt: number;
};

const channelUnreadStateSchema = {
  name: 'ChannelUnreadState',
  embedded: true,
  properties: {
    count: 'int',
    firstUnreadId: 'string?',
    unreadThreads: 'ThreadUnreadState[]',
    updatedAt: 'int',
  },
} as const;

export type ThreadUnreadState = {
  threadId: string;
  firstUnreadId?: string;
  count: number;
};

const threadUnreadStateSchema = {
  name: 'ThreadUnreadState',
  embedded: true,
  properties: {
    threadId: 'string',
    count: 'int',
    firstUnreadId: 'string?',
  },
} as const;

export type PostType = 'heap' | 'chat' | 'notice' | 'diary';

export interface ChannelReference {
  type: 'reference';
  referenceType: 'channel';
  channelId: string;
  postId: string;
  replyId?: string;
}

export interface GroupReference {
  type: 'reference';
  referenceType: 'group';
  groupId: string;
}

export interface AppReference {
  type: 'reference';
  referenceType: 'app';
  userId: string;
  appId: string;
}

export type ContentReference = ChannelReference | GroupReference | AppReference;

export type PostFlags = {
  hasAppReference?: boolean;
  hasChannelReference?: boolean;
  hasGroupReference?: boolean;
  hasLink?: boolean;
  hasImage?: boolean;
};

export type Post = {
  id: string;
  author?: string;
  metadata?: PostMetadata;
  content?: string;
  sentAt?: number;
  receivedAt: number;
  replyCount?: number;
  type?: PostType;
  text?: string;
  // Embedded
  reactions?: Reaction[];
  images?: Image[];
  // Direct Relations
  channel?: Channel;
  group?: Group;
} & PostFlags;

const postSchema = {
  name: 'Post',
  properties: {
    id: 'string',
    author: 'string?',
    metadata: 'PostMetadata?',
    content: 'string?',
    sentAt: 'int?',
    receivedAt: 'int?',
    replyCount: 'int?',
    type: 'string?',
    channel: 'Channel?',
    group: 'Group?',
    reactions: 'Reaction[]',
    images: 'Image[]',
    text: 'string?',
    hasAppReference: 'bool?',
    hasChannelReference: 'bool?',
    hasGroupReference: 'bool?',
    hasLink: 'bool?',
    hasImage: 'bool?',
  },
  primaryKey: 'id',
} as const;

export type PostMetadata = {
  title?: string;
  image?: string;
};

const postMetadataSchema = {
  name: 'PostMetadata',
  embedded: true,
  properties: {
    title: 'string?',
    image: 'string?',
  },
} as const;

export type Reaction = {
  name: string;
  reaction: string;
};

const reactionSchema = {
  name: 'Reaction',
  embedded: true,
  properties: {
    name: 'string',
    reaction: 'string',
  },
} as const;

export type Image = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

const imageSchema = {
  name: 'Image',
  embedded: true,
  properties: {
    src: 'string',
    alt: 'string?',
    width: 'int?',
    height: 'int?',
  },
} as const;

export type User = {
  id: string;
  displayName?: string;
  avatarImage?: string;
};

const userSchema = {
  name: 'User',
  properties: {
    id: 'string',
    displayName: 'string?',
    avatarImage: 'string?',
  },
  primaryKey: 'id',
} as const;

export type TabGroupSettings = {
  id: string;
  tabs: TabSettings[];
};

export const TabGroupSettings = {
  default(id: string): TabGroupSettings {
    return {
      id,
      tabs: [],
    };
  },
};

const tabGroupSettingsSchema = {
  name: 'TabGroupSettings',
  properties: {
    id: 'string',
    tabs: 'TabSettings[]',
  },
  primaryKey: 'id',
} as const;

export type TabSettings = {
  icon?: TabIcon;
  view?: StreamViewSettings;
  query?: StreamQuerySettings;
};

export const TabSettings = {
  default() {
    return {
      icon: {
        type: 'icon',
        value: 'Messages',
        color: 'transparent',
      },
      view: StreamViewSettings.default(),
      query: StreamQuerySettings.default(),
    } as const;
  },
};

const tabSettingsSchema = {
  name: 'TabSettings',
  embedded: true,
  properties: {
    icon: 'TabIcon',
    view: 'StreamViewSettings',
    query: 'StreamQuerySettings',
  },
} as const;

export type TabIcon = {color: string} & (
  | {type: 'emoji'; value: string}
  | {type: 'icon'; value: IconName}
);

const tabIconSchema = {
  name: 'TabIcon',
  embedded: true,
  properties: {
    type: 'string',
    value: 'string',
    color: 'string',
  },
} as const;

export type StreamViewSettings = {
  showAuthor?: boolean;
  showContent?: boolean;
  showTime?: boolean;
  showChannel?: boolean;
  showGroup?: boolean;
  showReplyCount?: boolean;
};

export const StreamViewSettings = {
  default(): StreamViewSettings {
    return {
      showAuthor: true,
      showContent: true,
      showTime: true,
      showChannel: true,
      showGroup: true,
      showReplyCount: true,
    };
  },
};

const streamViewSettingsSchema = {
  name: 'StreamViewSettings',
  embedded: true,
  properties: {
    showAuthor: 'bool?',
    showContent: 'bool?',
    showTime: 'bool?',
    showChannel: 'bool?',
    showGroup: 'bool?',
    showReplyCount: 'bool?',
  },
};

export type StreamViewSettingsKey = keyof StreamViewSettings;
export type StreamGroupBy = 'channel' | 'group' | 'post';
export type StreamPostType = 'chat' | 'diary' | 'heap' | 'all';

// TODO: at some point this is probably going to need to be split for different
// query types.
export interface StreamQuerySettings {
  groupBy?: StreamGroupBy;
  byAuthors?: string[];
  ofType?: StreamPostType[];
  inGroups?: Group[];
  inChannels?: Channel[];
  containsText?: string | null;
  hasLink?: boolean;
  hasImage?: boolean;
  hasEmbed?: boolean;
  includeEmpty?: boolean;
  hasBlockCode?: boolean;
  hasBlockQuote?: boolean;
  receivedBefore?: number;
  receivedAfter?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  updatedAfter?: number | null;
}

export const StreamQuerySettings = {
  default(): StreamQuerySettings {
    return {
      groupBy: 'post',
      byAuthors: [],
      ofType: [],
      inGroups: [],
      inChannels: [],
      hasLink: false,
      hasImage: false,
      hasEmbed: false,
      hasBlockCode: false,
      hasBlockQuote: false,
    };
  },
};

const streamQuerySettingsSchema = {
  name: 'StreamQuerySettings',
  embedded: true,
  properties: {
    groupBy: 'string?',
    byAuthors: 'string[]',
    ofType: 'string[]',
    inGroups: 'Group[]',
    inChannels: 'Channel[]',
    containsText: 'string[]',
    hasLink: 'bool?',
    hasImage: 'bool?',
    hasEmbed: 'bool?',
    hasBlockCode: 'bool?',
    hasBlockQuote: 'bool?',
  },
} as const;

export type App = {
  id: string;
  color: string;
  title: string;
  image?: string;
  license: string;
  version: string;
  desk: string;
  website: string;
  publisherId: string;
  hash: string;
  description?: string;
  updatedAt: number;
  sourceType: string;
  sourceHash?: string;
  sourceBase: string;
  sourceUrl: string;
};

const appSchema = {
  name: 'App',
  properties: {
    id: 'string',
    color: 'string',
    title: 'string',
    image: 'string?',
    license: 'string',
    version: 'string',
    desk: 'string',
    website: 'string',
    publisherId: 'string',
    hash: 'string',
    description: 'string?',
    updatedAt: 'int',
    sourceType: 'string',
    sourceHash: 'string?',
    sourceBase: 'string',
    sourceUrl: 'string',
  },
  primaryKey: 'id',
} as const;

export const schemas = [
  contactSchema,
  accountSchema,
  groupSchema,
  groupMemberSchema,
  groupRoleSchema,
  groupNavSectionSchema,
  channelSchema,
  channelUnreadStateSchema,
  threadUnreadStateSchema,
  postSchema,
  postMetadataSchema,
  reactionSchema,
  imageSchema,
  userSchema,
  tabGroupSettingsSchema,
  tabSettingsSchema,
  streamViewSettingsSchema,
  streamQuerySettingsSchema,
  tabIconSchema,
  appSchema,
];

export type PrimarySchemaMap = {
  Contact: Contact;
  Account: Account;
  Group: Group;
  Channel: Channel;
  Post: Post;
  User: User;
  TabGroupSettings: TabGroupSettings;
  App: App;
};

export type EmbeddedSchemaMap = {
  GroupRole: GroupRole;
  GroupMember: GroupMember;
  GroupNavSection: GroupNavSection;
  ChannelUnreadState: ChannelUnreadState;
  ThreadUnreadState: ThreadUnreadState;
  PostMetadata: PostMetadata;
  Reaction: Reaction;
  Image: Image;
  TabSettings: TabSettings;
  TabIcon: TabIcon;
  StreamViewSettings: StreamViewSettings;
  StreamQuerySettings: StreamQuerySettings;
};

export type SchemaMap = PrimarySchemaMap & EmbeddedSchemaMap;
