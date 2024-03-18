import type { ClientTypes as Client } from '@tloncorp/shared';

export function fallbackContact(id: string): Client.Contact {
  return {
    id,
    nickname: null,
    bio: null,
    status: null,
    color: null,
    avatarImage: null,
    coverImage: null,
    pinnedGroupIds: [],
  };
}

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

const unreadSchema = {
  name: 'Unread',
  properties: {
    channelId: 'string',
    // TODO: Rename `unreadCount`, include unread threads and total counts
    totalCount: 'int',
    type: 'string',
  },
  primaryKey: 'channelId',
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

const groupMemberSchema = {
  name: 'GroupMember',
  embedded: true,
  properties: {
    id: 'string',
    roles: 'string[]',
    joinedAt: 'int',
  },
} as const;

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
  unreadSchema,
  groupSchema,
  groupMemberSchema,
  groupRoleSchema,
  groupNavSectionSchema,
  channelSchema,
  threadUnreadStateSchema,
];

// Should contain all schema types, used to map Realm object types to TypeScript types
export type SchemaMap = {
  Contact: Client.Contact;
  Unread: Client.Unread;
  Group: Client.Group;
  Channel: Client.Channel;
};

export type SchemaName = keyof SchemaMap;
export type SchemaModel<T extends SchemaName> = SchemaMap[T];
export type SchemaKey<T extends SchemaName> = keyof SchemaModel<T>;
export type SchemaValue<T extends SchemaName> = SchemaModel<T>[SchemaKey<T>];
