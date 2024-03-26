import type { ClientTypes as Client } from "../client";
import { subscribeChannelUnreads, subscribeDMUnreads } from "./unreadsApi";

export const subscribeUnreads = async () => {
  async function handleUnreadUpdate(unread: Client.Unread) {
    // db.create("Unread", unread, db.UpdateMode.All);
    console.log(`Updated an unread for ${unread.channelId}`);
  }

  subscribeChannelUnreads(handleUnreadUpdate);
  subscribeDMUnreads(handleUnreadUpdate);
};
