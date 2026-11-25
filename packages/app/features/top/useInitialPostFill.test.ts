import { describe, expect, test } from 'vitest';

import {
  countPostsBeforeAnchor,
  isInitialFillComplete,
} from './useInitialPostFill';

describe('isInitialFillComplete', () => {
  const base = { hasError: false, hasOlderPosts: true };

  test('waits while a short first page can still be topped up', () => {
    expect(isInitialFillComplete({ ...base, postCount: 1 })).toBe(false);
    expect(isInitialFillComplete({ ...base, postCount: 19 })).toBe(false);
  });

  test('is complete once there is a screenful', () => {
    expect(isInitialFillComplete({ ...base, postCount: 20 })).toBe(true);
    expect(isInitialFillComplete({ ...base, postCount: 50 })).toBe(true);
  });

  test('is complete for a short conversation with nothing older to load', () => {
    expect(
      isInitialFillComplete({ ...base, hasOlderPosts: false, postCount: 3 })
    ).toBe(true);
    expect(
      isInitialFillComplete({ ...base, hasOlderPosts: false, postCount: 0 })
    ).toBe(true);
  });

  test('does not hold posts back behind a failed load', () => {
    expect(
      isInitialFillComplete({ ...base, hasError: true, postCount: 2 })
    ).toBe(true);
    expect(
      isInitialFillComplete({ ...base, hasError: true, postCount: null })
    ).toBe(true);
  });

  test('is not complete before the first read returns', () => {
    expect(isInitialFillComplete({ ...base, postCount: null })).toBe(false);
  });

  test('opens on a late post without waiting for a full page', () => {
    expect(
      isInitialFillComplete({ ...base, postCount: 16, postsBeforeAnchor: 15 })
    ).toBe(true);
  });

  test('waits for posts above the one being opened on', () => {
    expect(
      isInitialFillComplete({ ...base, postCount: 30, postsBeforeAnchor: 3 })
    ).toBe(false);
    expect(
      isInitialFillComplete({ ...base, postCount: 30, postsBeforeAnchor: 12 })
    ).toBe(true);
  });

  test('opens on a post near the start of a conversation', () => {
    expect(
      isInitialFillComplete({
        ...base,
        hasOlderPosts: false,
        postCount: 30,
        postsBeforeAnchor: 3,
      })
    ).toBe(true);
  });

  test('does not wait on a post that is not loaded', () => {
    expect(
      isInitialFillComplete({ ...base, postCount: 30, postsBeforeAnchor: null })
    ).toBe(true);
  });
});

describe('countPostsBeforeAnchor', () => {
  const posts = [{ id: 'newest' }, { id: 'middle' }, { id: 'oldest' }];

  test('counts the posts older than the anchor in a newest-first list', () => {
    expect(countPostsBeforeAnchor(posts, 'newest')).toBe(2);
    expect(countPostsBeforeAnchor(posts, 'middle')).toBe(1);
    expect(countPostsBeforeAnchor(posts, 'oldest')).toBe(0);
  });

  test('is null with no anchor, or one that is not loaded', () => {
    expect(countPostsBeforeAnchor(posts, null)).toBeNull();
    expect(countPostsBeforeAnchor(posts, 'missing')).toBeNull();
    expect(countPostsBeforeAnchor(undefined, 'newest')).toBeNull();
  });
});
