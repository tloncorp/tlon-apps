import type { TlonHistoryEntry } from './history.js';

type ChannelReactionDispatch = {
  messageText: string;
  replyParentId: string;
};

type HandleChannelReactionParams = {
  botShip: string;
  emoji: string;
  formatShip: (ship: string) => string;
  nest: string;
  postId: string;
  reactor: string;
  rootPostId?: string;
  target?: Pick<TlonHistoryEntry, 'author' | 'content'>;
  log: (message: string) => void;
  dispatchAgent: (reaction: ChannelReactionDispatch) => Promise<void>;
  enqueueSystemEvent: (eventText: string) => void;
};

type ChannelReactionSnapshotParams = {
  botShip: string;
  reactions: Record<string, string>;
  postId: string;
  rootPostId?: string;
  normalizeShip: (ship: string) => string;
  resolveTarget: (
    postId: string,
    rootPostId?: string
  ) => Promise<TlonHistoryEntry | undefined>;
  handleReaction: (reaction: {
    emoji: string;
    reactor: string;
    target: TlonHistoryEntry | undefined;
  }) => Promise<void>;
};

/**
 * Process every eligible reaction in one snapshot against one target lookup.
 */
export async function processChannelReactionSnapshot({
  botShip,
  reactions,
  postId,
  rootPostId,
  normalizeShip,
  resolveTarget,
  handleReaction,
}: ChannelReactionSnapshotParams): Promise<void> {
  const reactors = Object.entries(reactions)
    .map(([reactShip, emoji]) => ({ emoji, reactor: normalizeShip(reactShip) }))
    .filter(({ reactor }) => reactor && reactor !== botShip);

  if (reactors.length === 0) {
    return;
  }

  const target = await resolveTarget(postId, rootPostId);
  for (const { emoji, reactor } of reactors) {
    await handleReaction({ emoji, reactor, target });
  }
}

/**
 * Classify a channel reaction after its target has been resolved from the
 * cache or API, then dispatch bot-target reactions or queue passive events.
 */
export async function handleChannelReaction({
  botShip,
  emoji,
  formatShip,
  nest,
  postId,
  reactor,
  rootPostId,
  target,
  log,
  dispatchAgent,
  enqueueSystemEvent,
}: HandleChannelReactionParams): Promise<void> {
  const contentSnippet = target?.content
    ? ` (message: "${target.content.substring(0, 200)}${target.content.length > 200 ? '...' : ''}")`
    : '';
  const resolvedAuthor =
    target?.author && target.author !== 'unknown' ? target.author : undefined;
  if (!resolvedAuthor) {
    log(
      `[tlon] Unclassified reaction on ${nest} post ${postId}: ` +
        'could not resolve the reacted post author.'
    );
  }

  const authorInfo = resolvedAuthor
    ? ` (by ${formatShip(resolvedAuthor)})`
    : ' (message content unavailable)';
  const eventText = `Tlon reaction in ${nest}: ${emoji} by ${formatShip(reactor)} on post ${postId}${authorInfo}${contentSnippet}`;
  log(`[tlon] REACTION: ${eventText}`);

  if (resolvedAuthor === botShip) {
    await dispatchAgent({
      messageText: target?.content
        ? `${emoji} (reacting to: "${target.content}")`
        : emoji,
      replyParentId: rootPostId ?? postId,
    });
    return;
  }

  enqueueSystemEvent(eventText);
}
