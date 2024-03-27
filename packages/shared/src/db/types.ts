import type {
  ExtractTablesWithRelations,
  InferModelFromColumns,
  Many,
  One,
} from 'drizzle-orm';

import * as schema from './schema';

export type Schema = typeof schema;
type SchemaWithRelations = ExtractTablesWithRelations<Schema>;
type DbTableNames = SchemaWithRelations[keyof SchemaWithRelations]['dbName'];
type TableName = keyof SchemaWithRelations;
type TableRelations<T extends TableName> = SchemaWithRelations[T]['relations'];

type SchemaFromDbTableName<T extends DbTableNames> = Extract<
  SchemaWithRelations[keyof SchemaWithRelations],
  { dbName: T }
>;

type InsertRelations<T extends TableName> = {
  [K in keyof TableRelations<T>]?: TableRelations<T>[K] extends Many<
    infer TTableName
  >
    ? TTableName extends DbTableNames
      ? Insertable<SchemaFromDbTableName<TTableName>['tsName']>[]
      : never
    : TableRelations<T>[K] extends One<infer TTableName>
    ? TTableName extends DbTableNames
      ? Insertable<SchemaFromDbTableName<TTableName>['tsName']>
      : never
    : never;
};

export type Insertable<T extends TableName> = InferModelFromColumns<
  SchemaWithRelations[T]['columns'],
  'insert'
> &
  InsertRelations<T>;

export type Contact = typeof schema.contacts.$inferSelect;
export type ContactInsert = Insertable<'contacts'>;
export type Unread = typeof schema.unreads.$inferSelect;
export type UnreadInsert = typeof schema.unreads.$inferInsert;
export type GroupsTable = typeof schema.groups;
export type Group = typeof schema.groups.$inferSelect;
export type GroupInsert = Insertable<'groups'>;
export type GroupRole = typeof schema.groupRoles.$inferSelect;
export type GroupRoleInsert = typeof schema.groupRoles.$inferInsert;
export type GroupMember = typeof schema.groupMembers.$inferSelect;
export type GroupMemberInsert = Insertable<'groupMembers'>;
export type GroupMemberRole = typeof schema.groupMemberRoles.$inferSelect;
export type GroupMemberRoleInsert = typeof schema.groupMemberRoles.$inferInsert;
export type GroupNavSection = typeof schema.groupNavSections.$inferSelect;
export type GroupNavSectionInsert = typeof schema.groupNavSections.$inferInsert;
export type GroupNavSectionChannel =
  typeof schema.groupNavSectionChannels.$inferSelect;
export type GroupNavSectionChannelInsert =
  typeof schema.groupNavSectionChannels.$inferInsert;
export type Channel = typeof schema.channels.$inferSelect;
export type ChannelInsert = typeof schema.channels.$inferInsert;
export type ThreadUnreadState = typeof schema.threadUnreadStates.$inferSelect;
export type ThreadUnreadStateInsert =
  typeof schema.threadUnreadStates.$inferInsert;
export type Post = typeof schema.posts.$inferSelect;
export type PostInsert = typeof schema.posts.$inferInsert;
export type Reaction = typeof schema.reactions.$inferSelect;
export type ReactionInsert = typeof schema.reactions.$inferInsert;
export type Pin = typeof schema.pins.$inferSelect;
export type PinInsert = typeof schema.pins.$inferInsert;
