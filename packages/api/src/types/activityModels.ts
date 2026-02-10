import type { ExtendedEventType } from '../urbit';
import type { ActivityBucket } from './commonModels';

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

export interface ActivityInit {
  baseUnread?: BaseUnread;
  groupUnreads: GroupUnread[];
  channelUnreads: ChannelUnread[];
  threadActivity: ThreadUnreadState[];
}
