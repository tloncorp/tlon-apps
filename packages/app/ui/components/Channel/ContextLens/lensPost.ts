import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';

export interface ContextLensStamp {
  lensId: string;
  botShip: string | null;
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
