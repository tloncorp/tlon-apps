import * as api from '../api';
import * as db from '../db';
import * as urbit from '../urbit';
import * as sync from './sync';

export async function sendPost({
  channel,
  authorId,
  content,
  metadata,
}: {
  channel: db.Channel;
  authorId: string;
  content: urbit.Story;
  metadata?: db.PostMetadata;
}) {
  // if first message of a pending group dm, we need to first create
  // it on the backend
  if (channel.type === 'groupDm' && channel.isPendingChannel) {
    await api.createGroupDm({
      id: channel.id,
      members:
        channel.members
          ?.map((m) => m.contactId)
          .filter((m) => m !== authorId) ?? [],
    });
    await db.updateChannel({ id: channel.id, isPendingChannel: false });
  }

  // optimistic update
  // TODO: make author available more efficiently
  const author = await db.getContact({ id: authorId });
  const cachePost = db.buildPendingPost({ authorId, author, channel, content });
  sync.handleAddPost(cachePost);
  try {
    await api.sendPost({
      channelId: channel.id,
      authorId,
      content,
      metadata: metadata,
      sentAt: cachePost.sentAt,
    });
    await sync.syncChannelMessageDelivery({ channelId: channel.id });
  } catch (e) {
    console.error('Failed to send post', e);
    await db.updatePost({ id: cachePost.id, deliveryStatus: 'failed' });
  }
}

export async function editPost({
  post,
  content,
  parentId,
  metadata,
}: {
  post: db.Post;
  content: urbit.Story;
  parentId?: string;
  metadata?: db.PostMetadata;
}) {
  // optimistic update
  await db.updatePost({ id: post.id, content: JSON.stringify(content) });

  try {
    await api.editPost({
      channelId: post.channelId,
      postId: post.id,
      authorId: post.authorId,
      sentAt: post.sentAt,
      content,
      metadata,
      parentId,
    });
    sync.syncChannelMessageDelivery({ channelId: post.channelId });
  } catch (e) {
    console.error('Failed to edit post', e);

    // rollback optimistic update
    await db.updatePost({ id: post.id, content: post.content });
  }
}

export async function sendReply({
  parentId,
  parentAuthor,
  authorId,
  content,
  channel,
}: {
  channel: db.Channel;
  parentId: string;
  parentAuthor: string;
  authorId: string;
  content: urbit.Story;
}) {
  // optimistic update
  // TODO: make author available more efficiently
  const author = await db.getContact({ id: authorId });
  const cachePost = db.buildPendingPost({
    authorId,
    author,
    channel: channel,
    content,
    parentId,
  });
  await db.insertChannelPosts({ channelId: channel.id, posts: [cachePost] });
  await db.addReplyToPost({
    parentId,
    replyAuthor: cachePost.authorId,
    replyTime: cachePost.sentAt,
  });

  try {
    api.sendReply({
      channelId: channel.id,
      parentId,
      parentAuthor,
      authorId,
      content,
      sentAt: cachePost.sentAt,
    });
    sync.syncChannelMessageDelivery({ channelId: channel.id });
  } catch (e) {
    console.error('Failed to send reply', e);
    await db.updatePost({ id: cachePost.id, deliveryStatus: 'failed' });
  }
}

export async function hidePost({ post }: { post: db.Post }) {
  // optimistic update
  await db.updatePost({ id: post.id, hidden: true });

  try {
    await api.hidePost(post);
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
    await api.showPost(post);
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
    await db.insertChannelPosts({ channelId: post.channelId, posts: [post] });
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
    await api.addReaction({
      channelId: post.channelId,
      postId: post.id,
      shortCode: formattedShortcode,
      our: currentUserId,
      postAuthor: post.authorId,
    });
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
    await api.removeReaction({
      channelId: post.channelId,
      postId: post.id,
      our: currentUserId,
      postAuthor: post.authorId,
    });
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
