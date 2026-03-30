/**
 * API facade model types.
 *
 * These are the API-owned structural contracts used across package boundaries.
 * DB-layer models are expected to be assignable to these shapes.
 */

import type { ChannelContentConfiguration } from '../client/channelContentConfig';
import type { ExtendedEventType, NotificationLevel } from '../urbit';
import type {
  GroupMemberInvite,
  GroupJoinStatus,
  GroupPrivacy,
} from './groups';
import type { Post, ThreadUnreadState } from './post';

export type {
  ChatMember,
  ChatMemberGroupRole,
  ClientMeta,
  GroupFlaggedPosts,
  GroupJoinRequest,
  GroupJoinStatus,
  GroupMemberBan,
  GroupMemberInvite,
  GroupNavSection,
  GroupNavSectionChannel,
  GroupPrivacy,
  GroupRankBan,
  GroupRole,
} from './groups';
export type {
  Post,
  PostDeliveryStatus,
  PostFlags,
  PostImage,
  PostMetadata,
  PostType,
  Reaction,
  ReplyMeta,
  ThreadUnreadState,
} from './post';

export const SETTINGS_SINGLETON_KEY = 'settings' as const;
export const BASE_UNREADS_SINGLETON_KEY = 'base_unreads' as const;

export type ChannelType = 'chat' | 'notebook' | 'gallery' | 'dm' | 'groupDm';
export type UnreadChannelType = 'channel' | 'dm';
export type ActivityBucket = 'all' | 'mentions' | 'replies';
export type PinType = 'group' | 'channel' | 'dm' | 'groupDm';

export type AttestationType = 'phone' | 'node' | 'twitter' | 'dummy' | string;
export type AttestationDiscoverability =
  | 'public'
  | 'verified'
  | 'hidden'
  | string;
export type AttestationStatus = 'waiting' | 'pending' | 'verified' | string;

interface WithId {
  id: string;
}

export interface SystemContact extends WithId {
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  contactId?: string | null;
}

export interface Contact extends WithId {
  nickname?: string | null;
  avatarImage?: string | null;
  peerNickname?: string | null;
  customNickname?: string | null;
  peerAvatarImage?: string | null;
  customAvatarImage?: string | null;
  bio?: string | null;
  status?: string | null;
  color?: string | null;
  coverImage?: string | null;
  isBlocked?: boolean | null;
  isContact?: boolean | null;
  isContactSuggestion?: boolean | null;
  systemContactId?: string | null;
  pinnedGroups?: ContactPinnedGroups | null;
  attestations?: any[] | null;
}

export type ContactPinnedGroups = any[];

export interface ChannelUnread {
  channelId: string;
  type: UnreadChannelType;
  count: number;
  notify: boolean;
  countWithoutThreads: number;
  updatedAt: number;
  firstUnreadPostId?: string | null;
  firstUnreadPostReceivedAt?: number | null;
}

export interface GroupUnread {
  groupId: string;
  updatedAt: number;
  count?: number | null;
  notify?: boolean | null;
  notifyCount?: number | null;
}

export interface BaseUnread extends WithId {
  updatedAt: number;
  count?: number | null;
  notify?: boolean | null;
  notifyCount?: number | null;
  notifTimestamp?: string | null;
}

export interface ActivityEvent extends WithId {
  bucketId: ActivityBucket;
  sourceId: string;
  type: ExtendedEventType;
  timestamp: number;
  post?: Post | null;
  postId?: string | null;
  author?: Contact | null;
  authorId?: string | null;
  parent?: Post | null;
  parentId?: string | null;
  parentAuthor?: Contact | null;
  parentAuthorId?: string | null;
  channel?: Channel | null;
  channelId?: string | null;
  group?: Group | null;
  groupId?: string | null;
  isMention?: boolean | null;
  shouldNotify?: boolean | null;
  content?: unknown;
  groupEventUserId?: string | null;
  contactUserId?: string | null;
  contactUpdateType?: string | null;
  contactUpdateValue?: string | null;
  contactUpdateGroups?: any[] | null;
}
export type ActivityEventContactUpdateGroups = any[];

