import * as api from '../api';
import * as db from '../db';
import * as sync from './sync';

export async function hidePost({ post }: { post: db.Post }) {
  // optimistic update
  await db.updatePost({ id: post.id, hidden: true });

  try {
    await api.hidePost(post.channelId, post.id);
  } catch (e) {
    console.error('Failed to hide post', e);

    // rollback optimistic update
    await db.updatePost({ id: post.id, hidden: false });
  }
}

export async function showPost({ post }: { post: db.Post }) {
  // optimistic update
  await db.updatePost({ id: post.id, hidden: false });

  try {
    await api.showPost(post.channelId, post.id);
  } catch (e) {
    console.error('Failed to show post', e);

    // rollback optimistic update
    await db.updatePost({ id: post.id, hidden: true });
  }
}

export async function deletePost({ post }: { post: db.Post }) {
  // optimistic update
  await db.deletePost(post.id);

  try {
    await api.deletePost(post.channelId, post.id);
  } catch (e) {
    console.error('Failed to delete post', e);

    // rollback optimistic update
    await db.insertChannelPosts(post.channelId, [post]);
  }
}

export async function addPostReaction(
  post: db.Post,
  shortCode: string,
  currentUserId: string
) {
  const formattedShortcode = shortCode.replace(/^(?!:)(.*)$(?<!:)/, ':$1:');

  // optimistic update
  await db.insertPostReactions({
    reactions: [
      { postId: post.id, value: formattedShortcode, contactId: currentUserId },
    ],
  });

  try {
    await api.addReaction(
      post.channelId,
      post.id,
      formattedShortcode,
      currentUserId
    );
    sync.syncChannel(post.channelId, Date.now());
  } catch (e) {
    console.error('Failed to add post reaction', e);

    // rollback optimistic update
    await db.deletePostReaction({ postId: post.id, contactId: currentUserId });
  }
}

export async function removePostReaction(post: db.Post, currentUserId: string) {
  const existingReaction = await db.getPostReaction({
    postId: post.id,
    contactId: currentUserId,
  });

  // optimistic update
  await db.deletePostReaction({ postId: post.id, contactId: currentUserId });

  try {
    await api.removeReaction(post.channelId, post.id, currentUserId);
    sync.syncChannel(post.channelId, Date.now());
  } catch (e) {
    console.error('Failed to remove post reaction', e);

    // rollback optimistic update
    if (existingReaction) {
      await db.insertPostReactions({
        reactions: [
          {
            postId: post.id,
            contactId: currentUserId,
            value: existingReaction.value,
          },
        ],
      });
    }
  }
}
