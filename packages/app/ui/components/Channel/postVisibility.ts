import * as db from '@tloncorp/shared/db';
import { parsePostBlob } from '@tloncorp/shared/logic';

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

  return !parsePostBlob(post.blob).some(
    (entry) => entry.type === 'tlon-agent-intro-request'
  );
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

export function isAgentGroupSetupRequestPost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return parsePostBlob(post.blob).some(
    (entry) => entry.type === 'tlon-agent-intro-request'
  );
}

export function isAgentOnboardingFirstGroupRequestPost(
  post: Pick<db.Post, 'blob'>
): boolean {
  if (!post.blob) return false;

  return parsePostBlob(post.blob).some(
    (entry) =>
      entry.type === 'tlon-agent-intro-request' && entry.isFirstGroup === true
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
  return !posts.some(isAgentGroupSetupCompletePost);
}
