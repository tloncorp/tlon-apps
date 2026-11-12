import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { type PostWithNeighbors, addsOlderPostsOnly } from './shared';

function rows(...ids: string[]): PostWithNeighbors[] {
  return ids.map((id) => ({
    post: { id } as db.Post,
    previous: null,
    next: null,
  }));
}

describe('addsOlderPostsOnly', () => {
  test('is true when a page lands above the oldest post', () => {
    expect(addsOlderPostsOnly(rows('c', 'd'), rows('a', 'b', 'c', 'd'))).toBe(
      true
    );
  });

  test('is false when a new message arrives at the end', () => {
    expect(addsOlderPostsOnly(rows('c', 'd'), rows('c', 'd', 'e'))).toBe(false);
  });

  test('is false when posts arrive at both ends', () => {
    expect(addsOlderPostsOnly(rows('c', 'd'), rows('b', 'c', 'd', 'e'))).toBe(
      false
    );
  });

  test('is false for the first rows and for unchanged or shorter lists', () => {
    expect(addsOlderPostsOnly([], rows('a', 'b'))).toBe(false);
    expect(addsOlderPostsOnly(rows('a', 'b'), rows('a', 'b'))).toBe(false);
    expect(addsOlderPostsOnly(rows('a', 'b', 'c'), rows('b', 'c'))).toBe(false);
  });
});
