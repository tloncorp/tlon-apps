import type * as ubChan from '@tloncorp/shared/dist/urbit/channel';
import type * as ubDM from '@tloncorp/shared/dist/urbit/dms';

import type * as db from '../db';
import { subscribe } from './api';

export const subscribeChannelUnreads = (
  handler: (unread: db.Unread) => Promise<void>
) => {
  subscribe<ubChan.UnreadUpdate>(
    { app: 'channels', path: '/unreads' },
    async (update) => {
      const unread = toClientUnread(update.nest, update.unread, 'channel');
      handler(unread);
    }
  );
};

export const subscribeDMUnreads = (
  handler: (unread: db.Unread) => Promise<void>
) => {
  subscribe<ubDM.DMUnreadUpdate>(
    { app: 'chat', path: '/unreads' },
    async (update) => {
      const unread = toClientUnread(update.whom, update.unread, 'dm');
      handler(unread);
    }
  );
};

export const toClientUnreads = (
  unreads: ubChan.Unreads,
  type: db.UnreadType
): db.Unread[] => {
  return Object.entries(unreads).map(([nest, contact]) =>
    toClientUnread(nest, contact, type)
  );
};

export const toClientUnread = (
  nestOrWhom: string,
  unread: ubChan.Unread,
  type: db.UnreadType
): db.Unread => {
  return {
    channelId: nestOrWhom,
    totalCount: unread.count,
    type,
  };
};
