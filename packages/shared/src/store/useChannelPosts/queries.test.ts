import { afterEach, describe, expect, it } from 'vitest';

import * as db from '../../db';
import { getLatestChannelPostsFirstPage, queryKeyPrefix } from './queries';

const data = (...pages: string[]) => ({
  pages,
  pageParams: pages.map((_, index) => index),
});

describe('getLatestChannelPostsFirstPage', () => {
  afterEach(() => {
    db.queryClient.clear();
  });

  it('returns data from the newest completed mount', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];

    db.queryClient.setQueryData([...queryKey, 10], data('older'));
    db.queryClient.setQueryData([...queryKey, 30], data('newer'));
    db.queryClient.setQueryData([...queryKey, 20], data('middle'));

    expect(getLatestChannelPostsFirstPage(queryKey)).toEqual(data('newer'));
  });

  it('only reuses the first page', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];

    db.queryClient.setQueryData([...queryKey, 10], data('initial', 'older'));

    expect(getLatestChannelPostsFirstPage(queryKey)).toEqual(data('initial'));
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
      data('latest')
    );
    db.queryClient.setQueryData([...unreadQueryKey, 20], data('unread'));

    expect(getLatestChannelPostsFirstPage(unreadQueryKey)).toEqual(
      data('unread')
    );
  });

  it('ignores incomplete mounts and non-mount descendants', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];

    db.queryClient.setQueryData([...queryKey, 10], data('complete'));
    db.queryClient
      .getQueryCache()
      .build(db.queryClient, { queryKey: [...queryKey, 30] });
    db.queryClient.setQueryData([...queryKey, 40, 'extra'], data('nested'));

    expect(getLatestChannelPostsFirstPage(queryKey)).toEqual(data('complete'));
  });
});
