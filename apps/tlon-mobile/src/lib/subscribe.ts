import type { Unread } from '@tloncorp/shared';

import * as db from '../db';
import { subscribeChannelUnreads, subscribeDMUnreads } from './unreadsApi';

export const subscribeUnreads = async () => {
  async function handleUnreadUpdate(unread: Unread) {
    db.create('Unread', unread, db.UpdateMode.All);
    console.log(`Updated an unread for ${unread.channelId}`);
  }

  subscribeChannelUnreads(handleUnreadUpdate);
  subscribeDMUnreads(handleUnreadUpdate);
};
