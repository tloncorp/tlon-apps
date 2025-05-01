import * as api from '../api';
import { toPostContent } from '../api';
import { PostContent, toUrbitStory } from '../api/postsApi';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import * as urbit from '../urbit';
import * as sync from './sync';
import {
  deleteFromChannelPosts,
  rollbackDeletedChannelPost,
} from './useChannelPosts';

const logger = createDevLogger('postActions', false);

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
  logger.crumb('sending post', `channel type: ${channel.type}`);
  if (channel.isPendingChannel) {
    logger.trackEvent(
      AnalyticsEvent.ActionStartedDM,
      logic.getModelAnalytics({ channel })
    );
    // if first message of a pending group dm, we need to first create
    // it on the backend
    if (channel.type === 'groupDm') {
      logger.crumb('is pending multi DM, need to create first');
      await api.createGroupDm({
        id: channel.id,
        members:
          channel.members
            ?.map((m) => m.contactId)
            .filter((m) => m !== authorId) ?? [],
      });
    }

    // either way, we have to mark it as non-pending
    await db.updateChannel({ id: channel.id, isPendingChannel: false });
  }
  // optimistic update
  // TODO: make author available more efficiently
  logger.crumb('get author');
  const author = await db.getContact({ id: authorId });
  logger.crumb('build pending post');
  const cachePost = db.buildPendingPost({
    authorId,
    author,
    channel,
    content,
    metadata,
  });

  let group: null | db.Group = null;
  if (channel.groupId) {
    group = await db.getGroup({ id: channel.groupId });
  }
  logger.trackEvent(
    AnalyticsEvent.ActionSendPost,
    logic.getModelAnalytics({ post: cachePost, channel, group })
  );

  logger.crumb('insert channel posts');
  sync.handleAddPost(cachePost);
  logger.crumb('done optimistic update');
  try {
    logger.crumb('sending post to backend');
    await api.sendPost({
      channelId: channel.id,
      authorId,
      content,
      metadata: metadata,
      sentAt: cachePost.sentAt,
    });
    logger.crumb('sent post to backend, syncing channel message delivery');
    sync.syncChannelMessageDelivery({ channelId: channel.id });
    logger.crumb('done sending post');
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorSendPost, {
      errorMessage: e.message,
      errorType: e.constructor?.name,
      errorStack: e.stack,
      errorDetails: JSON.stringify(e, Object.getOwnPropertyNames(e)),
    });
    logger.crumb('failed to send post');
    console.error('Failed to send post', {
      message: e.message,
      type: e.constructor?.name,
      stack: e.stack,
      fullError: e,
    });

    // Check if error is connection-related like "Aborted" or "Channel was reaped"
    // In these cases, the server might have received the message even though
    // the client didn't get the confirmation
    const errorMsg = e.message?.toLowerCase() || '';
    const isConnectionRelated =
      errorMsg === 'aborted' ||
      errorMsg.includes('channel was reaped') ||
      errorMsg.includes('fetch timed out');

    if (isConnectionRelated) {
      logger.crumb('connection issue detected, marking for verification');
      await db.updatePost({
        id: cachePost.id,
        deliveryStatus: 'needs_verification',
      });
    } else {
      await db.updatePost({ id: cachePost.id, deliveryStatus: 'failed' });
    }
  }
}

