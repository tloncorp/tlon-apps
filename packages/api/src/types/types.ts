import type { ExtendedEventType, NotificationLevel } from '../urbit';

// Standalone type definitions - no Drizzle dependency

export type ChannelType = 'chat' | 'notebook' | 'gallery' | 'dm' | 'groupDm';
export type PostDeliveryStatus =
  | 'enqueued'
  | 'pending'
  | 'sent'
  | 'failed'
  | 'needs_verification';
export type PinType = 'group' | 'channel' | 'dm' | 'groupDm';
export type GroupPrivacy = 'public' | 'private' | 'secret';
export type GroupJoinStatus = 'joining' | 'errored';
export type ActivityBucket = 'all' | 'mentions' | 'replies';
export type AttestationType = 'phone' | 'node' | 'twitter' | 'dummy';
export type AttestationDiscoverability = 'public' | 'verified' | 'hidden';
export type AttestationStatus = 'waiting' | 'pending' | 'verified';

export interface Contact {
  id: string;
  peerNickname?: string | null;
  customNickname?: string | null;
  nickname?: string | null;
  peerAvatarImage?: string | null;
  customAvatarImage?: string | null;
  avatarImage?: string | null;
  bio?: string | null;
  status?: string | null;
  color?: string | null;
  coverImage?: string | null;
  isBlocked?: boolean | null;
  isContact?: boolean | null;
  isContactSuggestion?: boolean | null;
  pinnedGroups?: ContactPinnedGroup[] | null;
  attestations?: ContactAttestation[] | null;
}

export interface ContactPinnedGroup {
  contactId: string;
  groupId: string;
}

export interface Group {
  id: string;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
  title?: string | null;
  description?: string | null;
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
  channels?: Channel[] | null;
  flaggedPosts?: GroupFlaggedPosts[] | null;
  navSections?: GroupNavSection[] | null;
  roles?: GroupRole[] | null;
  members?: ChatMember[] | null;
  bannedMembers?: GroupMemberBan[] | null;
  pendingMembers?: GroupMemberInvite[] | null;
  joinRequests?: GroupJoinRequest[] | null;
  bannedRanks?: GroupRankBan[] | null;
}

export interface Channel {
  id: string;
  type: ChannelType;
  groupId?: string | null;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
  title?: string | null;
  description?: string | null;
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
  contentConfiguration?: any | null;
  order?: string[] | null;
  members?: ChatMember[] | null;
  readerRoles?: ChannelReader[] | null;
  writerRoles?: ChannelWriter[] | null;
}

export interface ChannelReader {
  channelId: string;
  roleId: string;
}

export interface ChannelWriter {
  channelId: string;
  roleId: string;
}

export type PostType = 'block' | 'chat' | 'notice' | 'note' | 'reply' | 'delete';

export interface Post {
  id: string;
  authorId: string;
  channelId: string;
  groupId?: string | null;
  parentId?: string | null;
  type: PostType;
  title?: string | null;
  image?: string | null;
  description?: string | null;
  cover?: string | null;
  content?: any | null;
  receivedAt: number;
  sentAt: number;
  replyCount?: number | null;
  replyTime?: number | null;
  replyContactIds?: string[] | null;
  textContent?: string | null;
  hasAppReference?: boolean | null;
  hasChannelReference?: boolean | null;
  hasGroupReference?: boolean | null;
  hasLink?: boolean | null;
  hasImage?: boolean | null;
  hidden?: boolean | null;
  isEdited?: boolean | null;
  isDeleted?: boolean | null;
  isSequenceStub?: boolean | null;
  deletedAt?: number | null;
  deliveryStatus?: PostDeliveryStatus | null;
  editStatus?: PostDeliveryStatus | null;
  deleteStatus?: PostDeliveryStatus | null;
  lastEditContent?: any | null;
  lastEditTitle?: string | null;
  lastEditImage?: string | null;
  sequenceNum?: number | null;
  syncedAt?: number | null;
  backendTime?: string | null;
  blob?: string | null;
  draft?: any | null;
  images?: PostImage[] | null;
  reactions?: Reaction[] | null;
  replies?: Post[] | null;
  author?: Contact | null;
}

export interface PostFlags {
  hasAppReference?: boolean | null;
  hasChannelReference?: boolean | null;
  hasGroupReference?: boolean | null;
  hasImage?: boolean | null;
  hasLink?: boolean | null;
}

export interface PostMetadata {
  title?: string | null;
  image?: string | null;
  description?: string | null;
  cover?: string | null;
}

export interface ReplyMeta {
  replyCount: number;
  replyTime: number | null;
  replyContactIds: string[];
}

export interface Reaction {
  contactId: string;
  postId: string;
  value: string;
}

export interface Pin {
  type: PinType;
  index: number;
  itemId: string;
}

export interface ChannelUnread {
  channelId: string;
  type: 'channel' | 'dm';
  notify: boolean;
  count: number;
  countWithoutThreads: number;
  updatedAt: number;
  firstUnreadPostId?: string | null;
  firstUnreadPostReceivedAt?: number | null;
}

export interface ThreadUnreadState {
  channelId?: string | null;
  threadId?: string | null;
  notify?: boolean | null;
  count?: number | null;
  updatedAt: number;
  firstUnreadPostId?: string | null;
  firstUnreadPostReceivedAt?: number | null;
}

