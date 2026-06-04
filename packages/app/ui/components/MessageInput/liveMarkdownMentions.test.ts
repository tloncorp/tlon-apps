import { describe, expect, it } from 'vitest';

import {
  Mention,
  canonicalText,
  decodeWhitespaceEntities,
  extractMentionsFromSentinelText,
  injectInlinesIntoStory,
  mentionsToRanges,
  replaceMentionSpansWithSentinels,
  sentinelizeStory,
  updateMentions,
} from './liveMarkdownMentions';

describe('decodeWhitespaceEntities', () => {
  it('decodes space, tab, and nbsp numeric entities', () => {
    expect(decodeWhitespaceEntities('&#x20;leading')).toBe(' leading');
    expect(decodeWhitespaceEntities('&#32;x')).toBe(' x');
    expect(decodeWhitespaceEntities('a&#x09;b')).toBe('a\tb');
    expect(decodeWhitespaceEntities('a&#xa0;b')).toBe('a b');
  });

  it('leaves non-whitespace entities intact', () => {
    // &#x3c; = '<', &#38; = '&' — markdown-significant, must not be decoded
    expect(decodeWhitespaceEntities('&#x3c;tag&#x3e; &#38;')).toBe(
      '&#x3c;tag&#x3e; &#38;'
    );
  });

  it('is a no-op for normal text', () => {
    expect(decodeWhitespaceEntities('# Heading with no entities')).toBe(
      '# Heading with no entities'
    );
  });
});

describe('canonicalText', () => {
  it('formats ship, role, and all mentions', () => {
    expect(canonicalText({ ship: 'finned-palmer' })).toBe('~finned-palmer');
    expect(canonicalText({ ship: '~zod' })).toBe('~zod');
    expect(canonicalText({ sect: null })).toBe('@all');
    expect(canonicalText({ sect: 'admin' })).toBe('@admin');
  });
});

describe('mentionsToRanges', () => {
  it('maps ship to mention-user and sect to mention-here', () => {
    const mentions: Mention[] = [
      { start: 0, length: 4, inline: { ship: 'zod' } },
      { start: 5, length: 4, inline: { sect: null } },
    ];
    expect(mentionsToRanges(mentions)).toEqual([
      { type: 'mention-user', start: 0, length: 4 },
      { type: 'mention-here', start: 5, length: 4 },
    ]);
  });
});

describe('updateMentions', () => {
  // "~zod" at index 5 of "ping ~zod"
  const base: Mention[] = [{ start: 5, length: 4, inline: { ship: 'zod' } }];

  it('shifts a mention when text is inserted before it', () => {
    expect(updateMentions(base, 'ping ~zod', 'hello ping ~zod')).toEqual([
      { start: 11, length: 4, inline: { ship: 'zod' } },
    ]);
  });

  it('leaves a mention unchanged when text is appended after it', () => {
    expect(updateMentions(base, 'ping ~zod', 'ping ~zod!!!')).toEqual(base);
  });

  it('drops a mention when its span is edited', () => {
    expect(updateMentions(base, 'ping ~zod', 'ping ~zix')).toEqual([]);
  });

  it('drops a mention when it is deleted', () => {
    expect(updateMentions(base, 'ping ~zod', 'ping ')).toEqual([]);
  });
});

describe('sentinel round-trips (no markdown involved)', () => {
  it('sentinelizeStory then injectInlinesIntoStory reconstructs the story', () => {
    const story = [
      { inline: ['hi ', { ship: 'finned-palmer' }, ' and ', { sect: null }] },
    ];
    const { story: sentineled, inlines } = sentinelizeStory(story);
    expect(injectInlinesIntoStory(sentineled, inlines)).toEqual(story);
  });

  it('replace then extract reconstructs text and records spans', () => {
    const text = 'hi ~finned-palmer and @all';
    const mentions: Mention[] = [
      { start: 3, length: 14, inline: { ship: 'finned-palmer' } },
      { start: 22, length: 4, inline: { sect: null } },
    ];
    const { text: sentinelText, inlines } = replaceMentionSpansWithSentinels(
      text,
      mentions
    );
    const result = extractMentionsFromSentinelText(sentinelText, inlines);
    expect(result.text).toBe(text);
    // extract records the canonical text as `display` when no resolver is given
    expect(result.mentions).toEqual([
      {
        start: 3,
        length: 14,
        inline: { ship: 'finned-palmer' },
        display: '~finned-palmer',
      },
      { start: 22, length: 4, inline: { sect: null }, display: '@all' },
    ]);
  });

  it('extract uses a displayFor resolver (e.g. nicknames) for the text', () => {
    const text = 'hi ~finned-palmer';
    const { text: sentinelText, inlines } = replaceMentionSpansWithSentinels(
      text,
      [{ start: 3, length: 14, inline: { ship: 'finned-palmer' } }]
    );
    const result = extractMentionsFromSentinelText(
      sentinelText,
      inlines,
      () => 'Charles Vinette'
    );
    expect(result.text).toBe('hi Charles Vinette');
    expect(result.mentions).toEqual([
      {
        start: 3,
        length: 15,
        inline: { ship: 'finned-palmer' },
        display: 'Charles Vinette',
      },
    ]);
  });

  it('updateMentions verifies against the display text (nickname)', () => {
    const base: Mention[] = [
      {
        start: 5,
        length: 15,
        inline: { ship: 'finned-palmer' },
        display: 'Charles Vinette',
      },
    ];
    // shift when text inserted before the nickname span
    expect(
      updateMentions(base, 'ping Charles Vinette', 'hello ping Charles Vinette')
    ).toEqual([
      {
        start: 11,
        length: 15,
        inline: { ship: 'finned-palmer' },
        display: 'Charles Vinette',
      },
    ]);
    // drop when the nickname span is edited
    expect(
      updateMentions(base, 'ping Charles Vinette', 'ping Charles Smith X')
    ).toEqual([]);
  });
});
