import type * as client from '../client';
import { subscribeChannelUnreads, subscribeDMUnreads } from './unreadsApi';

export const subscribeUnreads = async () => {
  // TODO: Allow caller to pass in a handler
  async function handleUnreadUpdate(unread: client.Unread) {
    console.log(`new unread for ${unread.channelId}`);
  }

  subscribeChannelUnreads(handleUnreadUpdate);
  subscribeDMUnreads(handleUnreadUpdate);
};
