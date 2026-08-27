import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { SyncPriority } from '../syncQueue';
import * as sync from '../sync';
import { HydrateSurfaceOptions, hydrateSurface } from './hydration';

/**
 * Live surface hydration over the store's query layer. The deps `Set` at
 * queryKey[1] subscribes this to table-level invalidation for `posts` and
 * `channels`, so live post arrivals, deletions/edits, and spec changes
 * (description sync) each re-run the fold — that re-reduction is the
 * incremental fold at this layer, and it is how §6's mutation semantics
 * (deletions above the boundary, snapshot removal, revision transitions)
 * converge without any bespoke subscription plumbing.
 */
export function useSurfaceHydration({
  channelId,
  enabled = true,
  pageSize,
  maxPages,
}: {
  channelId: string;
  enabled?: boolean;
} & Pick<HydrateSurfaceOptions, 'pageSize' | 'maxPages'>) {
  const deps = useMemo(() => new Set(['posts', 'channels']), []);
  return useQuery({
    enabled,
    queryKey: ['surfaceHydration', deps, channelId],
    queryFn: () =>
      hydrateSurface({
        channelId,
        pageSize,
        maxPages,
        backfill: defaultBackfill,
      }),
  });
}

/** Remote backfill via the sync layer, used when the local window runs dry. */
async function defaultBackfill({
  channelId,
  mode,
  cursorSequenceNum,
  count,
}: {
  channelId: string;
  mode: 'newest' | 'older';
  cursorSequenceNum?: number;
  count: number;
}): Promise<void> {
  if (mode === 'newest' || cursorSequenceNum == null) {
    await sync.syncPosts(
      { channelId, mode: 'newest', count },
      { priority: SyncPriority.High }
    );
    return;
  }
  await sync.syncSequencedPosts(
    { channelId, mode: 'older', cursorSequenceNum, count },
    { priority: SyncPriority.High }
  );
}
