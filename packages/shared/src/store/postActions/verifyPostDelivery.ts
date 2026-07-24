import * as api from '@tloncorp/api';

import { trackEvent } from '../../analytics';
import * as db from '../../db';
import { AnalyticsEvent, PostDataDraft } from '../../domain';
import { logger } from './logger';

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

      const draft = PostDataDraft.isValid(post.draft) ? post.draft : null;
      if (draft) {
        PostDataDraft.revokeBlobUrls(draft);
      }
      await db.updatePost({
        id: post.id,
        deliveryStatus: 'sent',
        draft: null,
      });
      if (draft) {
        trackEvent(AnalyticsEvent.ContentSendCompleted, {
          type: draft.channelType,
          isReply: draft.replyToPostId != null,
          attachmentTypes: draft.attachments.map(
            (attachment) => attachment.type
          ),
        });
        if (
          draft.attachments.some(
            (attachment) => attachment.type === 'voicememo'
          )
        ) {
          trackEvent(AnalyticsEvent.VoiceMemoSent);
        }
      }
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
