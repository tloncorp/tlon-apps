import type { Contact, Unread } from '@tloncorp/shared';

export function fallbackContact(id: string): Contact {
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
    totalCount: 'int',
    type: 'string',
  },
  primaryKey: 'channelId',
};

// Should contain all schemas, will be passed to Realm constructor
export const schemas = [contactSchema, unreadSchema];

// Should contain all schema types, used to map Realm object types to TypeScript types
export type SchemaMap = {
  Contact: Contact;
  Unread: Unread;
};

export type SchemaName = keyof SchemaMap;
export type SchemaModel<T extends SchemaName> = SchemaMap[T];
export type SchemaKey<T extends SchemaName> = keyof SchemaModel<T>;
export type SchemaValue<T extends SchemaName> = SchemaModel<T>[SchemaKey<T>];
