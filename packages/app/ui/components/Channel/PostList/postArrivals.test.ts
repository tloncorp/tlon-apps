import { describe, expect, it } from 'vitest';

import { getAppendedPostIds } from './postArrivals';

const posts = (...ids: string[]) => ids.map((id) => ({ post: { id } }));

describe('conversation arrivals', () => {
  it('includes each message in a burst at the end', () => {
    expect(getAppendedPostIds(posts('a'), posts('a', 'b', 'c'))).toEqual(
      new Set(['b', 'c'])
    );
  });

  it('includes the first message in an already settled empty conversation', () => {
    expect(getAppendedPostIds([], posts('a'))).toEqual(new Set(['a']));
  });

  it('does not animate older pages, edits, or delivery acknowledgements', () => {
    expect(getAppendedPostIds(posts('b', 'c'), posts('a', 'b', 'c'))).toEqual(
      new Set()
    );
    expect(getAppendedPostIds(posts('a', 'b'), posts('a', 'b'))).toEqual(
      new Set()
    );
  });

  it('separates live arrivals from older messages loaded in the same update', () => {
    expect(getAppendedPostIds(posts('b'), posts('a', 'b', 'c'))).toEqual(
      new Set(['c'])
    );
  });

  it('does not animate replacement windows or reordered existing messages', () => {
    expect(getAppendedPostIds(posts('a', 'b'), posts('c', 'd'))).toEqual(
      new Set()
    );
    expect(getAppendedPostIds(posts('a', 'b'), posts('b', 'a'))).toEqual(
      new Set()
    );
  });
});
