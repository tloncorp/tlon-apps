import * as api from '../api';
import * as db from '../db';

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
