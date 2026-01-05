import * as api from '../api';
import { toPostContent } from '../api';
import { PostContent, toUrbitStory } from '../api/postsApi';
import * as db from '../db';
import { createDevLogger } from '../debug';
import type * as domain from '../domain';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import * as urbit from '../urbit';
import { sessionActionQueue } from './SessionActionQueue';
import { finalizeAttachments, finalizeAttachmentsLocal } from './storage';
import * as sync from './sync';
import {
  deleteFromChannelPosts,
  rollbackDeletedChannelPost,
} from './useChannelPosts';

export const logger = createDevLogger('postActions', false);

export async function failEnqueuedPosts() {
  const enqueuedPosts = await db.getEnqueuedPosts();
  await Promise.all(
    enqueuedPosts.map(async (post) => {
      await db.updatePost({ id: post.id, deliveryStatus: 'failed' });
    })
  );
}

export async function finalizePostDraft(
  draft: domain.PostDataDraftPost
): Promise<domain.PostDataFinalizedParent>;
export async function finalizePostDraft(
  draft: domain.PostDataDraftEdit
): Promise<domain.PostDataFinalizedEdit>;
export async function finalizePostDraft(
  draft: domain.PostDataDraft
): Promise<domain.PostDataFinalized> {
  const { story, metadata, blob } = logic.toPostData({
    ...draft,
    attachments: await finalizeAttachments(draft.attachments),
  });

  const finalizedBase = {
    channelId: draft.channelId,
    content: story,
    metadata,
    blob,
    replyToPostId: draft.replyToPostId,
  };

  if (draft.isEdit) {
    return {
      ...finalizedBase,
      isEdit: true,
      editTargetPostId: draft.editTargetPostId,
    } satisfies domain.PostDataFinalizedEdit;
  } else {
    return finalizedBase satisfies domain.PostDataFinalizedParent;
  }
}

export function finalizePostDraftUsingLocalAttachments(
  draft: domain.PostDataDraftPost
): domain.PostDataFinalizedParent;
export function finalizePostDraftUsingLocalAttachments(
  draft: domain.PostDataDraftEdit
): domain.PostDataFinalizedEdit;
export function finalizePostDraftUsingLocalAttachments(
  draft: domain.PostDataDraft
): domain.PostDataFinalized {
  const { story, metadata, blob } = logic.toPostData({
    ...draft,
    attachments: finalizeAttachmentsLocal(draft.attachments),
  });
  const finalizedBase = {
    channelId: draft.channelId,
    content: story,
    metadata,
    blob,
    replyToPostId: draft.replyToPostId,
  };
  if (draft.isEdit) {
    return {
      ...finalizedBase,
      isEdit: true,
      editTargetPostId: draft.editTargetPostId,
    } satisfies domain.PostDataFinalizedEdit;
  } else {
    return finalizedBase satisfies domain.PostDataFinalizedParent;
  }
}

export async function finalizeAndSendPost(
  draft: domain.PostDataDraft
): Promise<void> {
  if (draft.isEdit) {
    await editPostUsingDraft(draft);
  } else {
    await _sendPost({
      channelId: draft.channelId,
      buildOptimisticPostData: () =>
        finalizePostDraftUsingLocalAttachments(draft),
      buildFinalizedPostData: () => finalizePostDraft(draft),
    });
  }
}

export async function sendPost(postData: domain.PostDataFinalizedParent) {
  return await _sendPost({
    channelId: postData.channelId,
    buildOptimisticPostData: () => postData,
    buildFinalizedPostData: async () => postData,
  });
}

