import type { ActivityEvent, ActivityInit } from './activityModels';
import type { Contact, Group, Post } from './chatModels';
import type { SystemContact } from './systemContactModels';

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

export interface AppInfo {
  groupsVersion: string;
  groupsHash: string;
  groupsSyncNode: string;
}

export type SystemContactLike = Contact | SystemContact;
