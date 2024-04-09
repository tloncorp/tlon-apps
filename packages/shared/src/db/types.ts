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
export type TableName = keyof SchemaWithRelations;
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
      ? Insertable<SchemaFromDbTableName<TTableName>['tsName']>[] | null
      : never
    : TableRelations<T>[K] extends One<infer TTableName>
      ? TTableName extends DbTableNames
        ? Insertable<SchemaFromDbTableName<TTableName>['tsName']> | null
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
export type UnreadInsert = Insertable<'unreads'>;
export type GroupsTable = typeof schema.groups;
export type Group = typeof schema.groups.$inferSelect;

export type GroupSummary = Group & {
  unreadCount?: number | null;
  lastPost?: Post | null;
};

export type GroupWithRelations = Group & {
  members: GroupMember[];
  roles: GroupRole[];
  channels: ChannelWithLastPost[];
  navSections: GroupNavSectionWithRelations[];
};
export type GroupWithMembersAndRoles = Group & {
  members: GroupMember[];
  roles: GroupRole[];
};
export type GroupInsert = Insertable<'groups'>;
export type GroupRole = typeof schema.groupRoles.$inferSelect;
export type GroupRoleInsert = typeof schema.groupRoles.$inferInsert;
export type GroupMember = typeof schema.groupMembers.$inferSelect;
export type GroupMemberInsert = Insertable<'groupMembers'>;
export type GroupMemberRole = typeof schema.groupMemberRoles.$inferSelect;
export type GroupMemberRoleInsert = typeof schema.groupMemberRoles.$inferInsert;
export type GroupNavSection = typeof schema.groupNavSections.$inferSelect;
export type GroupNavSectionInsert = typeof schema.groupNavSections.$inferInsert;
export type GroupNavSectionWithRelations = GroupNavSection & {
  channels: GroupNavSectionChannel[];
};
export type GroupNavSectionChannel =
  typeof schema.groupNavSectionChannels.$inferSelect;
export type GroupNavSectionChannelInsert =
  typeof schema.groupNavSectionChannels.$inferInsert;
export type Channel = typeof schema.channels.$inferSelect;
export type ChannelWithRelations = Channel & {
  group: GroupWithRelations;
  posts: Post[];
  lastPost: Post | null;
  threadUnreadStates: ThreadUnreadState[];
};
export type ChannelMember = typeof schema.channelMembers.$inferSelect;
export type ChannelWithGroup = Channel & { group: GroupWithMembersAndRoles };
export type ChannelWithLastPost = Channel & {
  lastPost: Post | null;
};
export type ChannelInsert = Insertable<'channels'>;
export type ThreadUnreadState = typeof schema.threadUnreadStates.$inferSelect;
export type ThreadUnreadStateInsert =
  typeof schema.threadUnreadStates.$inferInsert;
export type Post = typeof schema.posts.$inferSelect;
export type PostWithRelations = Post & {
  reactions: Reaction[] | null;
  author: Contact | null;
};

export type PostInsertWithAuthor = PostInsert & {
  author: Contact | null;
};

export type PostType = Post['type'];
export type PostFlags = Pick<
  Post,
  | 'hasAppReference'
  | 'hasGroupReference'
  | 'hasChannelReference'
  | 'hasImage'
  | 'hasLink'
>;
export type PostMetadata = Partial<Pick<Post, 'title' | 'image'>>;
export type PostInsert = Insertable<'posts'>;
export type PostImage = typeof schema.postImages.$inferSelect;
export type PostReaction = typeof schema.postReactions.$inferSelect;
export type Reaction = typeof schema.postReactions.$inferSelect;
export type ReactionInsert = typeof schema.postReactions.$inferInsert;
export type Pin = typeof schema.pins.$inferSelect;
export type PinInsert = typeof schema.pins.$inferInsert;
