import { afterEach, describe, expect, it } from 'vitest';

import * as db from '../../db';
import { getLatestChannelPostsInitialPage, queryKeyPrefix } from './queries';

type TestPageParam = { mode: string; cursorPostId?: string; count?: number };

const data = (...entries: [string, TestPageParam, number?][]) => ({
  pages: entries.map(([label, _pageParam, fetchedAt = 0]) => ({
    label,
    fetchedAt,
  })),
  pageParams: entries.map(([, pageParam]) => pageParam),
});

const newest = { mode: 'newest' };

describe('getLatestChannelPostsInitialPage', () => {
  afterEach(() => {
    db.queryClient.clear();
  });

  it('returns the most recently completed matching data', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];

    db.queryClient.setQueryData([...queryKey, 30], data(['older', newest, 10]));
    db.queryClient.setQueryData([...queryKey, 10], data(['newer', newest, 30]));
    db.queryClient.setQueryData(
      [...queryKey, 20],
      data(['middle', newest, 20])
    );

    expect(getLatestChannelPostsInitialPage(queryKey, newest)).toEqual(
      data(['newer', newest, 30])
    );
  });

  it('does not reuse an initial page with a different requested count', () => {
    const queryKey = [...queryKeyPrefix, 'channel', 'first-unread', false];
    const thirtyPosts = {
      mode: 'around',
      cursorPostId: 'first-unread',
      count: 30,
    };
    const fiftyPosts = { ...thirtyPosts, count: 50 };

    db.queryClient.setQueryData(
      [...queryKey, 10],
      data(['thirty', thirtyPosts, 20]),
      { updatedAt: 20 }
    );
    db.queryClient.setQueryData(
      [...queryKey, 20],
      data(['fifty', fiftyPosts, 30]),
      { updatedAt: 30 }
    );

    expect(getLatestChannelPostsInitialPage(queryKey, thirtyPosts)).toEqual(
      data(['thirty', thirtyPosts, 20])
    );
  });

  it('does not treat pagination as a fresher initial page', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];
    const older = { mode: 'older' };

    db.queryClient.setQueryData(
      [...queryKey, 10],
      data(['stale-initial', newest, 10], ['fresh-pagination', older, 40]),
      { updatedAt: 40 }
    );
    db.queryClient.setQueryData(
      [...queryKey, 20],
      data(['fresh-initial', newest, 30]),
      { updatedAt: 30 }
    );

    expect(getLatestChannelPostsInitialPage(queryKey, newest)).toEqual(
      data(['fresh-initial', newest, 30])
    );
  });

  it('reuses the original newest page after newer pages are prepended', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];
    const newer = { mode: 'newer' };
    const older = { mode: 'older' };

    db.queryClient.setQueryData(
      [...queryKey, 10],
      data(['newer', newer], ['initial', newest], ['older', older])
    );

    expect(getLatestChannelPostsInitialPage(queryKey, newest)).toEqual(
      data(['initial', newest])
    );
  });

  it('does not reuse data from another cursor', () => {
    const unreadQueryKey = [
      ...queryKeyPrefix,
      'channel',
      'first-unread',
      false,
    ];

    const unread = { mode: 'around', cursorPostId: 'first-unread' };
    db.queryClient.setQueryData(
      [...queryKeyPrefix, 'channel', undefined, false, 30],
      data(['latest', newest])
    );
    db.queryClient.setQueryData(
      [...unreadQueryKey, 20],
      data(['unread', unread])
    );

    expect(getLatestChannelPostsInitialPage(unreadQueryKey, unread)).toEqual(
      data(['unread', unread])
    );
  });

  it('preserves an around-cursor page after newer pages are prepended', () => {
    const queryKey = [...queryKeyPrefix, 'channel', 'first-unread', false];
    const newer = { mode: 'newer' };
    const unread = { mode: 'around', cursorPostId: 'first-unread' };

    db.queryClient.setQueryData(
      [...queryKey, 10],
      data(['newer', newer], ['unread', unread])
    );

    expect(getLatestChannelPostsInitialPage(queryKey, unread)).toEqual(
      data(['unread', unread])
    );
  });

  it('ignores incomplete mounts and non-mount descendants', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];

    db.queryClient.setQueryData([...queryKey, 10], data(['complete', newest]));
    db.queryClient
      .getQueryCache()
      .build(db.queryClient, { queryKey: [...queryKey, 30] });
    db.queryClient.setQueryData(
      [...queryKey, 40, 'extra'],
      data(['nested', newest])
    );

    expect(getLatestChannelPostsInitialPage(queryKey, newest)).toEqual(
      data(['complete', newest])
    );
  });

  it('does not substitute a different page when the initial page is absent', () => {
    const queryKey = [...queryKeyPrefix, 'channel', undefined, false];
    const newer = { mode: 'newer' };

    db.queryClient.setQueryData([...queryKey, 10], data(['newer', newer]));

    expect(getLatestChannelPostsInitialPage(queryKey, newest)).toBeUndefined();
  });
});
