import * as db from '../db';
import { threadUnreads } from '../db/schema';
import type * as ub from '../urbit';
import { udToDate } from './converters';
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
): (db.Unread & { threadUnreads: db.ThreadUnreadState[] })[] => {
  return Object.entries(unreads).map(([id, contact]) =>
    toClientUnread(id, contact, type)
  );
};

export const toClientUnread = (
  channelId: string,
  unread: ub.Unread,
  type: db.Unread['type']
): db.Unread & { threadUnreads: db.ThreadUnreadState[] } => {
  return {
    channelId,
    type,
    updatedAt: unread.recency,
    count: unread.count,
    countWithoutThreads: unread.unread?.count ?? 0,
    firstUnreadPostId: unread.unread?.id ?? null,
    firstUnreadPostReceivedAt: unread.unread?.id
      ? udToDate(unread.unread?.id)
      : null,
    threadUnreads: Object.entries(unread.threads ?? {}).map(
      ([threadId, thread]) =>
        ({
          channelId,
          threadId,
          count: thread.count,
          firstUnreadPostId: thread.id ?? null,
          firstUnreadPostReceivedAt: thread.id ? udToDate(thread.id) : null,
        }) as const
    ),
  };
};
