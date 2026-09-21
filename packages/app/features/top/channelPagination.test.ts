import { describe, expect, it } from 'vitest';

import { shouldAutoLoadOlderPosts } from './channelPagination';

const readyToFill = {
  isFetching: false,
  isError: false,
  hasNextPage: true,
  unreadDidInitialize: true,
  postCount: 10,
  minimumPostCount: 20,
  oldestPageHasOnlyDeletedPosts: false,
};

describe('shouldAutoLoadOlderPosts', () => {
  it('loads another page when initialized history does not fill the screen', () => {
    expect(shouldAutoLoadOlderPosts(readyToFill)).toBe(true);
  });

  it('does not restart automatic pagination after a query error', () => {
    expect(shouldAutoLoadOlderPosts({ ...readyToFill, isError: true })).toBe(
      false
    );
  });
});
