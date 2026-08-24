import * as db from '@tloncorp/shared/db';
import { parsePostBlob } from '@tloncorp/shared/logic';

import type { A2UIActionCompletion } from '../../contexts/componentsKits';

function isDurableOwnerReply(candidate: db.Post, currentUserId: string) {
  return (
    candidate.authorId === currentUserId &&
    !candidate.isDeleted &&
    candidate.deliveryStatus !== 'failed'
  );
}

function getLastReplyIndexByText(texts: readonly string[]) {
  const result = new Map<string, number>();
  texts.forEach((text, index) => result.set(text.trim(), index));
  return result;
}

/**
 * A2UI controls live in durable bot posts. Their resulting owner post is the
 * durable receipt that an action was consumed, so completed controls stay
 * gone after remounts and on other devices.
 */
export function getA2UIActionCompletion(
  laterPosts: db.Post[],
  currentUserId: string
): A2UIActionCompletion {
  const ownerReplies = laterPosts.filter((candidate) =>
    isDurableOwnerReply(candidate, currentUserId)
  );
  const ownerReplyTexts = ownerReplies.flatMap((candidate) =>
    candidate.textContent?.trim() ? [candidate.textContent] : []
  );
  const lastIndexByText = getLastReplyIndexByText(ownerReplyTexts);
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
    sentMessageTextIndex: {
      lastIndexByText,
      start: 0,
    },
    provisionAgent: provision?.type === 'tlon-agent-provision',
    provisionedTopics:
      provision?.type === 'tlon-agent-provision' ? provision.topics : undefined,
    configuredProviderIds:
      providerConfig?.type === 'tlon-agent-provider-config'
        ? providerConfig.providerIds
        : undefined,
  };
}

/**
 * Compute the same suffix completion for every chronological post in one
 * reverse pass. The scroller previously sliced and rescanned the remainder of
 * the conversation for every visible row, making long chats quadratic.
 */
export function getA2UIActionCompletions(
  posts: db.Post[],
  currentUserId: string
): A2UIActionCompletion[] {
  const completions = new Array<A2UIActionCompletion>(posts.length);
  const ownerReplyTexts = posts.flatMap((candidate) =>
    isDurableOwnerReply(candidate, currentUserId) &&
    candidate.textContent?.trim()
      ? [candidate.textContent]
      : []
  );
  const lastIndexByText = getLastReplyIndexByText(ownerReplyTexts);
  let nextOwnerReplyIndex = ownerReplyTexts.length;
  let provisionedTopics: string[] | undefined;
  let configuredProviderIds: string[] | undefined;

  for (let index = posts.length - 1; index >= 0; index -= 1) {
    const sentMessageText = ownerReplyTexts[nextOwnerReplyIndex];
    completions[index] = {
      sendMessage: sentMessageText !== undefined,
      sentMessageText,
      sentMessageTextIndex: {
        lastIndexByText,
        start: nextOwnerReplyIndex,
      },
      provisionAgent: provisionedTopics !== undefined,
      provisionedTopics,
      configuredProviderIds,
    };

    const candidate = posts[index];
    if (!isDurableOwnerReply(candidate, currentUserId)) continue;
    const text = candidate.textContent?.trim();
    if (text) {
      nextOwnerReplyIndex -= 1;
    }
    if (candidate.blob == null) continue;
    for (const entry of parsePostBlob(candidate.blob)) {
      if (
        configuredProviderIds === undefined &&
        entry.type === 'tlon-agent-provider-config'
      ) {
        configuredProviderIds = entry.providerIds;
      }
      if (
        provisionedTopics === undefined &&
        entry.type === 'tlon-agent-provision'
      ) {
        provisionedTopics = entry.topics;
      }
    }
  }

  return completions;
}
