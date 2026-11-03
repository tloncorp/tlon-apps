import { getCanonicalPostId } from '@tloncorp/api/client';
import { preSig } from '@tloncorp/api/lib/urbit';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { da, parse } from '@urbit/aura';

import type { ContextLensOutput } from './types';

export interface ContextLensStamp {
  lensId: string;
  botShip: string | null;
}

// Gateway output messageIds are `~botShip/<@ud of send-time @da>`. Channel
// posts are keyed locally by host receipt time, so the id never matches the
// db directly — but the @ud tail round-trips exactly to the memo's `sent`
// (posts.sentAt), and the prefix is the bot ship (the author).
export function parseLensMessageId(
  messageId: string
): { authorId: string; sentAt: number } | null {
  const slash = messageId.lastIndexOf('/');
  if (slash <= 0) {
    return null;
  }
  const authorId = messageId.slice(0, slash);
  if (!authorId.startsWith('~')) {
    return null;
  }
  try {
    const sentAt = Number(da.toUnix(parse('ud', messageId.slice(slash + 1))));
    if (!Number.isFinite(sentAt) || sentAt <= 0) {
      return null;
    }
    return { authorId, sentAt };
  } catch {
    return null;
  }
}

/**
 * The post a run's output became, from the local db, or null when it hasn't
 * synced. A channel post is keyed by its host's receipt time rather than the
 * bot's send time, so it is found by channel, author and send time instead.
 */
export async function findLensOutputPost(
  output: ContextLensOutput
): Promise<db.Post | null> {
  let canonicalId: string | null = null;
  try {
    canonicalId = getCanonicalPostId(output.messageId);
  } catch {
    canonicalId = null;
  }
  const direct = canonicalId
    ? await db.getPostWithRelations({ id: canonicalId })
    : null;
  if (direct) {
    return direct;
  }
  const parsed = parseLensMessageId(output.messageId);
  return parsed && output.conversationId
    ? db.getPostBySentAt({
        channelId: output.conversationId,
        authorId: parsed.authorId,
        sentAt: parsed.sentAt,
      })
    : null;
}

export function getContextLensStamp(post: db.Post): ContextLensStamp | null {
  if (!post.blob) {
    return null;
  }
  const entry = logic
    .parsePostBlob(post.blob)
    .find((candidate) => candidate.type === 'tlon-context-lens');
  if (!entry || entry.type !== 'tlon-context-lens') {
    return null;
  }
  return {
    lensId: entry.lensId,
    // older blobs predate botShip; the bot authored the post, so its id
    // is the right fallback for the %context-lens lookup key
    botShip: entry.botShip ?? post.authorId ?? null,
  };
}

export function getOwnContextLensStamp(
  post: db.Post,
  ownedBotShips: readonly string[]
): ContextLensStamp | null {
  const stamp = getContextLensStamp(post);
  if (!stamp?.botShip || !post.authorId) {
    return null;
  }

  const botShip = preSig(stamp.botShip);
  const authorId = preSig(post.authorId);
  const isOwnedBot = ownedBotShips.some((ship) => preSig(ship) === botShip);
  return isOwnedBot && authorId === botShip ? stamp : null;
}
