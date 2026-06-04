import { describe, expect, it } from 'vitest';

import { findMentionRanges } from './mentionMarkdownRanges';

describe('findMentionRanges', () => {
  it('detects a bare ship mention as mention-user', () => {
    expect(findMentionRanges('hi ~zod')).toEqual([
      { type: 'mention-user', start: 3, length: 4 },
    ]);
  });

  it('detects multiple ships on a line', () => {
    expect(findMentionRanges('~zod and ~bus')).toEqual([
      { type: 'mention-user', start: 0, length: 4 },
      { type: 'mention-user', start: 9, length: 4 },
    ]);
  });

  it('detects a planet ship with syllable groups', () => {
    expect(findMentionRanges('~sampel-palnet')).toEqual([
      { type: 'mention-user', start: 0, length: 14 },
    ]);
  });

  it('detects @all and @role as mention-here', () => {
    expect(findMentionRanges('ping @all and @admin')).toEqual([
      { type: 'mention-here', start: 5, length: 4 },
      { type: 'mention-here', start: 14, length: 6 },
    ]);
  });

  it('ignores @ inside an email-like token', () => {
    expect(findMentionRanges('mail me at foo@bar')).toEqual([]);
  });

  it('detects a group mention wrapped in punctuation', () => {
    expect(findMentionRanges('(@all)')).toEqual([
      { type: 'mention-here', start: 1, length: 4 },
    ]);
  });

  it('returns ranges sorted by start across both kinds', () => {
    expect(findMentionRanges('@all ~zod')).toEqual([
      { type: 'mention-here', start: 0, length: 4 },
      { type: 'mention-user', start: 5, length: 4 },
    ]);
  });

  it('returns nothing for plain text', () => {
    expect(findMentionRanges('just some text')).toEqual([]);
  });
});
