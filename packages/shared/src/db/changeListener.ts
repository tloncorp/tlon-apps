import { queryClient } from '../api';

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
  // We count updates to a post's reaction as post updates so that they trigger
  // channel refresh.
  if (table === 'post_reactions' && row) {
    queryClient.refetchQueries({
      queryKey: ['post', row.post_id],
    });
  }

  // Same for changes to that post's thread unread
  if (table === 'thread_unreads' && row) {
    queryClient.refetchQueries({
      queryKey: ['post', row.thread_id],
    });
  }
}
