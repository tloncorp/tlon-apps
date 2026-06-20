import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { da, parse } from '@urbit/aura';

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
    // is the right fallback for the %steward [bot id] lookup key
    botShip: entry.botShip ?? post.authorId ?? null,
  };
}
