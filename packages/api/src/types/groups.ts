export interface GroupMeta {
  title: string;
  description: string;
  image: string;
  cover: string;
}

export type GroupJoinStatus = 'joining' | 'errored';
export type GroupPrivacy = 'public' | 'private' | 'secret';

export interface ClientMeta {
  title?: string | null;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
  description?: string | null;
}

export interface GroupMemberInvite {
  groupId: string;
  contactId: string;
  invitedBy: string;
}

export interface GroupMemberBan {
  contactId: string;
  groupId: string;
}

export interface GroupJoinRequest {
  contactId: string;
  groupId: string;
  requestedAt?: number | null;
}

export interface GroupRankBan {
  rankId: string;
  groupId: string;
}

export interface GroupFlaggedPosts {
  groupId: string;
  channelId: string;
  postId: string;
  flaggedByContactId: string;
}

export interface GroupRole {
  id: string;
  groupId?: string | null;
  title?: string | null;
  description?: string | null;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
}

export interface ChatMemberGroupRole {
  groupId: string;
  contactId: string;
  roleId: string;
}

export interface ChatMember {
  chatId: string | null;
  contactId: string;
  membershipType: 'group' | 'channel';
  status?: 'invited' | 'joined' | null;
  joinedAt?: number | null;
  roles?: any[] | null;
  contact?: any;
}

export interface GroupNavSection {
  id: string;
  groupId?: string | null;
  sectionId: string;
  sectionIndex?: number | null;
  title?: string | null;
  description?: string | null;
  iconImage?: string | null;
  iconImageColor?: string | null;
  coverImage?: string | null;
  coverImageColor?: string | null;
  channels?: GroupNavSectionChannel[] | null;
}

export interface GroupNavSectionChannel {
  groupNavSectionId?: string | null;
  channelId?: string | null;
  channelIndex?: number | null;
}
