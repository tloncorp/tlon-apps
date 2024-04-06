import * as db from '../db';
import type * as ub from '../urbit';
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
  return Object.entries(unreads).map(([nest, contact]) =>
    toClientUnread(nest, contact, type)
  );
};

export const toClientUnread = (
  nestOrWhom: string,
  unread: ub.Unread,
  type: db.Unread['type']
): db.Unread => {
  return {
    updatedAt: unread.recency,
    channelId: nestOrWhom,
    totalCount: unread.count,
    type,
  };
};
