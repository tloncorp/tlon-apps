import { describe, expect, it } from 'vitest';

import { findMentionRanges } from './mentionMarkdownRanges';

const SHIPS = ['~zod', '~bus', '~sampel-palnet', '~finned-palmer'];
const ROLES = ['admin', 'member'];

describe('findMentionRanges', () => {
  it('highlights a ship that is a known member', () => {
    expect(findMentionRanges('hi ~zod', SHIPS, ROLES)).toEqual([
      { type: 'mention-user', start: 3, length: 4 },
    ]);
  });

  it('does not highlight a ship that is not a member', () => {
    expect(findMentionRanges('hi ~zod', [], ROLES)).toEqual([]);
  });

  it('highlights multiple member ships', () => {
    expect(findMentionRanges('~zod and ~bus', SHIPS, ROLES)).toEqual([
      { type: 'mention-user', start: 0, length: 4 },
      { type: 'mention-user', start: 9, length: 4 },
    ]);
  });

  it('highlights a member planet ship with syllable groups', () => {
    expect(findMentionRanges('~sampel-palnet', SHIPS, ROLES)).toEqual([
      { type: 'mention-user', start: 0, length: 14 },
    ]);
  });

  it('highlights @all only when it is in the valid list', () => {
    expect(findMentionRanges('ping @all', [], ['all'])).toEqual([
      { type: 'mention-here', start: 5, length: 4 },
    ]);
    expect(findMentionRanges('ping @all', [], [])).toEqual([]);
  });

  it('highlights @role only when it is a real role', () => {
    expect(findMentionRanges('ping @admin', [], ['admin'])).toEqual([
      { type: 'mention-here', start: 5, length: 6 },
    ]);
    expect(findMentionRanges('ping @admin', [], [])).toEqual([]);
  });

  it('does not highlight an @word that is not a real role', () => {
    expect(findMentionRanges('ping @randomword', SHIPS, ROLES)).toEqual([]);
  });

  it('ignores @ inside an email-like token even if it matches a role', () => {
    expect(findMentionRanges('mail me at foo@bar', SHIPS, ['bar'])).toEqual([]);
  });

  it('highlights a group mention wrapped in punctuation', () => {
    expect(findMentionRanges('(@all)', [], ['all'])).toEqual([
      { type: 'mention-here', start: 1, length: 4 },
    ]);
  });

  it('returns ranges sorted by start across both kinds', () => {
    expect(findMentionRanges('@all ~zod', SHIPS, ['all'])).toEqual([
      { type: 'mention-here', start: 0, length: 4 },
      { type: 'mention-user', start: 5, length: 4 },
    ]);
  });

  it('returns nothing for plain text', () => {
    expect(findMentionRanges('just some text', SHIPS, ROLES)).toEqual([]);
  });
});
