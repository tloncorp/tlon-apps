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

export type SystemContact = BaseModel<'systemContacts'>;
export type SystemContactSentInvite = BaseModel<'systemContactSentInvites'>;
export type Contact = BaseModel<'contacts'> & {
  nickname?: string | null;
  avatarImage?: string | null;
};
export type ContactPinnedGroups = Contact['pinnedGroups'];
export type ChannelUnread = BaseModel<'channelUnreads'>;
export type GroupUnread = BaseModel<'groupUnreads'>;
export type BaseUnread = BaseModel<'baseUnreads'>;
export type ActivityEvent = BaseModel<'activityEvents'>;
export type ActivityEventContactUpdateGroups =
  ActivityEvent['contactUpdateGroups'];
export type ActivityBucket = schema.ActivityBucket;
export type Group = BaseModel<'groups'>;

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
export type GroupJoinRequest = BaseModel<'groupJoinRequests'>;
export type GroupRankBan = BaseModel<'groupRankBans'>;
export type GroupFlaggedPosts = BaseModel<'groupFlaggedPosts'>;
type BaseChatMember = BaseModel<'chatMembers'>;
export interface ChatMember extends BaseChatMember {
  contact?: Contact | null;
}
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
export type PostMetadata = Pick<
  Post,
  'title' | 'image' | 'description' | 'cover'
>;
export type ReplyMeta = {
  replyCount: number;
  replyTime: number | null;
  replyContactIds: string[];
};
export type PostImage = BaseModel<'postImages'>;
export type PostDeliveryStatus = schema.PostDeliveryStatus;
export type Reaction = BaseModel<'postReactions'>;
export type Pin = BaseModel<'pins'>;
export type PinType = schema.PinType;
export type Settings = BaseModel<'settings'>;
export type PostWindow = BaseModel<'postWindows'>;
export type VolumeSettings = BaseModel<'volumeSettings'>;
export type Attestation = BaseModel<'attestations'>;
export type AttestationStatus = schema.AttestationStatus;
export type AttestationDiscoverability = schema.AttestationDiscoverability;
export type AttestationType = schema.AttestationType;
export type ContactAttestation = BaseModel<'contactAttestations'>;

export type Chat = {
  id: string;
  pin: Pin | null;
  volumeSettings: VolumeSettings | null;
  timestamp: number;
  isPending: boolean;
  unreadCount: number;
} & ({ type: 'group'; group: Group } | { type: 'channel'; channel: Channel });

export interface GroupedChats {
  pinned: Chat[];
  unpinned: Chat[];
  pending: Chat[];
}

export interface GroupEvent extends ActivityEvent {
  type: 'group-ask';
  group: Group;
  groupId: string;
  groupEventUserId: string;
  groupEventUser: Contact;
}

export function isGroupEvent(event: ActivityEvent): event is GroupEvent {
  return Boolean(
    event.type === 'group-ask' && event.groupEventUserId && event.groupId
  );
}

export function isSystemContact(
  contact: Contact | SystemContact
): contact is SystemContact {
  const hasPhone = 'phoneNumber' in contact;
  const hasEmail = 'email' in contact;
  return hasPhone || hasEmail;
}
