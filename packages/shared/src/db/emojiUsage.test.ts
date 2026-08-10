import { describe, expect, test } from 'vitest';

import {
  EmojiUsage,
  MAX_TRACKED_EMOJIS,
  applyEmojiUsage,
  sortEmojisByUsage,
} from './keyValue';

/** A full tracked set where every glyph is used more than the newcomer. */
function fullUsage(count: number): EmojiUsage {
  return Object.fromEntries(
    Array.from({ length: MAX_TRACKED_EMOJIS }, (_, i) => [
      `e${i}`,
      { count, lastUsedAt: i },
    ])
  );
}

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

describe('applyEmojiUsage', () => {
  test('increments an existing glyph and stamps the time', () => {
    expect(
      applyEmojiUsage({ '🔥': { count: 2, lastUsedAt: 1 } }, '🔥', 50)
    ).toEqual({ '🔥': { count: 3, lastUsedAt: 50 } });
  });

  test('starts a new glyph at one', () => {
    expect(applyEmojiUsage({}, '🫡', 50)).toEqual({
      '🫡': { count: 1, lastUsedAt: 50 },
    });
  });

  test('keeps a brand new glyph even when the cap is full', () => {
    const result = applyEmojiUsage(fullUsage(5), '🫡', 999);
    expect(Object.keys(result)).toHaveLength(MAX_TRACKED_EMOJIS);
    expect(result['🫡']).toEqual({ count: 1, lastUsedAt: 999 });
  });

  test('lets a newly favored glyph accumulate past the cap', () => {
    // Regression: ranking the newcomer against a full set evicted it every
    // press, pinning it at count 1 forever.
    let usage = fullUsage(5);
    for (let i = 0; i < 3; i++) {
      usage = applyEmojiUsage(usage, '🫡', 1000 + i);
    }
    expect(usage['🫡']).toEqual({ count: 3, lastUsedAt: 1002 });
  });

  test('evicts the least-used glyph to make room', () => {
    const usage: EmojiUsage = {
      ...fullUsage(5),
      e0: { count: 1, lastUsedAt: 0 },
    };
    const result = applyEmojiUsage(usage, '🫡', 999);
    expect(result.e0).toBeUndefined();
    expect(Object.keys(result)).toHaveLength(MAX_TRACKED_EMOJIS);
  });
});
