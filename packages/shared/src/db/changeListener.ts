import { queryClient } from '../db/reactQuery';
import { createDevLogger } from '../debug';

const logger = createDevLogger('db:changeListener', false);

let postEvents = new Set<string>();

type ChangeRow = {
  id?: string;
  post_id?: string;
  thread_id?: string;
  item_type?: string;
  item_id?: string;
};

/**
 * Flush current pending change batch
 */
export function flush() {
  if (postEvents.size) {
    postEvents.forEach((id) => {
      queryClient.invalidateQueries({
        queryKey: ['post', id],
      });
    });
    postEvents = new Set<string>();
  }
}

export function handleChange({
  table,
  operation,
  row,
}: {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Set on insert and update, contains raw data for updated row w/ snake case
   * keys (`id`, `channel_id`, 'group_id`, etc.) */
  row?: ChangeRow;
}) {
  logger.log('handleChange, Received change', { table, operation, row });
  // A post-specific query can already be cached as `null` before sync inserts
  // the row. Invalidate the exact key for inserts too, without falling back to
  // broad table-level invalidation for every cached post query.
  if (table === 'posts' && row?.id) {
    postEvents.add(row.id);
  }
  // Reactions, thread unreads, and thread-scoped volume settings all feed
  // data that's joined into ['post', id] queries. invalidateQueries uses
  // prefix matching, so ['post', id] also covers usePostReference's
  // ['post', id, 'reference'] entries. Use invalidateQueries (not refetch)
  // so only queries with observers actually refetch — the rest just get
  // marked stale for next mount.
  if (table === 'post_reactions' && row) {
    logger.log('handleChange, Received post reaction change:', row);
    queryClient.invalidateQueries({
      queryKey: ['post', row.post_id],
    });
  }

  if (table === 'thread_unreads' && row) {
    queryClient.invalidateQueries({
      queryKey: ['post', row.thread_id],
    });
  }

  // Volume settings use item_id as the scope key; for thread volumes that's
  // the parent post id, which matches our ['post', id] queryKey directly.
  if (
    table === 'volume_settings' &&
    row &&
    row.item_type === 'thread' &&
    row.item_id
  ) {
    queryClient.invalidateQueries({
      queryKey: ['post', row.item_id],
    });
  }
}
