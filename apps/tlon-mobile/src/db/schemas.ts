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

// Should contain all schemas, will be passed to Realm constructor
export const schemas = [contactSchema];

// Should contain all schema types, used to map Realm object types to TypeScript types
export type SchemaMap = {
  Contact: Contact;
};

export type SchemaName = keyof SchemaMap;
