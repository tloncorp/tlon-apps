import * as db from '@tloncorp/shared/db';
import { parsePostBlob } from '@tloncorp/shared/logic';

import type { A2UIActionCompletion } from '../../contexts/componentsKits';

/**
 * A2UI controls live in durable bot posts. Their resulting owner post is the
 * durable receipt that an action was consumed, so completed controls stay
 * gone after remounts and on other devices.
 */
export function getA2UIActionCompletion(
  laterPosts: db.Post[],
  currentUserId: string
): A2UIActionCompletion {
  const ownerReplies = laterPosts.filter(
    (candidate) => candidate.authorId === currentUserId && !candidate.isDeleted
  );
  return {
    sendMessage: ownerReplies.some((candidate) =>
      Boolean(candidate.textContent?.trim())
    ),
    provisionAgent: ownerReplies.some(
      (candidate) =>
        candidate.blob != null &&
        parsePostBlob(candidate.blob).some(
          (entry) => entry.type === 'tlon-agent-provision'
        )
    ),
  };
}
