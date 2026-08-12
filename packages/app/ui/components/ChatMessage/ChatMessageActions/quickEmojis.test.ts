import { describe, expect, test, vi } from 'vitest';

import {
  FREQUENT_SLOT_COUNT,
  LAST_SLOT_PLACEHOLDER,
  selectFrequentEmojis,
} from './quickEmojis';

// Enough of a resolver to exercise slot selection — the real `getNativeEmoji`
// is covered in packages/ui, and its barrel drags Flow-typed React Native
// sources into the transform chain.
const SHORTCODES: Record<string, string> = {
  '+1': '👍',
  heart: '❤️',
  laughing: '😆',
};

vi.mock('@tloncorp/ui', () => ({
  getNativeEmoji: (input: string) => SHORTCODES[input] ?? input,
}));

describe('selectFrequentEmojis', () => {
  test('falls back to the defaults with no history', () => {
    expect(selectFrequentEmojis([])).toEqual(['+1', 'heart', 'laughing']);
  });

  test('puts the most-used first and backfills the rest', () => {
    expect(selectFrequentEmojis(['🫡'])).toEqual(['🫡', '+1', 'heart']);
  });

  test('fills every slot once there is enough history', () => {
    expect(selectFrequentEmojis(['🫡', '🔥', '🎉', '🙏'])).toEqual([
      '🫡',
      '🔥',
      '🎉',
    ]);
  });

  test('does not backfill a default that is already a frequent slot', () => {
    // '👍' is the glyph behind the '+1' shortcode, so it must not appear twice.
    expect(selectFrequentEmojis(['👍'])).toEqual(['👍', 'heart', 'laughing']);
  });

  test('never gives a frequent slot to the last-slot placeholder', () => {
    // Regression: 🌀 ranking in the top three rendered it twice — once as a
    // frequent slot and once as the last slot's fallback.
    const slots = selectFrequentEmojis([LAST_SLOT_PLACEHOLDER, '🔥']);
    expect(slots).not.toContain(LAST_SLOT_PLACEHOLDER);
    expect(slots).toEqual(['🔥', '+1', 'heart']);
  });

  test('always returns a full set of slots', () => {
    expect(selectFrequentEmojis([])).toHaveLength(FREQUENT_SLOT_COUNT);
    expect(selectFrequentEmojis(['🫡'])).toHaveLength(FREQUENT_SLOT_COUNT);
  });
});
