import * as api from '../api';
import * as db from '../db';
import * as sync from './sync';

export async function togglePost({
  channelId,
  postId,
}: {
  channelId: string;
  postId: string;
}) {
  try {
    // optimistic update
    await db.updatePost({ id: postId, hidden: true });

    await api.togglePost(channelId, postId);
  } catch (e) {
    console.error('Failed to hide post', e);
  }
}

export async function deletePost({
  channelId,
  postId,
}: {
  channelId: string;
  postId: string;
}) {
  try {
    // optimistic update
    await db.updatePost({ id: postId, hidden: true });

    await api.deletePost(channelId, postId);
  } catch (e) {
    console.error('Failed to delete post', e);
  }
}
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

    await api.addReaction(channelId, postId, formattedShortcode, our);
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

    await api.removeReaction(channelId, postId, our);
    sync.syncChannel(channelId, Date.now());
  } catch (e) {
    console.error('removePostReaction failed', e);
  }
}