export interface GroupUnread {
  groupId: string;
  notify?: boolean | null;
  count?: number | null;
  notifyCount?: number | null;
  updatedAt: number;
}

export interface BaseUnread {
  id: string;
  notify?: boolean | null;
  count?: number | null;
  notifyCount?: number | null;
  updatedAt: number;
  notifTimestamp?: string | null;
}

export interface ActivityEvent {
  id: string;
  bucketId: ActivityBucket;
  sourceId: string;
  type: ExtendedEventType;
  timestamp: number;
  postId?: string | null;
  authorId?: string | null;
  parentId?: string | null;
  parentAuthorId?: string | null;
  channelId?: string | null;
  groupId?: string | null;
  isMention?: boolean | null;
  shouldNotify?: boolean | null;
  content?: any | null;
  groupEventUserId?: string | null;
  contactUserId?: string | null;
  contactUpdateType?: string | null;
  contactUpdateValue?: string | null;
  contactUpdateGroups?: { groupId: string; activityEventId: string }[] | null;
}

export interface Settings {
  id: string;
  theme?: string | null;
  disableAppTileUnreads?: boolean | null;
  disableAvatars?: boolean | null;
  disableRemoteContent?: boolean | null;
  disableSpellcheck?: boolean | null;
  disableNicknames?: boolean | null;
  orderedGroupPins?: any | null;
  sideBarSort?: 'alphabetical' | 'arranged' | 'recent' | null;
  groupSideBarSort?: any | null;
  showActivityMessage?: boolean | null;
  logActivity?: boolean | null;
  enableTelemetry?: boolean | null;
  analyticsId?: string | null;
  seenWelcomeCard?: boolean | null;
  newGroupFlags?: any | null;
  groupsNavState?: string | null;
  messagesNavState?: string | null;
  messagesFilter?: string | null;
  gallerySettings?: string | null;
  notebookSettings?: any | null;
  activitySeenTimestamp?: number | null;
  completedWayfindingSplash?: boolean | null;
  completedWayfindingTutorial?: boolean | null;
  disableTlonInfraEnhancement?: boolean | null;
}

export interface ChatMember {
  membershipType: 'group' | 'channel';
  chatId?: string | null;
  contactId: string;
  joinedAt?: number | null;
  status?: 'invited' | 'joined' | null;
  contact?: Contact | null;
  roles?: ChatMemberGroupRole[] | null;
}

export interface GroupRole {
  id: string;
  groupId?: string | null;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface ChatMemberGroupRole {
  groupId: string;
  contactId: string;
  roleId: string;
}

export interface GroupNavSection {
  id: string;
  sectionId: string;
  groupId?: string | null;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
  title?: string | null;
  description?: string | null;
  sectionIndex?: number | null;
  channels?: GroupNavSectionChannel[] | null;
}

export interface GroupNavSectionChannel {
  groupNavSectionId?: string | null;
  channelId?: string | null;
  channelIndex?: number | null;
}

export interface GroupMemberInvite {
  groupId: string;
  contactId: string;
  invitedAt?: number | null;
}

export interface GroupMemberBan {
  groupId: string;
  contactId: string;
  bannedAt?: number | null;
}

export interface GroupJoinRequest {
  groupId: string;
  contactId: string;
  requestedAt?: number | null;
}

export interface GroupRankBan {
  groupId: string;
  rankId: string;
  bannedAt?: number | null;
}

export interface GroupFlaggedPosts {
  groupId: string;
  postId: string;
  channelId: string;
  flaggedByContactId: string;
  flaggedAt?: number | null;
}

export interface VolumeSettings {
  itemId: string;
  itemType: 'group' | 'channel' | 'thread' | 'base';
  level: NotificationLevel;
}

export interface PostImage {
  postId?: string | null;
  src?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface Attestation {
  id: string;
  provider: string;
  type: AttestationType;
  value?: string | null;
  initiatedAt?: number | null;
  discoverability: AttestationDiscoverability;
  status: AttestationStatus;
  statusMessage?: string | null;
  contactId: string;
  providerUrl?: string | null;
  provingTweetId?: string | null;
  signature?: string | null;
}

export interface ContactAttestation {
  contactId: string;
  attestationId: string;
  attestation?: Attestation | null;
}

export interface SystemContact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  contactId?: string | null;
}

export interface SystemContactSentInvite {
  invitedTo?: string | null;
  systemContactId?: string | null;
  invitedAt?: number | null;
}

export interface ActivityInit {
  baseUnread?: BaseUnread;
  groupUnreads: GroupUnread[];
  channelUnreads: ChannelUnread[];
  threadActivity: ThreadUnreadState[];
}

export interface ClientMeta {
  title?: string | null;
  coverImage?: string | null;
  iconImage?: string | null;
  description?: string | null;
  coverImageColor?: string | null;
  iconImageColor?: string | null;
}

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

// Constants
export const SETTINGS_SINGLETON_KEY = 'settings';
export const BASE_UNREADS_SINGLETON_KEY = 'base_unreads';

// Chat type (union of group and channel chats)
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

export interface AppInfo {
  groupsVersion: string;
  groupsHash: string;
  groupsSyncNode: string;
}
