import type { ClientTypes as Client } from "@tloncorp/shared";
import {
  subscribeChannelUnreads,
  subscribeDMUnreads,
} from "@tloncorp/shared/dist/api/unreadsApi";

export const subscribeUnreads = async () => {
  async function handleUnreadUpdate(unread: Client.Unread) {
    // db.create("Unread", unread, db.UpdateMode.All);
    console.log(`Updated an unread for ${unread.channelId}`);
  }

  subscribeChannelUnreads(handleUnreadUpdate);
  subscribeDMUnreads(handleUnreadUpdate);
};
