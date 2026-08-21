import { preSig } from '@tloncorp/api/lib/urbit';
import type * as db from '@tloncorp/shared/db';

import { getContextLensStamp } from './lensPost';
import type { ContextLensEvent } from './types';

export function contextLensEventKey(event: ContextLensEvent) {
  return [
    event.seq,
    event.at,
    event.phase,
    event.lens.lensId,
    event.detail?.toolCallCount ?? '',
    event.detail?.toolName ?? '',
  ].join(':');
}

export function mergeContextLensEventSources(
  ...sources: readonly ContextLensEvent[][]
) {
  const byKey = new Map<string, ContextLensEvent>();
  for (const event of sources.flat()) {
    byKey.set(contextLensEventKey(event), event);
  }
  return [...byKey.values()].sort(
    (left, right) => left.at - right.at || left.seq - right.seq
  );
}

export function contextLensRunKeysForPosts(posts: readonly db.Post[]) {
  const byKey = new Map<string, { botShip: string; lensId: string }>();
  for (const post of posts) {
    const stamp = getContextLensStamp(post);
    if (!stamp?.botShip || stamp.delivery === 'intermediate') continue;
    const botShip = preSig(stamp.botShip);
    const key = `${botShip}\n${stamp.lensId}`;
    byKey.set(key, { botShip, lensId: stamp.lensId });
  }
  return [...byKey.values()].sort(
    (left, right) =>
      left.botShip.localeCompare(right.botShip) ||
      left.lensId.localeCompare(right.lensId)
  );
}