async function _sendPost({
  buildFinalizedPostData,
  buildOptimisticPostData,
  channelId,
}: {
  buildFinalizedPostData: () => Promise<domain.PostDataFinalizedParent>;
  buildOptimisticPostData: () => domain.PostDataFinalizedParent;
  channelId: string;
}) {
  const authorId = api.getCurrentUserId();

  const channel = await db.getChannel({ id: channelId });
  if (!channel) {
    logger.trackError('Failed to forward post, unable to find channel');
    return;
  }

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
  const optimisticPostData = buildOptimisticPostData();
  const cachePost = db.buildPost({
    authorId,
    author,
    channel,
    sequenceNum: 0, // placeholder, this will be overwritten by the server
    content: optimisticPostData.content,
    metadata: optimisticPostData.metadata,
    deliveryStatus: 'enqueued',
    blob: optimisticPostData.blob,
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
  await sync.handleAddPost(cachePost);
  logger.crumb('done optimistic update');
  try {
    logger.crumb('enqueuing sending post to backend');

    // Ensure uploads are started. Uploads are likely already started in UI,
    // but may as well make sure they're started here to avoid blocking in
    // SessionActionQueue.
    const finalizedPostDataPromise = buildFinalizedPostData();

    await sessionActionQueue.add(async () => {
      logger.crumb('finalizing post');
      const finalizedPostData = await finalizedPostDataPromise;
      logger.crumb('updating post in db with finalized data');
      await db.updatePost({
        id: cachePost.id,
        ...db.buildPostUpdate({
          id: cachePost.id,
          content: finalizedPostData.content,
          metadata: finalizedPostData.metadata,
          deliveryStatus: 'pending',
          blob: finalizedPostData.blob,
        }),
      });
      logger.crumb('sending post to API');
      return api.sendPost({
        channelId: channel.id,
        authorId,
        content: finalizedPostData.content,
        blob: finalizedPostData.blob,
        metadata: finalizedPostData.metadata,
        sentAt: cachePost.sentAt,
      });
    });
    logger.crumb('sent post to backend, syncing channel message delivery');
    sync.syncChannelMessageDelivery({ channelId: channel.id });
    logger.crumb('done sending post');
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorSendPost, {
      error: e,
      errorType: e.constructor?.name,
      errorDetails: JSON.stringify(e, Object.getOwnPropertyNames(e)),
    });
    logger.crumb('failed to send post');
    logger.error('Failed to send post', {
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
  if (post.deliveryStatus !== 'failed' && post.deliveryStatus !== 'enqueued') {
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
  await db.updatePost({ id: post.id, deliveryStatus: 'enqueued' });

  const content = JSON.parse(post.content as string) as PostContent;
  const story = toUrbitStory(content);

  logger.log('retrySendPost: sending post', { post, story });

  try {
    await sessionActionQueue.add(async () => {
      await db.updatePost({ id: post.id, deliveryStatus: 'pending' });

      if (post.parentId) {
        const parentPost = await db.getPost({ postId: post.parentId });
        if (!parentPost) {
          throw new Error(
            `Parent post ${post.parentId} not found for thread retry`
          );
        }

        return api.sendReply({
          channelId: post.channelId,
          parentId: post.parentId,
          parentAuthor: parentPost.authorId,
          authorId: post.authorId,
          content: story,
          sentAt: post.sentAt,
        });
      } else {
        return api.sendPost({
          channelId: post.channelId,
          authorId: post.authorId,
          content: story,
          blob: post.blob || undefined,
          metadata:
            post.image || post.title
              ? {
                  title: post.title,
                  image: post.image,
                }
              : undefined,
          sentAt: post.sentAt,
        });
      }
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
    channelId,
    content: [{ block: { cite: urbitReference } }],
    replyToPostId: null,
    metadata:
      channel.type === 'notebook'
        ? {
            title:
              post.title && post.title !== '' ? post.title : 'Forwarded post',
          }
        : undefined,
  });
}

export async function forwardGroup({
  groupId,
  channelId,
}: {
  groupId: string;
  channelId: string;
}) {
  try {
    logger.log('forwardGroup', { groupId, channelId });
    logger.trackEvent(AnalyticsEvent.ActionForwardGroup);

    const group = await db.getGroup({ id: groupId });
    if (!group) {
      logger.trackError('Failed to forward group, unable to find original');
      return;
    }

    const channel = await db.getChannel({ id: channelId });
    if (!channel) {
      logger.trackError('Failed to forward group, unable to find channel');
      return;
    }

    const urbitReference = urbit.pathToCite(
      logic.getGroupReferencePath(groupId)
    );
    if (!urbitReference) {
      logger.trackError(
        'Failed to forward group, unable to get reference path'
      );
      return;
    }

    return sendPost({
      channelId: channel.id,
      content: [{ block: { cite: urbitReference } }],
      replyToPostId: null,
      metadata:
        channel.type === 'notebook'
          ? {
              title: group.title ? `${group.title} group` : 'Forwarded group',
            }
          : undefined,
    });
  } catch (error) {
    logger.trackError('Failed to forward group', error);
    throw error;
  }
}

/** @deprecated use `editPostUsingDraft` instead to be less blocking */
export async function editPost({
  post,
  content,
  metadata,
}: {
  post: db.Post;
  content: urbit.Story;
  parentId?: string;
  metadata?: db.PostMetadata;
}) {
  const postData: domain.PostDataFinalizedEdit = {
    replyToPostId: null,
    channelId: post.channelId,
    isEdit: true,
    editTargetPostId: post.id,
    content,
    metadata,
  };
  await _editPost({
    postBeforeEdit: post,
    buildOptimisticPostData: () => postData,
    buildFinalizedPostData: async () => postData,
  });
}

export async function editPostUsingDraft(draft: domain.PostDataDraftEdit) {
  const postBeforeEdit = await db.getPost({
    postId: draft.editTargetPostId,
  });
  if (postBeforeEdit == null) {
    throw new Error('Editing post not found');
  }

  await _editPost({
    postBeforeEdit,
    buildOptimisticPostData: () =>
      finalizePostDraftUsingLocalAttachments(draft),
    buildFinalizedPostData: () => finalizePostDraft(draft),
  });
}

async function _editPost({
  postBeforeEdit,
  buildFinalizedPostData,
  buildOptimisticPostData,
}: {
  postBeforeEdit: db.Post;
  buildFinalizedPostData: () => Promise<domain.PostDataFinalizedEdit>;
  buildOptimisticPostData: () => domain.PostDataFinalizedEdit;
}) {
  logger.trackEvent(
    AnalyticsEvent.ActionStartedDM,
    logic.getModelAnalytics({ post: postBeforeEdit })
  );

  const optimisticPostData = buildOptimisticPostData();

  // optimistic update
  const [contentForDb, flags] = toPostContent(optimisticPostData.content);
  logger.log('editPost optimistic update', { optimisticPostData });
  await db.updatePost({
    id: optimisticPostData.editTargetPostId,
    content: JSON.stringify(contentForDb),
    editStatus: 'enqueued',
    lastEditContent: JSON.stringify(contentForDb),
    lastEditTitle: optimisticPostData.metadata?.title,
    lastEditImage: optimisticPostData.metadata?.image,
    blob: optimisticPostData.blob,
    ...flags,
  });
  logger.log('editPost optimistic update done');

  try {
    await sessionActionQueue.add(async () => {
      const finalized = await buildFinalizedPostData();

      await db.updatePost({
        id: finalized.editTargetPostId,
        editStatus: 'pending',
      });
      return api.editPost({
        channelId: finalized.channelId,
        postId: finalized.editTargetPostId,
        authorId: postBeforeEdit.authorId,
        sentAt: postBeforeEdit.sentAt,
        blob: postBeforeEdit.blob ?? undefined, // NB: blob is not editable - so you can't e.g. change or remove a file attachment
        content: finalized.content,
        metadata: finalized.metadata,
        parentId: postBeforeEdit.parentId ?? undefined,
      });
    });
    logger.log('editPost api call done');
    await db.updatePost({
      id: postBeforeEdit.id,
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
      id: postBeforeEdit.id,
      content: postBeforeEdit.content,
      editStatus: 'failed',
    });
    logger.log('editPost rollback done');
  }
}

export async function sendReply({
  parentId,
  parentAuthor,
  content,
  channel,
}: {
  channel: db.Channel;
  parentId: string;
  parentAuthor: string;
  content: urbit.Story;
}) {
  logger.crumb('sending reply', channel.type);
  // optimistic update
  // TODO: make author available more efficiently
  const authorId = api.getCurrentUserId();
  const author = await db.getContact({ id: authorId });
  const cachePost = db.buildPost({
    authorId,
    author,
    channel: channel,
    sequenceNum: 0, // replies do not have sequence numbers, use 0
    content,
    parentId,
    deliveryStatus: 'enqueued',
  });
  await db.insertChannelPosts({ posts: [cachePost] });
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
    await sessionActionQueue.add(() =>
      api.sendReply({
        channelId: channel.id,
        parentId,
        parentAuthor,
        authorId,
        content,
        sentAt: cachePost.sentAt,
      })
    );
    sync.syncChannelMessageDelivery({ channelId: channel.id });
  } catch (e) {
    logger.crumb('failed to send reply');
    logger.trackEvent(AnalyticsEvent.ErrorSendReply, {
      error: e,
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
    await sessionActionQueue.add(() => api.hidePost(post));
  } catch (e) {
    logger.trackError('Failed to hide post', e);

    // rollback optimistic update
    await db.updatePost({ id: post.id, hidden: false });
  }
}

export async function showPost({ post }: { post: db.Post }) {
  // optimistic update
  await db.updatePost({ id: post.id, hidden: false });

  try {
    await sessionActionQueue.add(() => api.showPost(post));
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
  const existingParent = existingPost?.parentId
    ? await db.getPost({ postId: existingPost.parentId })
    : null;

  // optimistic update
  deleteFromChannelPosts(post);
  await db.markPostAsDeleted(post.id);
  await db.updatePost({ id: post.id, deleteStatus: 'enqueued' });
  await db.updateChannel({ id: post.channelId, lastPostId: null });

  try {
    await db.updatePost({ id: post.id, deleteStatus: 'pending' });
    await sessionActionQueue.add(() =>
      post.parentId
        ? api.deleteReply({
            channelId: post.channelId,
            postId: post.id,
            authorId: post.authorId,
            parentId: post.parentId!,
            parentAuthorId:
              post.parent?.authorId || existingParent?.authorId || '',
          })
        : api.deletePost(post.channelId, post.id, post.authorId)
    );
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
    logger.trackError('Cannot report post without groupId', {
      postId: post.id,
      channelId: post.channelId,
      authorId: post.authorId,
      sentAt: post.sentAt,
    });
    return;
  }

  // optimistic update
  await db.updatePost({ id: post.id, hidden: true });
  const groupId = post.groupId;
  try {
    await sessionActionQueue.add(() =>
      api.reportPost(userId, groupId, post.channelId, post)
    );
    await hidePost({ post });
  } catch (e) {
    logger.trackError('Failed to report post', e);

    // rollback optimistic update
    await db.updatePost({ id: post.id, hidden: false });
  }
}

export async function addPostReaction(
  post: db.Post,
  emoji: string,
  currentUserId: string
) {
  // Reject shortcodes - they should be converted to native emojis before reaching this function
  if (/^:[a-zA-Z0-9_+-]+:?$/.test(emoji)) {
    logger.trackError(
      'Shortcode provided to addPostReaction - this should not happen',
      {
        postId: post.id,
        channelId: post.channelId,
        emoji,
        context: 'store_layer_shortcode_rejected',
        stack: new Error().stack,
      }
    );
    return; // Don't add shortcode reactions
  }

  // Basic validation - ensure it's not empty or too long
  if (!emoji || emoji.length === 0 || emoji.length > 20) {
    logger.trackError('Invalid emoji provided to addPostReaction', {
      postId: post.id,
      channelId: post.channelId,
      emoji,
      context: 'store_layer_invalid_emoji',
    });
    return;
  }

  const channel = await db.getChannel({ id: post.channelId });
  let group = null;
  if (channel && channel.groupId) {
    group = await db.getGroup({ id: channel.groupId });
  }

  logger.trackEvent(
    AnalyticsEvent.ActionReact,
    logic.getModelAnalytics({ post, channel, group })
  );

  // optimistic update
  await db.deletePostReaction({ postId: post.id, contactId: currentUserId });
  await db.insertPostReactions({
    reactions: [{ postId: post.id, value: emoji, contactId: currentUserId }],
  });

  const parentPost = post.parentId
    ? await db.getPost({ postId: post.parentId })
    : undefined;

  try {
    await sessionActionQueue.add(() =>
      api.addReaction({
        channelId: post.channelId,
        postId: post.id,
        emoji,
        our: currentUserId,
        postAuthor: post.authorId,
        parentId: post.parentId || undefined,
        parentAuthorId: parentPost?.authorId || undefined,
      })
    );
  } catch (e) {
    console.error('Failed to add post reaction', e);
    logger.trackEvent(AnalyticsEvent.ErrorReact, {
      error: e,
    });
    // rollback optimistic update
    await db.deletePostReaction({ postId: post.id, contactId: currentUserId });
  }
}

/**
 * Verifies whether a post was actually delivered to the server.
 * This is used for posts that are marked as 'needs_verification' due to
 * connection issues.
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
    logger.trackEvent(`verifying post delivery for chan ${post.channelId}`);
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

  const parentPost = post.parentId
    ? await db.getPost({ postId: post.parentId })
    : undefined;

  try {
    await sessionActionQueue.add(() =>
      api.removeReaction({
        channelId: post.channelId,
        postId: post.id,
        our: currentUserId,
        postAuthor: post.authorId,
        parentId: post.parentId || undefined,
        parentAuthorId: parentPost?.authorId || undefined,
      })
    );
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorUnreact, {
      error: e,
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

/**
 * Summarizes messages and sends the summary as a DM to the current user.
 *
 * For thread summarization: provide postId
 * For channel time range summarization: provide channelId + startTime
 */
export async function summarizeMessages({
  postId,
  channelId,
  startTime,
  channelTitle,
  timeLabel,
  currentUserId,
  limit = 500,
  maxChars = 10000,
}: {
  postId?: string;
  channelId?: string;
  startTime?: number;
  channelTitle?: string;
  timeLabel?: string;
  currentUserId: string;
  limit?: number;
  maxChars?: number;
}): Promise<void> {
  logger.crumb('summarizeMessages starting', {
    postId,
    channelId,
    startTime,
    limit,
    maxChars,
  });

  try {
    let combinedText: string;
    let summaryPrefix: string;

    // Reduce character limit for channel summaries to avoid overwhelming model
    const effectiveMaxChars = channelId ? Math.min(maxChars, 6000) : maxChars;

    // Thread summarization
    if (postId) {
      logger.crumb('thread summarization mode', { postId });
      const post = await db.getPost({ postId });
      if (!post || !post.textContent) {
        const error = new Error('Post not found or has no text content');
        logger.trackError('summarizeMessages: post fetch failed', {
          postId,
          postFound: !!post,
          hasTextContent: post?.textContent ? 'yes' : 'no',
        });
        throw error;
      }

      const hasReplies = post.replyCount && post.replyCount > 0;
      if (!hasReplies) {
        combinedText = post.textContent;
        logger.crumb('single post, no replies', {
          textLength: combinedText.length,
        });
      } else {
        try {
          const replies = await db.getThreadPosts({ parentId: post.id });
          logger.crumb('fetched thread replies', { count: replies.length });
          const allMessages = [
            `${post.authorId}: ${post.textContent}`,
            ...replies
              .filter((reply) => reply.textContent)
              .map((reply) => `${reply.authorId}: ${reply.textContent}`),
          ];
          combinedText = allMessages.join('\n\n');
          logger.crumb('combined thread messages', {
            totalMessages: allMessages.length,
            textLength: combinedText.length,
          });
        } catch (error) {
          logger.trackError('Error fetching thread for summarization', error);
          combinedText = post.textContent;
        }
      }
      summaryPrefix = 'AI Summary:';
    }
    // Channel time range summarization
    else if (channelId && startTime !== undefined) {
      logger.crumb('channel time range summarization mode', {
        channelId,
        startTime,
        limit,
      });
      const posts = await db.getChannelPostsByTimeRange({
        channelId,
        startTime,
        limit,
      });

      logger.crumb('fetched channel posts', { count: posts.length });

      if (posts.length === 0) {
        const error = new Error('No messages found in time range');
        logger.trackError('summarizeMessages: no posts in time range', {
          channelId,
          startTime,
          limit,
        });
        throw error;
      }

      const allMessages = posts
        .filter((post: db.Post) => post.textContent)
        .map((post: db.Post) => {
          return `${post.authorId}: ${post.textContent}`;
        });

      combinedText = allMessages.join('\n\n');
      summaryPrefix = `AI Summary of ${channelTitle || 'channel'}${timeLabel ? ` (${timeLabel})` : ''}:`;

      logger.crumb('combined channel messages', {
        totalMessages: allMessages.length,
        textLength: combinedText.length,
      });
    } else {
      const error = new Error(
        'Must provide either postId or (channelId + startTime)'
      );
      logger.trackError('summarizeMessages: invalid parameters', {
        hasPostId: !!postId,
        hasChannelId: !!channelId,
        hasStartTime: startTime !== undefined,
      });
      throw error;
    }

    // Apply character limit
    const originalLength = combinedText.length;
    if (combinedText.length > effectiveMaxChars) {
      combinedText =
        combinedText.substring(0, effectiveMaxChars) +
        '\n\n[... conversation truncated ...]';
      logger.crumb('text truncated', {
        originalLength,
        truncatedLength: combinedText.length,
        effectiveMaxChars,
      });
    }

    // Call AI API
    logger.crumb('calling AI API for summarization', {
      textLength: combinedText.length,
    });
    const response = await api.summarizeMessage({ messageText: combinedText });

    logger.crumb('AI API response received', {
      hasError: !!response.error,
      hasSummary: !!response.summary,
      summaryLength: response.summary?.length,
    });

    if (response.error || !response.summary) {
      const errorMessage = response.error || 'No summary returned';
      logger.trackError('summarizeMessages: AI API returned error', {
        error: errorMessage,
        responseError: response.error,
        hasSummary: !!response.summary,
        // Include full error details from OpenRouter API
        errorDetails: response.errorDetails,
        responseStatus: response.errorDetails?.responseStatus,
        responseData: response.errorDetails?.responseData,
        responseHeaders: response.errorDetails?.responseHeaders,
      });
      throw new Error(errorMessage);
    }

    // Send DM to self
    logger.crumb('sending summary DM', {
      summaryLength: response.summary.length,
      currentUserId,
    });
    await api.sendPost({
      channelId: currentUserId,
      authorId: currentUserId,
      sentAt: Date.now(),
      content: [
        {
          inline: [`${summaryPrefix}\n\n${response.summary}`],
        },
      ],
    });

    logger.crumb('summarizeMessages completed successfully');
  } catch (error) {
    logger.trackError('summarizeMessages failed', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name,
      errorStack: error instanceof Error ? error.stack : undefined,
      postId,
      channelId,
      startTime,
    });
    logger.error('summarizeMessages error', {
      error,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
