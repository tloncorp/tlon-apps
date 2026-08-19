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
  const newestEntries = [...ownerReplies]
    .reverse()
    .flatMap((candidate) =>
      candidate.blob == null ? [] : parsePostBlob(candidate.blob)
    );
  const providerConfig = newestEntries.find(
    (entry) => entry.type === 'tlon-agent-provider-config'
  );
  const provision = newestEntries.find(
    (entry) => entry.type === 'tlon-agent-provision'
  );
  return {
    sendMessage: ownerReplies.some((candidate) =>
      Boolean(candidate.textContent?.trim())
    ),
    sentMessageText:
      ownerReplies.find((candidate) => Boolean(candidate.textContent?.trim()))
        ?.textContent ?? undefined,
    provisionAgent: provision?.type === 'tlon-agent-provision',
    provisionedTopics:
      provision?.type === 'tlon-agent-provision' ? provision.topics : undefined,
    configuredProviderIds:
      providerConfig?.type === 'tlon-agent-provider-config'
        ? providerConfig.providerIds
        : undefined,
  };
}
