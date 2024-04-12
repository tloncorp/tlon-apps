import { addReaction, removeReaction } from '../api';
import * as db from '../db';
import * as sync from '../sync';

// demo mode, just make em functions
export async function addPostReaction(
  channelId: string,
  postId: string,
  shortCode: string,
  our: string
) {
  const formattedShortcode = shortCode.replace(/^(?!:)(.*)$(?<!:)/, ':$1:');
  try {
    // optimistic update
    await db.insertPostReactions({
      reactions: [{ postId, value: formattedShortcode, contactId: our }],
    });

    await addReaction(channelId, postId, formattedShortcode, our);
    sync.syncChannel(channelId, Date.now());
  } catch (e) {
    console.error('addPostReaction failed', e);
  }
}

export async function removePostReaction(
  channelId: string,
  postId: string,
  our: string
) {
  try {
    // optimistic update
    await db.deletePostReaction({ postId, contactId: our });

    await removeReaction(channelId, postId, our);
    sync.syncChannel(channelId, Date.now());
  } catch (e) {
    console.error('removePostReaction failed', e);
  }
}
