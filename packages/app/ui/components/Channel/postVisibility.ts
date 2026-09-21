import * as db from '@tloncorp/shared/db';
import { isMoonOfUser } from '@tloncorp/api/client/apiUtils';
import { isBotHomeGroupChatChannel } from '@tloncorp/api/client/wayfinding';
import {
  findPostBlobEntry,
  parsePostBlob,
  postHasBlobEntry,
} from '@tloncorp/api';

// Provisioned by ylem before the conversational onboarding begins. Keep the
// exact full copy here so a later bot message that builds on it remains visible.
export const TLAWN_HOME_GROUP_WELCOME_MESSAGE =
  'Welcome! This is your private group with me, your Tlonbot. You can @ me ' +
  'here anytime and I will respond. Invite some friends, and they can @ me ' +
  'too—we can all chat together.';

/**
 * Typed coordinator requests are durable transport receipts, not chat copy.
 * Keep them in channel history so onboarding can replay safely, but omit them
 * from the presented timeline.
 */
export function isVisibleChannelPost(
  post: Pick<db.Post, 'blob' | 'authorId' | 'isBot' | 'textContent'> & {
    deliveryStatus?: db.Post['deliveryStatus'];
  },
  currentUserId: string,
  channelId?: string
): boolean {
  if (
    channelId &&
    isBotHomeGroupChatChannel(currentUserId, channelId) &&
    (post.isBot === true || isMoonOfUser(post.authorId, currentUserId)) &&
    post.textContent?.trim() === TLAWN_HOME_GROUP_WELCOME_MESSAGE
  ) {
    return false;
  }
  if (!post.blob) return true;
  if (post.authorId !== currentUserId) return true;
  if (post.deliveryStatus === 'failed') return true;

  return !postHasBlobEntry(post.blob, 'tlon-agent-intro-request');
}

export function isAgentOnboardingOrientationCompletePost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return parsePostBlob(post.blob).some(
    (entry) =>
      entry.type === 'tlon-agent-post-marker' &&
      entry.key === 'orientation-complete'
  );
}

export function findAgentOnboardingOrientationCompletePostId(
  posts: Array<Pick<db.Post, 'id' | 'authorId' | 'blob'>> | null | undefined,
  agentId: string | undefined
): string | null {
  if (!agentId) return null;
  return (
    posts?.find(
      (post) =>
        post.authorId === agentId &&
        isAgentOnboardingOrientationCompletePost(post)
    )?.id ?? null
  );
}

export function isAgentGroupSetupRequestPost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return postHasBlobEntry(post.blob, 'tlon-agent-intro-request');
}

export function isAgentOnboardingFirstGroupRequestPost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return (
    findPostBlobEntry(post.blob, 'tlon-agent-intro-request')?.isFirstGroup ===
    true
  );
}

export function isAgentGroupSetupCompletePost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return parsePostBlob(post.blob).some(
    (entry) =>
      entry.type === 'tlon-agent-post-marker' &&
      (entry.key === 'orientation-complete' ||
        entry.key === 'group-setup-complete' ||
        entry.key === 'first-entry-failed')
  );
}

export function isAgentGroupSetupActive(
  posts:
    | Array<
        Pick<db.Post, 'authorId' | 'blob'> & {
          deliveryStatus?: db.Post['deliveryStatus'];
        }
      >
    | null
    | undefined,
  currentUserId: string,
  agentShipId: string | undefined,
  hasLocalMarker: boolean
): boolean {
  if (hasLocalMarker) return true;
  if (
    !posts?.some(
      (post) =>
        post.authorId === currentUserId &&
        post.deliveryStatus !== 'failed' &&
        isAgentGroupSetupRequestPost(post)
    )
  ) {
    return false;
  }
  return !posts.some(
    (post) =>
      post.authorId === agentShipId && isAgentGroupSetupCompletePost(post)
  );
}
