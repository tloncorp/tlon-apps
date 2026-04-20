import { queryClient } from '../db/reactQuery';
import { createDevLogger } from '../debug';

const logger = createDevLogger('db:changeListener', false);

let postEvents: Record<string, string[]> = {};

/**
 * Flush current pending change batch
 */
export function flush() {
  if (Object.keys(postEvents).length) {
    Object.keys(postEvents).forEach((k) => {
      postEvents[k].forEach((id) => {
        queryClient.invalidateQueries({
          queryKey: ['post', id],
        });
      });
    });
    postEvents = {};
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
  row?: any;
}) {
  logger.log('handleChange, Received change', { table, operation, row });
  // If a post is updated, we need to refetch the post. If it's a new post, we
  // no-op because there's no query to invalidate.
  if (table === 'posts' && row && !row.parent_id && operation !== 'INSERT') {
    postEvents[row.channel_id] ||= [];
    if (postEvents[row.channel_id].includes(row.id)) {
      // We already have this post in the batch, no need to add it again.
      // Without this check, we could end up with duplicate post IDs in the
      // batch, which would cause the query to be invalidated multiple times.
      return;
    }
    postEvents[row.channel_id].push(row.id);
  }
  // Reactions, thread unreads, and thread-scoped volume settings all feed
  // data that's joined into ['post', id] queries. Use invalidateQueries (not
  // refetch) so only queries with observers actually refetch — the rest just
  // get marked stale for next mount.
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
