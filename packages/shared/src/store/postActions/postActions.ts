import * as api from '@tloncorp/api';
import { toPostContent } from '@tloncorp/api';
import * as urbit from '@tloncorp/api/urbit';

import * as db from '../../db';
import type * as domain from '../../domain';
import { AnalyticsEvent, Attachment, PostDataDraft } from '../../domain';
import * as logic from '../../logic';
import * as Transcription from '../../transcription';
import { sessionActionQueue } from '../SessionActionQueue';
import {
  clearUploadState,
  finalizeAttachments,
  finalizeAttachmentsLocal,
  uploadAsset,
} from '../storage';
import * as sync from '../sync';
import {
  clearChannelPostsQueries,
  deleteFromChannelPosts,
  rollbackDeletedChannelPost,
} from '../useChannelPosts';
import { logger } from './logger';

export async function finalizePostDraft(
  draft: domain.PostDataDraftPost
): Promise<domain.PostDataFinalizedParent>;
export async function finalizePostDraft(
  draft: domain.PostDataDraftEdit
): Promise<domain.PostDataFinalizedEdit>;
export async function finalizePostDraft(
  draft: domain.PostDataDraft
): Promise<domain.PostDataFinalized> {
  // Before finalizing other attachments, set up transcription if needed. This
  // ensures we show dialogs ASAP after user taps send.
  let canTranscribe = false;
  const needsTranscription = draft.attachments.some(
    (att) =>
      att.type === 'voicememo' &&
      att.localUri != null &&
      att.transcription == null
  );
  if (needsTranscription) {
    const setupResult = await Transcription.setupTranscriptionIfNeeded();
    canTranscribe = setupResult.canTranscribe;
  }

  const attachments = await finalizeAttachments(draft.attachments);

  // Remove non-header images from notebook posts - these are "inlined":
  // https://github.com/tloncorp/tlon-apps/blob/71c9cabc54dfad10c83d46e10f209a3d632d36b2/packages/app/ui/components/BigInput.tsx#L151-L160
  if (draft.channelType === 'notebook') {
    for (let i = attachments.length - 1; i >= 0; i--) {
      const att = attachments[i];
      const isNonheaderImage =
        att.type === 'image' && att.file.uri !== draft.image;
      if (isNonheaderImage) {
        attachments.splice(i, 1);
      }
    }
  }

  if (canTranscribe) {
    for (const att of attachments) {
      if (
        att.type === 'voicememo' &&
        att.localUri != null &&
        att.transcription == null
      ) {
        try {
          const transcriptionText =
            await Transcription.transcribeAudioFileWithGlobalCache(
              att.localUri
            );
          att.transcription = transcriptionText ?? undefined;
        } catch (err) {
          console.warn(
            'Failed to transcribe audio file, proceeding without transcription',
            err
          );
        }
      }
    }
  }

  const { story, metadata, blob } = logic.toPostData({
    ...draft,
    attachments,
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
    // Serialize the entire draft for retry logic
    const serializedDraft = PostDataDraft.serialize(draft);

    await _sendPost({
      channelId: draft.channelId,
      buildOptimisticPostData: () =>
        finalizePostDraftUsingLocalAttachments(draft),
      buildFinalizedPostData: () => finalizePostDraft(draft),
      draft: serializedDraft,
    });
  }
}

/** Prefer using finalizeAndSendPost where possible for optimistic updates. */
async function sendFinalizedPost(postData: domain.PostDataFinalizedParent) {
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
  draft,
  existingPost,
}: {
  buildFinalizedPostData: () => Promise<domain.PostDataFinalizedParent>;
  buildOptimisticPostData?: () => domain.PostDataFinalizedParent;
  channelId: string;
  /** Serialized draft stored for retry logic */
  draft?: domain.PostDataDraft;
  /** Existing post to retry (updates in place instead of creating new) */
  existingPost?: db.Post;
}) {
  const authorId = api.getCurrentUserId();

  const channel = await db.getChannel({ id: channelId });
  if (!channel) {
    logger.trackError('Failed to forward post, unable to find channel');
    return;
  }

  let cachePost: db.Post;

  if (existingPost) {
    // Retry mode: update existing post in place
    logger.crumb('retrying existing post', existingPost.id);
    cachePost = existingPost;

    // Update status to enqueued immediately
    await db.updatePost({ id: cachePost.id, deliveryStatus: 'enqueued' });

    // Invalidate channel posts cache AFTER the DB update so the UI picks up
    // the new status (otherwise stale cached data overrides the fresh data)
    clearChannelPostsQueries();
  } else {
    // New post mode: create and insert
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
    if (!buildOptimisticPostData) {
      throw new Error('buildOptimisticPostData is required for new posts');
    }
    const optimisticPostData = buildOptimisticPostData();
    cachePost = db.buildPost({
      authorId,
      author,
      channel,
      sequenceNum: 0, // placeholder, this will be overwritten by the server
      content: optimisticPostData.content,
      metadata: optimisticPostData.metadata,
      deliveryStatus: 'enqueued',
      blob: optimisticPostData.blob,
      draft,
      parentId: optimisticPostData.replyToPostId ?? undefined,
    });

    let group: null | db.Group = null;
    if (channel.groupId) {
      group = await db.getGroup({ id: channel.groupId });
    }
    logger.trackEvent(
      optimisticPostData.replyToPostId != null
        ? AnalyticsEvent.ActionSendReply
        : AnalyticsEvent.ActionSendPost,
      {
        ...logic.getModelAnalytics({ post: cachePost, channel, group }),
        isBotDm: logic.isBotDmChannel({ post: cachePost, channel }),
      }
    );

    logger.crumb('insert channel posts');
    await sync.handleAddPost(cachePost);
  }

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
          blob: finalizedPostData.blob,
          deliveryStatus: 'pending',
          parentId: finalizedPostData.replyToPostId,
        }),
      });

      // Send to the appropriate API endpoint based on whether this is a reply
      if (finalizedPostData.replyToPostId != null) {
        // Reply - look up parent author from DB
        const parentPost = await db.getPost({
          postId: finalizedPostData.replyToPostId,
        });
        if (parentPost == null) {
          throw new Error(
            `Parent post ${finalizedPostData.replyToPostId} not found for thread send`
          );
        }
        logger.crumb('sending reply to API');
        return api.sendReply({
          channelId: channel.id,
          parentId: finalizedPostData.replyToPostId,
          parentAuthor: parentPost.authorId,
          authorId,
          content: finalizedPostData.content,
          blob: finalizedPostData.blob,
          sentAt: cachePost.sentAt,
        });
      } else {
        // Non-reply
        logger.crumb('sending post to API');
        return api.sendPost({
          channelId: channel.id,
          authorId,
          content: finalizedPostData.content,
          blob: finalizedPostData.blob,
          metadata: finalizedPostData.metadata,
          sentAt: cachePost.sentAt,
        });
      }
    });
    logger.crumb('sent post to backend, syncing channel message delivery');
    sync.syncChannelMessageDelivery({ channelId: channel.id });

    // Clear pending draft on success - it's no longer needed
    if (draft) {
      // Revoke any blob URLs to prevent memory leaks (web only)
      PostDataDraft.revokeBlobUrls(draft);
      await db.updatePost({
        id: cachePost.id,
        draft: null,
      });
    }

    logger.crumb('done sending post');
  } catch (e) {
    logger.trackEvent(
      cachePost.parentId == null
        ? AnalyticsEvent.ErrorSendPost
        : AnalyticsEvent.ErrorSendReply,
      {
        error: e,
        errorType: e.constructor?.name,
        errorDetails: JSON.stringify(e, Object.getOwnPropertyNames(e)),
      }
    );
    if (cachePost.parentId == null) {
      logger.crumb('failed to send post');
    } else {
      logger.crumb('failed to send reply');
    }
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

  // Require draft for retry - posts without it cannot be retried.
  if (!post.draft) {
    logger.trackError('retrySendPost: missing draft, cannot retry', {
      postId: post.id,
      channelId: post.channelId,
      hasParentId: !!post.parentId,
    });
    throw new Error('Cannot retry post without draft');
  }

  // Validate the draft structure before using it
  if (!PostDataDraft.isValid(post.draft)) {
    logger.trackError('retrySendPost: invalid draft structure', {
      postId: post.id,
      channelId: post.channelId,
      draft: post.draft,
    });
    throw new Error('Cannot retry post with invalid draft');
  }

  logger.log('retrySendPost: found pending draft, using draft-based retry');
  const draft = post.draft;

  // Clear stale upload states from the global store and re-trigger uploads.
  // Without this, waitForUploads will see the old error state and reject immediately.
  for (const att of draft.attachments) {
    const uploadIntent = Attachment.toUploadIntent(att);
    if (uploadIntent.needsUpload) {
      const key = Attachment.UploadIntent.extractKey(uploadIntent);
      clearUploadState(key);
      // Re-trigger the upload (don't await - let it run in parallel)
      uploadAsset(uploadIntent);
    }
  }

  // Retry only applies to posts (not edits), edit retries are handled
  // separately in ChannelScreen.handleRetrySend via store.editPost
  if (draft.isEdit === true) {
    throw new Error('Cannot retry an edit post via retrySendPost');
  }

  // Retry the send using the same code path as the initial send
  await _sendPost({
    channelId: draft.channelId,
    buildFinalizedPostData: () => finalizePostDraft(draft),
    existingPost: post,
  });
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

  return sendFinalizedPost({
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

    return sendFinalizedPost({
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

// A never-sent optimistic row (`sequenceNum === 0` with `deliveryStatus: 'failed'`)
// has no server counterpart, so clearing it is strictly a local operation.
// `needs_verification` is NOT in this shape — those rows may have reached the
// server and must go through the normal delete / verify paths.
function isUnsentOptimisticRow(post: db.Post): boolean {
  return post.sequenceNum === 0 && post.deliveryStatus === 'failed';
}

async function clearUnsentPost(post: db.Post) {
  deleteFromChannelPosts(post);
  await db.deletePost(post.id);
}

export async function deletePost({ post }: { post: db.Post }) {
  logger.crumb('deleting post');
  logger.trackEvent(
    AnalyticsEvent.ActionDeletePost,
    logic.getModelAnalytics({ post })
  );

  // The caller-provided `post` snapshot can be stale: `retrySendPost()`
  // synchronously flips the same row to `deliveryStatus: 'enqueued'`, and
  // sync can reconcile the row into a delivered server-backed shape.
  // Re-read the row from SQLite before classifying so we never hard-delete
  // a row that has since moved past the "never sent" state.
  const existingPost = await db.getPost({ postId: post.id });

  // If the row is already gone — e.g. this is a duplicate Delete fired
  // against a stale UI snapshot — there is nothing to do.
  if (!existingPost) {
    logger.crumb('deletePost: row already gone, no-op');
    return;
  }

  // The normal chat / thread action-menu Delete lands here for every row,
  // including a failed optimistic row that never reached the server. For
  // that exact shape, skip the server round trip and hard-delete locally —
  // otherwise we'd leave a ghost with `isDeleted: true` + `sequenceNum: 0`
  // pinned at the bottom of chat-style scrollers.
  if (isUnsentOptimisticRow(existingPost)) {
    await clearUnsentPost(existingPost);
    return;
  }

  const existingParent = existingPost.parentId
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
      ...existingPost,
      id: post.id,
      deleteStatus: 'failed',
    });
    await db.updateChannel({ id: post.channelId, lastPostId: post.id });
  }
}

export async function deleteFailedPost({ post }: { post: db.Post }) {
  // Retry-sheet Delete. Failed send (`sequenceNum === 0, deliveryStatus: 'failed'`)
  // goes through the same local cleanup as the action-menu path.
  // `needs_verification`, failed edit, and failed delete all operate on
  // server-backed rows and keep the existing `markPostAsDeleted` behavior.
  //
  // Re-read before classifying — the retry-sheet caller may hold a stale
  // snapshot (e.g. after `retrySendPost()` flipped the row back to
  // `enqueued`). Only authoritative DB state should drive the hard-delete
  // decision. If the row is already gone, do nothing.
  const existingPost = await db.getPost({ postId: post.id });
  if (!existingPost) {
    logger.crumb('deleteFailedPost: row already gone, no-op');
    return;
  }
  if (isUnsentOptimisticRow(existingPost)) {
    await clearUnsentPost(existingPost);
    return;
  }

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
