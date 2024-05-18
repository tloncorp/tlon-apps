import * as db from '../db';
import type * as ub from '../urbit';
import { udToDate } from './apiUtils';
import { getCanonicalPostId } from './apiUtils';
import { scry, subscribe } from './urbit';

export const getChannelUnreads = async () => {
  const results = await scry<ub.Unreads>({
    app: 'channels',
    path: '/unreads',
  });
  return toClientUnreads(results, 'channel');
};

export const getDMUnreads = async () => {
  const results = await scry<ub.Unreads>({
    app: 'chat',
    path: '/unreads',
  });
  return toClientUnreads(results, 'dm');
};

export const subscribeChannelUnreads = (
  handler: (unread: db.Unread) => void
) => {
  subscribe<ub.UnreadUpdate>(
    { app: 'channels', path: '/unreads' },
    async (update) => {
      const unread = toClientUnread(update.nest, update.unread, 'channel');
      handler(unread);
    }
  );
};

export const subscribeDMUnreads = (handler: (unread: db.Unread) => void) => {
  subscribe<ub.DMUnreadUpdate>(
    { app: 'chat', path: '/unreads' },
    async (update) => {
      const unread = toClientUnread(update.whom, update.unread, 'dm');
      handler(unread);
    }
  );
};

export const subscribeUnreads = async (
  handler: (unread: db.Unread) => void,
  {
    type,
  }: {
    type?: 'dm' | 'channel';
  } = {}
) => {
  if (!type || type === 'dm') {
    subscribeDMUnreads(handler);
  }
  if (!type || type === 'channel') {
    subscribeChannelUnreads(handler);
  }
};

export const toClientUnreads = (
  unreads: ub.Unreads,
  type: db.Unread['type']
): db.Unread[] => {
  return Object.entries(unreads).map(([id, contact]) =>
    toClientUnread(id, contact, type)
  );
};

export const toClientUnread = (
  channelId: string,
  unread: ub.Unread,
  type: db.Unread['type']
): db.Unread & { threadUnreads: db.ThreadUnreadState[] } => {
  const firstUnreadPostId = unread.unread?.id
    ? getCanonicalPostId(unread.unread.id)
    : null;
  return {
    channelId,
    type,
    updatedAt: unread.recency,
    count: unread.count,
    countWithoutThreads: unread.unread?.count ?? 0,
    firstUnreadPostId,
    firstUnreadPostReceivedAt: firstUnreadPostId
      ? udToDate(firstUnreadPostId)
      : null,
    threadUnreads: Object.entries(unread.threads ?? {}).map(
      ([threadId, thread]) => {
        const firstUnreadPostId = thread.id
          ? getCanonicalPostId(thread.id)
          : null;
        return {
          channelId,
          threadId: getCanonicalPostId(threadId),
          count: thread.count,
          firstUnreadPostId,
          firstUnreadPostReceivedAt: firstUnreadPostId
            ? udToDate(firstUnreadPostId)
            : null,
        } as const;
      }
    ),
  };
};
