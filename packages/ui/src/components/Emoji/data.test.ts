import { describe, expect, test } from 'vitest';

import { getNativeEmoji } from './data';

describe('getNativeEmoji', () => {
  test('resolves shortcodes to native glyphs', () => {
    expect(getNativeEmoji('+1')).toBe('👍');
    expect(getNativeEmoji(':heart:')).toBe('❤️');
  });

  test('rejects unknown shortcodes', () => {
    expect(getNativeEmoji('not_an_emoji')).toBeUndefined();
    expect(getNativeEmoji(':nope:')).toBeUndefined();
  });

  test('passes through simple native glyphs', () => {
    expect(getNativeEmoji('👍')).toBe('👍');
    expect(getNativeEmoji('❤️')).toBe('❤️');
    expect(getNativeEmoji('👍🏽')).toBe('👍🏽');
  });

  test('passes through ZWJ sequences', () => {
    // Regression: these are one emoji spread over many code points, and
    // measuring the whole string rejected them as if they were text.
    expect(getNativeEmoji('👨‍👩‍👧‍👦')).toBe('👨‍👩‍👧‍👦');
    expect(getNativeEmoji('❤️‍🔥')).toBe('❤️‍🔥');
    expect(getNativeEmoji('🏳️‍🌈')).toBe('🏳️‍🌈');
    expect(getNativeEmoji('👨🏽‍💻')).toBe('👨🏽‍💻');
  });

  test('still rejects prose', () => {
    expect(getNativeEmoji('this is a whole sentence')).toBeUndefined();
    expect(getNativeEmoji('👍 and some trailing words')).toBeUndefined();
  });
});