export async function retrySendPost({
  channel,
  post,
}: {
  channel: db.Channel;
  post: db.Post;
}) {
  logger.log('retrySendPost', { post });
  logger.trackEvent(
    AnalyticsEvent.ActionSendPostRetry,
    logic.getModelAnalytics({ post, channel })
  );
  if (post.deliveryStatus !== 'failed') {
    console.error('Tried to retry send on non-failed post', post);
    return;
  }

  // if first message of a pending group dm, we need to first create
  // it on the backend
  if (channel.type === 'groupDm' && channel.isPendingChannel) {
    await api.createGroupDm({
      id: channel.id,
      members:
        channel.members
          ?.map((m) => m.contactId)
          .filter((m) => m !== post.authorId) ?? [],
    });
    await db.updateChannel({ id: channel.id, isPendingChannel: false });
  }

  // optimistic update
  await db.updatePost({ id: post.id, deliveryStatus: 'pending' });

  const content = JSON.parse(post.content as string) as PostContent;
  const story = toUrbitStory(content);

  logger.log('retrySendPost: sending post', { post, story });

  try {
    await api.sendPost({
      channelId: post.channelId,
      authorId: post.authorId,
      content: story,
      metadata:
        post.image || post.title
          ? {
              title: post.title,
              image: post.image,
            }
          : undefined,
      sentAt: post.sentAt,
    });
    await sync.syncChannelMessageDelivery({ channelId: post.channelId });
  } catch (e) {
    console.error('Failed to retry send post', e);
    await db.updatePost({ id: post.id, deliveryStatus: 'failed' });
  }
}

export async function forwardPost({
  postId,
  channelId,
}: {
  postId: string;
  channelId: string;
}) {
  logger.log('forwardPost', { postId, channelId });
  logger.trackEvent(AnalyticsEvent.ActionForwardPost);

  const post = await db.getPost({ postId });
  if (!post) {
    logger.trackError('Failed to forward post, unable to find original');
    return;
  }

  const channel = await db.getChannel({ id: channelId });
  if (!channel) {
    logger.trackError('Failed to forward post, unable to find channel');
    return;
  }

  const urbitReference = urbit.pathToCite(logic.getPostReferencePath(post));
  if (!urbitReference) {
    logger.trackError('Failed to forward post, unable to get reference path');
    return;
  }

  return sendPost({
    channel,
    authorId: api.getCurrentUserId(),
    content: [{ block: { cite: urbitReference } }],
  });
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
  logger.log('editPost', { post, content, parentId, metadata });
  logger.trackEvent(
    AnalyticsEvent.ActionStartedDM,
    logic.getModelAnalytics({ post })
  );
  // optimistic update
  const [contentForDb, flags] = toPostContent(content);
  logger.log('editPost optimistic update', { contentForDb, flags });
  await db.updatePost({
    id: post.id,
    content: JSON.stringify(contentForDb),
    editStatus: 'pending',
    lastEditContent: JSON.stringify(contentForDb),
    lastEditTitle: metadata?.title,
    lastEditImage: metadata?.image,
    ...flags,
  });
  logger.log('editPost optimistic update done');

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
    logger.log('editPost api call done');
    await db.updatePost({
      id: post.id,
      editStatus: 'sent',
      lastEditContent: null,
      lastEditTitle: null,
      lastEditImage: null,
    });
    logger.log('editPost update done');
  } catch (e) {
    console.error('Failed to edit post', e);
    logger.log('editPost failed', e);

    // rollback optimistic update
    await db.updatePost({
      id: post.id,
      content: post.content,
      editStatus: 'failed',
    });
    logger.log('editPost rollback done');
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
  logger.crumb('sending reply', channel.type);
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

  let group = null;
  if (channel.groupId) {
    group = await db.getGroup({ id: channel.groupId });
  }

  logger.trackEvent(
    AnalyticsEvent.ActionSendReply,
    logic.getModelAnalytics({ post: cachePost, channel, group })
  );

  try {
    logger.crumb('sending reply to backend');
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
    logger.crumb('failed to send reply');
    logger.trackEvent(AnalyticsEvent.ErrorSendReply, {
      errorMessage: e.message,
    });
    console.error('Failed to send reply', e);
    await db.updatePost({ id: cachePost.id, deliveryStatus: 'failed' });
  }
}

