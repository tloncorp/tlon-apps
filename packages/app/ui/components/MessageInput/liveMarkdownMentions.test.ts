import { describe, expect, it } from 'vitest';

import {
  Mention,
  canonicalText,
  extractMentionsFromSentinelText,
  injectInlinesIntoStory,
  mentionsToRanges,
  replaceMentionSpansWithSentinels,
  sentinelizeStory,
  updateMentions,
} from './liveMarkdownMentions';

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
    expect(result.mentions).toEqual(mentions);
  });
});
