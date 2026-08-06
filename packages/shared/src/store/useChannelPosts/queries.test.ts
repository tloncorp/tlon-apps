import { afterEach, describe, expect, it } from 'vitest';

import * as db from '../../db';
import { getLatestChannelPostsQueryData, queryKeyPrefix } from './queries';

describe('getLatestChannelPostsQueryData', () => {
  afterEach(() => {
    db.queryClient.clear();
  });

  it('returns data from the newest completed mount', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];

    db.queryClient.setQueryData([...queryKey, 10], 'older');
    db.queryClient.setQueryData([...queryKey, 30], 'newer');
    db.queryClient.setQueryData([...queryKey, 20], 'middle');

    expect(getLatestChannelPostsQueryData(queryKey)).toBe('newer');
  });

  it('does not reuse data from another cursor', () => {
    const unreadQueryKey = [
      ...queryKeyPrefix,
      'channel',
      'first-unread',
      false,
    ];

    db.queryClient.setQueryData(
      [...queryKeyPrefix, 'channel', undefined, false, 30],
      'latest'
    );
    db.queryClient.setQueryData([...unreadQueryKey, 20], 'unread');

    expect(getLatestChannelPostsQueryData(unreadQueryKey)).toBe('unread');
  });

  it('ignores incomplete mounts and non-mount descendants', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];

    db.queryClient.setQueryData([...queryKey, 10], 'complete');
    db.queryClient
      .getQueryCache()
      .build(db.queryClient, { queryKey: [...queryKey, 30] });
    db.queryClient.setQueryData([...queryKey, 40, 'extra'], 'nested');

    expect(getLatestChannelPostsQueryData(queryKey)).toBe('complete');
  });
});
