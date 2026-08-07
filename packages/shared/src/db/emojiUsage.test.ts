import { describe, expect, test } from 'vitest';

import { sortEmojisByUsage } from './keyValue';

describe('sortEmojisByUsage', () => {
  test('orders by use count, descending', () => {
    expect(
      sortEmojisByUsage({
        '👍': { count: 2, lastUsedAt: 1 },
        '🔥': { count: 9, lastUsedAt: 1 },
        '🫡': { count: 5, lastUsedAt: 1 },
      })
    ).toEqual(['🔥', '🫡', '👍']);
  });

  test('breaks ties on most recently used', () => {
    expect(
      sortEmojisByUsage({
        '👍': { count: 3, lastUsedAt: 100 },
        '🔥': { count: 3, lastUsedAt: 300 },
        '🫡': { count: 3, lastUsedAt: 200 },
      })
    ).toEqual(['🔥', '🫡', '👍']);
  });

  test('returns an empty list when there is no usage history', () => {
    expect(sortEmojisByUsage({})).toEqual([]);
  });
});