export async function hidePost({ post }: { post: db.Post }) {
  logger.trackEvent(
    AnalyticsEvent.ActionHidePost,
    logic.getModelAnalytics({ post })
  );
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
  logger.crumb('deleting post');
  logger.trackEvent(
    AnalyticsEvent.ActionDeletePost,
    logic.getModelAnalytics({ post })
  );
  const existingPost = await db.getPost({ postId: post.id });

  // optimistic update
  deleteFromChannelPosts(post);
  await db.markPostAsDeleted(post.id);
  await db.updatePost({ id: post.id, deleteStatus: 'pending' });
  await db.updateChannel({ id: post.channelId, lastPostId: null });

  try {
    await api.deletePost(post.channelId, post.id, post.authorId);
    await db.updatePost({ id: post.id, deleteStatus: 'sent' });
  } catch (e) {
    console.error('Failed to delete post', e);

    // rollback optimistic update
    rollbackDeletedChannelPost(post);
    await db.updatePost({
      id: post.id,
      ...existingPost,
      deleteStatus: 'failed',
    });
    await db.updateChannel({ id: post.channelId, lastPostId: post.id });
  }
}

export async function deleteFailedPost({ post }: { post: db.Post }) {
  await db.markPostAsDeleted(post.id);
  await db.updateChannel({ id: post.channelId, lastPostId: null });
}

export async function reportPost({
  userId,
  post,
}: {
  userId: string;
  post: db.Post;
}) {
  if (!post.groupId) {
    console.error('Cannot report post without groupId', post);
    return;
  }

  // optimistic update
  await db.updatePost({ id: post.id, hidden: true });

  try {
    await api.reportPost(userId, post.groupId, post.channelId, post);
    await hidePost({ post });
  } catch (e) {
    console.error('Failed to report post', e);

    // rollback optimistic update
    await db.updatePost({ id: post.id, hidden: false });
  }
}

export async function addPostReaction(
  post: db.Post,
  shortCode: string,
  currentUserId: string
) {
  const channel = await db.getChannel({ id: post.channelId });
  let group = null;
  if (channel && channel.groupId) {
    group = await db.getGroup({ id: channel.groupId });
  }

  logger.trackEvent(
    AnalyticsEvent.ActionReact,
    logic.getModelAnalytics({ post, channel, group })
  );
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
    logger.trackEvent(AnalyticsEvent.ErrorReact, {
      errorMessage: e.message,
    });
    // rollback optimistic update
    await db.deletePostReaction({ postId: post.id, contactId: currentUserId });
  }
}

/**
 * Verifies whether a post was actually delivered to the server.
 * This is used for posts that are marked as 'needs_verification' due to connection issues.
 *
 * Uses authorId and sentAt to find matching posts on the server.
 */
export async function verifyPostDelivery(post: db.Post): Promise<boolean> {
  logger.crumb('verifying post delivery', {
    postId: post.id,
    channelId: post.channelId,
  });

  if (post.deliveryStatus !== 'needs_verification') {
    logger.crumb('post does not need verification', {
      status: post.deliveryStatus,
    });
    return false;
  }

  try {
    const response = await api.getChannelPosts({
      channelId: post.channelId,
      mode: 'newest',
      count: 30,
    });

    const matchingServerPost = response.posts.find((serverPost) => {
      if (serverPost.authorId !== post.authorId) return false;

      if (serverPost.sentAt !== post.sentAt) return false;

      return true;
    });

    if (matchingServerPost) {
      logger.crumb('post verified as delivered', {
        postId: post.id,
        matchedWithId: matchingServerPost.id,
      });

      await db.updatePost({ id: post.id, deliveryStatus: 'sent' });
      return true;
    } else {
      logger.crumb('post verified as not delivered', { postId: post.id });
      await db.updatePost({ id: post.id, deliveryStatus: 'failed' });
      return false;
    }
  } catch (e) {
    logger.crumb('post verification inconclusive', {
      postId: post.id,
      error: e.message,
    });
    return false;
  }
}

export async function removePostReaction(post: db.Post, currentUserId: string) {
  logger.trackEvent(
    AnalyticsEvent.ActionUnreact,
    logic.getModelAnalytics({ post })
  );
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
    logger.trackEvent(AnalyticsEvent.ErrorUnreact, {
      errorMessage: e.message,
    });
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
