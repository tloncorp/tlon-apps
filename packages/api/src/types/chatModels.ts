import type { NotificationLevel } from '../urbit';
import type {
  AttestationDiscoverability,
  AttestationStatus,
  AttestationType,
  ChannelType,
  GroupJoinStatus,
  GroupPrivacy,
  PinType,
  PostDeliveryStatus,
  PostType,
} from './commonModels';

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
