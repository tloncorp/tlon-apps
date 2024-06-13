import { useEffect } from 'react';

import { queryClient } from '../api';

type PostChangeListener = (changes: Record<string, string[]>) => void;
const listeners: PostChangeListener[] = [];
let postEvents: Record<string, string[]> = {};

export function useDatabasePostChangeListener(cb: PostChangeListener) {
  useEffect(() => {
    listeners.push(cb);
    return () => {
      const index = listeners.indexOf(cb);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }, [cb]);
}

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
  if (table === 'posts' && row && !row.parent_id) {
    postEvents[row.channel_id] ||= [];
    postEvents[row.channel_id].push(row.id);
  }
  // We count updates to a post's reaction as post updates so that they trigger
  // channel refresh.
  if (table === 'post_reactions' && row) {
    queryClient.refetchQueries({
      queryKey: ['post', row.post_id],
    });
  }
}
