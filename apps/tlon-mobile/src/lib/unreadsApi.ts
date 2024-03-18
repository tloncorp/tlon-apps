import type { Unread, UnreadType } from '@tloncorp/shared';
import type * as ubChan from '@tloncorp/shared/dist/urbit/channel';
import type * as ubDM from '@tloncorp/shared/dist/urbit/dms';

import { scry, subscribe } from './api';

export const getChannelUnreads = async () => {
  const results = await scry<ubChan.Unreads>({
    app: 'channels',
    path: '/unreads',
  });
  return toClientUnreads(results, 'channel');
};

export const getDMUnreads = async () => {
  const results = await scry<ubChan.Unreads>({
    app: 'chat',
    path: '/unreads',
  });
  return toClientUnreads(results, 'dm');
};

export const subscribeChannelUnreads = (
  handler: (unread: Unread) => Promise<void>
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
  handler: (unread: Unread) => Promise<void>
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
  type: UnreadType
): Unread[] => {
  return Object.entries(unreads).map(([nest, contact]) =>
    toClientUnread(nest, contact, type)
  );
};

export const toClientUnread = (
  nestOrWhom: string,
  unread: ubChan.Unread,
  type: UnreadType
): Unread => {
  return {
    channelId: nestOrWhom,
    totalCount: unread.count,
    type,
  };
};