export interface Group extends WithId {
  title?: string | null;
  description?: string | null;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
  privacy?: GroupPrivacy | null;
  haveInvite?: boolean | null;
  haveRequestedInvite?: boolean | null;
  currentUserIsMember: boolean;
  currentUserIsHost: boolean;
  hostUserId: string;
  isNew?: boolean | null;
  isPersonalGroup?: boolean | null;
  joinStatus?: GroupJoinStatus | null;
  lastPostId?: string | null;
  lastPostAt?: number | null;
  syncedAt?: number | null;
  pendingMembersDismissedAt?: number | null;
  memberCount?: number | null;
  roles?: any[] | null;
  members?: any[] | null;
  navSections?: any[] | null;
  channels?: any[] | null;
  pin?: Pin | null;
  unread?: GroupUnread | null;
  volumeSettings?: VolumeSettings | null;
  flaggedPosts?: any[] | null;
  bannedMembers?: any[] | null;
  // Kept for tlon-skill compatibility, though current group hydration appears
  // to fold invited members into `members` with `status: 'invited'` instead.
  pendingMembers?: GroupMemberInvite[] | null;
  joinRequests?: any[] | null;
}

export interface Channel extends WithId {
  type: ChannelType;
  groupId?: string | null;
  title?: string | null;
  description?: string | null;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
  contactId?: string | null;
  addedToGroupAt?: number | null;
  currentUserIsMember?: boolean | null;
  currentUserIsHost?: boolean | null;
  postCount?: number | null;
  unreadCount?: number | null;
  firstUnreadPostId?: string | null;
  lastPostId?: string | null;
  lastPostAt?: number | null;
  lastPostSequenceNum?: number | null;
  isPendingChannel?: boolean | null;
  isNewMatchedContact?: boolean | null;
  isDmInvite?: boolean | null;
  syncedAt?: number | null;
  remoteUpdatedAt?: number | null;
  lastViewedAt?: number | null;
  contentConfiguration?: ChannelContentConfiguration | null;
  order?: string[] | null;
  members?: any[] | null;
  writerRoles?: Array<{ channelId: string; roleId: string }> | null;
  readerRoles?: Array<{ channelId: string; roleId: string }> | null;
  unread?: ChannelUnread | null;
  threadUnreads?: any[] | null;
  volumeSettings?: VolumeSettings | null;
  posts?: any[] | null;
}

export interface Pin {
  type: PinType;
  index: number;
  itemId: string;
}

export interface Settings {
  id?: string;
  theme?: string;
  disableAppTileUnreads?: boolean;
  disableAvatars?: boolean;
  disableRemoteContent?: boolean;
  disableSpellcheck?: boolean;
  disableNicknames?: boolean;
  orderedGroupPins?: string[] | null;
  sideBarSort?: 'alphabetical' | 'arranged' | 'recent' | null;
  groupSideBarSort?: unknown;
  showActivityMessage?: boolean;
  logActivity?: boolean;
  enableTelemetry?: boolean;
  analyticsId?: string | null;
  seenWelcomeCard?: boolean;
  newGroupFlags?: unknown;
  groupsNavState?: string | null;
  messagesNavState?: string | null;
  messagesFilter?: string | null;
  gallerySettings?: string | null;
  notebookSettings?: unknown;
  activitySeenTimestamp?: number | null;
  completedWayfindingSplash?: boolean;
  completedWayfindingTutorial?: boolean;
  disableTlonInfraEnhancement?: boolean;
}

export interface VolumeSettings {
  itemId: string;
  itemType: 'group' | 'channel' | 'thread' | 'base';
  level: NotificationLevel;
}

export interface Attestation extends WithId {
  [key: string]: unknown;
  contactId: string;
  provider: string;
  providerUrl?: string | null;
  type: AttestationType;
  discoverability: AttestationDiscoverability;
  status: AttestationStatus;
  value?: string | null;
  signature?: string | null;
  initiatedAt?: number | null;
  statusMessage?: string | null;
  provingTweetId?: string | null;
}

export interface ContactAttestation {
  contactId: string;
  attestationId: string;
  attestation?: Attestation | null;
}

export type Chat = {
  id: string;
  pin: Pin | null;
  volumeSettings: VolumeSettings | null;
  timestamp: number;
  isPending: boolean;
  unreadCount: number;
  [key: string]: unknown;
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

export function isSystemContact(contact: Contact | SystemContact): contact is SystemContact {
  const hasPhone = 'phoneNumber' in contact;
  const hasEmail = 'email' in contact;
  return hasPhone || hasEmail;
}

export type ActivityInit = {
  baseUnread?: BaseUnread;
  groupUnreads: GroupUnread[];
  channelUnreads: ChannelUnread[];
  threadActivity: ThreadUnreadState[];
};

export interface ChangesResult {
  groups: Group[];
  posts: Post[];
  contacts: Contact[];
  unreads: ActivityInit;
  deletedChannelIds: string[];
}

export interface PendingMemberDismissal {
  groupId: string;
  dismissedAt: number;
}

export type PendingMemberDismissals = PendingMemberDismissal[];

export type AppInfo = {
  groupsVersion: string;
  groupsHash: string;
  groupsSyncNode: string;
};
