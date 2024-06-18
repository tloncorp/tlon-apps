import type {
  ExtractTablesWithRelations,
  InferModelFromColumns,
  Many,
  One,
} from 'drizzle-orm';

import * as schema from './schema';

export type Schema = typeof schema;
export type SchemaWithRelations = ExtractTablesWithRelations<Schema>;
export type TableName = keyof SchemaWithRelations;
type TableSchema = SchemaWithRelations[keyof SchemaWithRelations];

type SchemaFromDbTableName<T> = Extract<
  SchemaWithRelations[keyof SchemaWithRelations],
  { dbName: T }
>;

type RelationTableName<T> = T extends Many<infer V> | One<infer V>
  ? SchemaFromDbTableName<V>['tsName']
  : never;

type BaseModelRelations<T extends TableSchema> = {
  [K in keyof T['relations']]?: T['relations'][K] extends Many<string>
    ? BaseModel<RelationTableName<T['relations'][K]>>[] | null
    : BaseModel<RelationTableName<T['relations'][K]>> | null;
};

type BaseModel<T extends TableName> = InferModelFromColumns<
  SchemaWithRelations[T]['columns'],
  'insert'
> &
  BaseModelRelations<SchemaWithRelations[T]>;

export type Contact = BaseModel<'contacts'>;
export type ContactPinnedGroups = Contact['pinnedGroups'];
export type ChannelUnread = BaseModel<'channelUnreads'>;
export type GroupUnread = BaseModel<'groupUnreads'>;
export type ActivityEvent = BaseModel<'activityEvents'>;
export type ActivityBucket = schema.ActivityBucket;
// TODO: We need to include unread count here because it's  returned by the chat
// list query, but doesn't feel great.
export type Group = BaseModel<'groups'> & {
  unreadCount?: number | null;
  lastChannel?: string | null;
};
export type ClientMeta = Pick<
  Group,
  | 'title'
  | 'coverImage'
  | 'iconImage'
  | 'description'
  | 'coverImageColor'
  | 'iconImageColor'
>;
export type GroupMemberInvite = BaseModel<'groupMemberInvites'>;
export type GroupMemberBan = BaseModel<'groupMemberBans'>;
export type GroupRankBan = BaseModel<'groupRankBans'>;
export type GroupFlaggedPosts = BaseModel<'groupFlaggedPosts'>;
export type ChatMember = BaseModel<'chatMembers'>;
export type GroupRole = BaseModel<'groupRoles'>;
export type ChatMemberGroupRole = BaseModel<'chatMemberGroupRoles'>;
export type GroupNavSection = BaseModel<'groupNavSections'>;
export type GroupNavSectionChannel = BaseModel<'groupNavSectionChannels'>;
export type Channel = BaseModel<'channels'>;
export type ChannelType = schema.ChannelType;
export type ThreadUnreadState = BaseModel<'threadUnreads'>;
export type Post = BaseModel<'posts'>;
export type PostType = Post['type'];
export type PostFlags = Pick<
  Post,
  | 'hasAppReference'
  | 'hasGroupReference'
  | 'hasChannelReference'
  | 'hasImage'
  | 'hasLink'
>;
export type PostMetadata = Pick<Post, 'title' | 'image'>;
export type PostImage = BaseModel<'postImages'>;
export type PostDeliveryStatus = schema.PostDeliveryStatus;
export type Reaction = BaseModel<'postReactions'>;
export type Pin = BaseModel<'pins'>;
export type PinType = schema.PinType;
export type Settings = BaseModel<'settings'>;
export type PostWindow = BaseModel<'postWindows'>;
export type VolumeSettings = BaseModel<'volumeSettings'>;
