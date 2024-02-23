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

// Should contain all schemas, will be passed to Realm constructor
export const schemas = [contactSchema];

// Should contain all schema types, used to map Realm object types to TypeScript types
export type SchemaMap = {
  Contact: Contact;
};

export type SchemaName = keyof SchemaMap;
