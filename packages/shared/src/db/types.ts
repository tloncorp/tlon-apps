import type { ExtractTablesWithRelations } from 'drizzle-orm';

import type * as api from '@tloncorp/api/types/types';
import {
  BASE_UNREADS_SINGLETON_KEY,
  SETTINGS_SINGLETON_KEY,
  isGroupEvent,
  isSystemContact,
} from '@tloncorp/api/types/types';
import * as schema from './schema';

export type Schema = typeof schema;
export type SchemaWithRelations = ExtractTablesWithRelations<Schema>;
export type TableName = keyof SchemaWithRelations;

export { BASE_UNREADS_SINGLETON_KEY, SETTINGS_SINGLETON_KEY };
export { isGroupEvent, isSystemContact };

export type SystemContact = api.SystemContact;
export type SystemContactSentInvite = api.SystemContactSentInvite;

export interface Contact extends api.Contact {
  pinnedGroups?: ContactPinnedGroup[] | null;
  systemContact?: SystemContact | null;
  attestations?: ContactAttestation[] | null;
}

export interface ContactPinnedGroup extends api.ContactPinnedGroup {
  group?: Group | null;
  contact?: Contact | null;
}

export interface ChannelUnread extends api.ChannelUnread {
  channel?: Channel | null;
  threadUnreads?: ThreadUnreadState[] | null;
}

export interface GroupUnread extends api.GroupUnread {
  group?: Group | null;
}

export type BaseUnread = api.BaseUnread;

export interface ActivityEventContactUpdateGroup {
  groupId: string;
  activityEventId: string;
  group?: Group | null;
}

export type ActivityEventContactUpdateGroups =
  ActivityEventContactUpdateGroup[];

export interface ActivityEvent
  extends Omit<api.ActivityEvent, 'contactUpdateGroups'> {
  post?: Post | null;
  author?: Contact | null;
  parent?: Post | null;
  parentAuthor?: Contact | null;
  channel?: Channel | null;
  group?: Group | null;
  groupEventUser?: Contact | null;
  contactUpdateGroups?: ActivityEventContactUpdateGroups | null;
}

export type ActivityBucket = api.ActivityBucket;

export interface Group extends api.Group {
  unread?: GroupUnread | null;
  pin?: Pin | null;
  lastPost?: Post | null;
  channels?: Channel[] | null;
  navSections?: GroupNavSection[] | null;
  roles?: GroupRole[] | null;
  members?: ChatMember[] | null;
}

export type ClientMeta = api.ClientMeta;
export type GroupMemberInvite = api.GroupMemberInvite;
export type GroupMemberBan = api.GroupMemberBan;
export type GroupJoinRequest = api.GroupJoinRequest;
export type GroupRankBan = api.GroupRankBan;
export type GroupFlaggedPosts = api.GroupFlaggedPosts;

type BaseChatMember = api.ChatMember;
export interface ChatMember extends BaseChatMember {
  contact?: Contact | null;
}

export interface GroupRole extends api.GroupRole {
  members?: ChatMemberGroupRole[] | null;
}
export type ChatMemberGroupRole = api.ChatMemberGroupRole;
export type GroupNavSection = api.GroupNavSection;
export type GroupNavSectionChannel = api.GroupNavSectionChannel;

export interface Channel extends api.Channel {
  group?: Group | null;
  contact?: Contact | null;
  unread?: ChannelUnread | null;
  threadUnreads?: ThreadUnreadState[] | null;
  pin?: Pin | null;
  lastPost?: Post | null;
  volumeSettings?: VolumeSettings | null;
  members?: ChatMember[] | null;
  readerRoles?: ChannelReader[] | null;
  writerRoles?: ChannelWriter[] | null;
  posts?: Post[] | null;
}

export type ChannelReader = api.ChannelReader;
export type ChannelWriter = api.ChannelWriter;
export type ChannelType = api.ChannelType;
export type ThreadUnreadState = api.ThreadUnreadState;

export interface Post extends api.Post {
  channel?: Channel | null;
  group?: Group | null;
  author?: Contact | null;
  parent?: Post | null;
  replies?: Post[] | null;
  reactions?: Reaction[] | null;
  images?: PostImage[] | null;
}

export type PostType = api.PostType;
export type PostFlags = api.PostFlags;
export type PostMetadata = api.PostMetadata;
export type ReplyMeta = api.ReplyMeta;
export type PostImage = api.PostImage;
export type PostDeliveryStatus = api.PostDeliveryStatus;
export type Reaction = api.Reaction;
export type Pin = api.Pin;
export type PinType = api.PinType;
export type Settings = api.Settings;
export type VolumeSettings = api.VolumeSettings;
export type Attestation = api.Attestation;
export type AttestationStatus = api.AttestationStatus;
export type AttestationDiscoverability = api.AttestationDiscoverability;
export type AttestationType = api.AttestationType;
export type ContactAttestation = api.ContactAttestation;
export type Chat = {
  id: string;
  pin: Pin | null;
  volumeSettings: VolumeSettings | null;
  timestamp: number;
  isPending: boolean;
  unreadCount: number;
} & ({ type: 'group'; group: Group } | { type: 'channel'; channel: Channel });
export type GroupedChats = api.GroupedChats;
export type GroupEvent = api.GroupEvent;
export type ActivityInit = api.ActivityInit;
export type ChangesResult = api.ChangesResult;
export type PendingMemberDismissal = api.PendingMemberDismissal;
export type PendingMemberDismissals = api.PendingMemberDismissals;
export type AppInfo = api.AppInfo;
export type ContactPinnedGroups = Contact['pinnedGroups'];
