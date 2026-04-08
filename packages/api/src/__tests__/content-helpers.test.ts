import { describe, expect, test } from 'vitest';

import {
  contentToTextAndMentions,
  textAndMentionsToContent,
} from '../client/content-helpers';

describe('contentToTextAndMentions / textAndMentionsToContent round-trip', () => {
  test('mention + link text survives round-trip without corruption', () => {
    const originalText = '~malmur-halmex check this https://example.com cool';
    const originalMentions = [
      {
        id: '~malmur-halmex',
        display: '~malmur-halmex',
        start: 0,
        end: 14,
      },
    ];

    // Step 1: text+mentions → content
    const content = textAndMentionsToContent(originalText, originalMentions);

    // Step 2: content → text+mentions
    const firstPass = contentToTextAndMentions(content);

    // Core bug assertions: no double-tilde, correct display and position
    expect(firstPass.mentions).toHaveLength(1);
    expect(firstPass.mentions[0].display).toBe('~malmur-halmex');
    expect(firstPass.mentions[0].id).toBe('~malmur-halmex');
    expect(firstPass.mentions[0].start).toBe(0);
    expect(firstPass.mentions[0].end).toBe(14);
    expect(firstPass.text).not.toContain('~~');
    expect(firstPass.text.slice(0, 14)).toBe('~malmur-halmex');

    // Step 3: text+mentions → content (second round-trip)
    const content2 = textAndMentionsToContent(
      firstPass.text,
      firstPass.mentions
    );

    // Step 4: content → text+mentions (second round-trip)
    const secondPass = contentToTextAndMentions(content2);

    // Verify identical output on both passes (the real round-trip stability check)
    expect(secondPass.text).toBe(firstPass.text);
    expect(secondPass.mentions).toEqual(firstPass.mentions);
  });

  test('mention id without tilde prefix is handled correctly', () => {
    const text = '~zod hello';
    const mentions = [{ id: 'zod', display: '~zod', start: 0, end: 4 }];

    const content = textAndMentionsToContent(text, mentions);
    const result = contentToTextAndMentions(content);

    // The id stored in attrs may or may not have tilde, but display should be correct
    expect(result.mentions[0].display).toBe('~zod');
    expect(result.text.startsWith('~zod')).toBe(true);
    expect(result.text).not.toContain('~~');
  });

  test('multiple mentions have correct positions', () => {
    const text = '~zod and ~bus hello';
    const mentions = [
      { id: '~zod', display: '~zod', start: 0, end: 4 },
      { id: '~bus', display: '~bus', start: 9, end: 13 },
    ];

    const content = textAndMentionsToContent(text, mentions);
    const result = contentToTextAndMentions(content);

    expect(result.mentions).toHaveLength(2);
    expect(
      result.text.slice(result.mentions[0].start, result.mentions[0].end)
    ).toBe('~zod');
    expect(
      result.text.slice(result.mentions[1].start, result.mentions[1].end)
    ).toBe('~bus');
  });
});
