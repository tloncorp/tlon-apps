import * as db from '@tloncorp/shared/db';
import {
  findPostBlobEntry,
  parsePostBlob,
  postHasBlobEntry,
} from '@tloncorp/api';

/**
 * Typed coordinator requests are durable transport receipts, not chat copy.
 * Keep them in channel history so onboarding can replay safely, but omit them
 * from the presented timeline.
 */
export function isVisibleChannelPost(
  post: Pick<db.Post, 'blob' | 'authorId'>,
  currentUserId: string
): boolean {
  if (!post.blob) return true;
  if (post.authorId !== currentUserId) return true;

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
  posts: Array<Pick<db.Post, 'authorId' | 'blob'>> | null | undefined,
  currentUserId: string,
  agentShipId: string | undefined,
  hasLocalMarker: boolean
): boolean {
  if (hasLocalMarker) return true;
  if (
    !posts?.some(
      (post) =>
        post.authorId === currentUserId && isAgentGroupSetupRequestPost(post)
    )
  ) {
    return false;
  }
  return !posts.some(
    (post) =>
      post.authorId === agentShipId && isAgentGroupSetupCompletePost(post)
  );
}
