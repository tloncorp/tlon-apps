import type { ClientTypes as Client } from '../client';
import type * as ubChan from '../urbit/channel';
import type * as ubDM from '../urbit/dms';
import { scry, subscribe } from './urbit';

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
  handler: (unread: Client.Unread) => Promise<void>
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
  handler: (unread: Client.Unread) => Promise<void>
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
  type: Client.UnreadType
): Client.Unread[] => {
  return Object.entries(unreads).map(([nest, contact]) =>
    toClientUnread(nest, contact, type)
  );
};

export const toClientUnread = (
  nestOrWhom: string,
  unread: ubChan.Unread,
  type: Client.UnreadType
): Client.Unread => {
  return {
    channelId: nestOrWhom,
    totalCount: unread.count,
    type,
  };
};
