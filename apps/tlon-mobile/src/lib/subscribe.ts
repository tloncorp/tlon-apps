import {
  subscribeChannelUnreads,
  subscribeDMUnreads,
} from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';

export const subscribeUnreads = async () => {
  async function handleUnreadUpdate(unread: db.Unread) {
    await db.insertUnreads([unread]);
    console.log(`Updated an unread for ${unread.channelId}`);
  }

  subscribeChannelUnreads(handleUnreadUpdate);
  subscribeDMUnreads(handleUnreadUpdate);
};
