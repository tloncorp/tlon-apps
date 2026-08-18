import * as db from '@tloncorp/shared/db';
import { parsePostBlob } from '@tloncorp/shared/logic';

/**
 * Typed coordinator requests are durable transport receipts, not chat copy.
 * Keep them in channel history so onboarding can replay safely, but omit them
 * from the presented timeline.
 */
export function isVisibleChannelPost(post: Pick<db.Post, 'blob'>): boolean {
  if (!post.blob) return true;

  return !parsePostBlob(post.blob).some(
    (entry) => entry.type === 'tlon-agent-intro-request'
  );
}
