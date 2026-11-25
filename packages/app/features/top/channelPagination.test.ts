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

  it('loads another page when too few posts sit above the opening post', () => {
    const full = {
      ...readyToFill,
      postCount: 30,
      minimumPostsBeforeAnchor: 12,
    };
    expect(shouldAutoLoadOlderPosts({ ...full, postsBeforeAnchor: 3 })).toBe(
      true
    );
    expect(shouldAutoLoadOlderPosts({ ...full, postsBeforeAnchor: 12 })).toBe(
      false
    );
    expect(shouldAutoLoadOlderPosts({ ...full, postsBeforeAnchor: null })).toBe(
      false
    );
  });

  it('does not restart automatic pagination after a query error', () => {
    expect(shouldAutoLoadOlderPosts({ ...readyToFill, isError: true })).toBe(
      false
    );
  });
});
