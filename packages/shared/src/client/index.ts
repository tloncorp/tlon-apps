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

export type UnreadType = 'channel' | 'dm';
export type Unread = {
  channelId: string;
  type: UnreadType;
  totalCount: number;
};

export type Group = {
  id: string;
  roles?: GroupRole[];
  navSections?: GroupNavSection[];
  members?: GroupMember[];
  iconImage?: string;
  iconImageColor?: string;
  title?: string;
  coverImage?: string;
  coverColor?: string;
  description?: string;
  isSecret: boolean;
  isPreview?: boolean;
  lastPostAt?: number | null;

  // Linked objects
  channels?: Channel[];
};

export type GroupMember = {
  id: string;
  roles: string[];
  joinedAt: number;
};

export type GroupRole = {
  name: string;
  image?: string;
  title?: string;
  cover?: string;
  description?: string;
};

export type GroupNavSection = {
  id: string;
  channelIds?: string[];
  image?: string;
  title?: string;
  cover?: string;
  description?: string;
};

export type Channel = {
  id: string;
  group?: Group;
  image?: string;
  title?: string;
  cover?: string;
  description?: string;
  addedToGroupAt?: number;
  currentUserIsMember?: boolean;
  postCount?: number;
  unreadCount?: number;
  firstUnreadPostId?: string;
  unreadThreads?: ThreadUnreadState[];
  lastPostAt?: number;
};

export type Post = {
  id: string;
  author: Contact;
  title?: string;
  image?: string;
  content: string;
  sentAt: string;
  replyCount: number;
  type: 'chat' | 'heap' | 'diary';

  channel: Channel;
  group: Group;
};

export type ThreadUnreadState = {
  threadId: string;
  firstUnreadId?: string;
  count: number;
};
