export type Contact = {
  id: string;
  nickname: string | null;
  bio: string | null;
  status: string | null;
  color: string | null;
  avatarImage: string | null;
  coverImage: string | null;
  pinnedGroupIds: string[];
};

const contactSchema = {
  name: 'Contact',
  properties: {
    id: 'string',
    nickname: 'string?',
    bio: 'string?',
    status: 'string?',
    color: 'string?',
    avatarImage: 'string?',
    coverImage: 'string?',
    pinnedGroupIds: 'string[]',
  },
  primaryKey: 'id',
};

export type Group = {
  id: string;
  roles?: GroupRole[];
  navSections?: GroupNavSection[];
  members?: GroupMember[];
  iconImage?: string;
  iconImageColor?: string;
  title?: string;
  coverImage?: string;
  coverColor?: string;
  description?: string;
  isSecret: boolean;
  isPreview?: boolean;
  pinIndex?: number | null;
  lastPostAt?: number | null;

  // Linked objects
  channels?: Channel[];
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
    pinIndex: 'int?',
    lastPostAt: 'int?',
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
  group?: Group;
  image?: string;
  title?: string;
  cover?: string;
  description?: string;
  addedToGroupAt?: number;
  currentUserIsMember?: boolean;
  postCount?: number;
  unreadCount?: number;
  firstUnreadPostId?: string;
  unreadThreads?: ThreadUnreadState[];
  lastPostAt?: number;
};

const channelSchema = {
  name: 'Channel',
  properties: {
    id: 'string',
    group: 'Group?',
    // Groups endpoint
    image: 'string?',
    title: 'string?',
    cover: 'string?',
    description: 'string?',
    addedToGroupAt: 'int?',
    currentUserIsMember: 'bool?',
    // Unreads endpoint
    postCount: 'int?',
    unreadCount: 'int?',
    firstUnreadPostId: 'string?',
    unreadThreads: 'ThreadUnreadState[]',
    lastPostAt: 'int?',
  },
  primaryKey: 'id',
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

// Should contain all schemas, will be passed to Realm constructor
export const schemas = [
  contactSchema,
  groupSchema,
  groupMemberSchema,
  groupRoleSchema,
  groupNavSectionSchema,
  channelSchema,
  threadUnreadStateSchema,
];

// Should contain all schema types, used to map Realm object types to TypeScript types
export type SchemaMap = {
  Contact: Contact;
  Group: Group;
  Channel: Channel;
};

export type SchemaName = keyof SchemaMap;
export type SchemaModel<T extends SchemaName> = SchemaMap[T];
export type SchemaKey<T extends SchemaName> = keyof SchemaModel<T>;
export type SchemaValue<T extends SchemaName> = SchemaModel<T>[SchemaKey<T>];
