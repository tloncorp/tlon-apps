import { describe, expect, test } from 'vitest';

import {
  ChatSearchCandidate,
  hasAllChatSearchTokens,
  normalizeChatSearchString,
  rankChatSearchCandidates,
  scoreChatSearchCandidate,
  tokenizeChatSearchQuery,
} from './chatSearchRanking';

function makeCandidate(
  overrides: Partial<ChatSearchCandidate> = {}
): ChatSearchCandidate {
  const title = overrides.title ?? 'general';
  const groupTitle = overrides.groupTitle ?? 'tlon';
  const id = overrides.id ?? 'chat/~dabben-larbet/general';

  return {
    id,
    title,
    groupTitle,
    combined: overrides.combined ?? `${title} ${groupTitle} ${id}`,
    timestamp: overrides.timestamp ?? 0,
  };
}

describe('chatSearchRanking helpers', () => {
  test('normalizes and tokenizes search query', () => {
    expect(normalizeChatSearchString('  TlóN   Général  ')).toBe(
      'tlon   general'
    );
    expect(tokenizeChatSearchQuery('  TlóN   Général  ')).toEqual([
      'tlon',
      'general',
    ]);
  });

  test('requires all tokens to match across channel/group/id fields', () => {
    const candidate = makeCandidate({ title: 'general', groupTitle: 'tlon' });

    expect(hasAllChatSearchTokens(candidate, ['tlon', 'general'])).toBe(
      true
    );
    expect(hasAllChatSearchTokens(candidate, ['tlon', 'random'])).toBe(
      false
    );
  });

  test('prefers split group+channel match over loose fuzzy alternatives', () => {
    const tokens = tokenizeChatSearchQuery('tlon general');
    const normalizedQuery = normalizeChatSearchString('tlon general');

    const splitMatch = makeCandidate({
      id: 'chat/~dabben-larbet/general',
      title: 'general',
      groupTitle: 'tlon',
      combined: 'general tlon chat/~dabben-larbet/general',
      timestamp: 10,
    });

    const titleOnlyMatch = makeCandidate({
      id: 'chat/~other/tlon-general',
      title: 'tlon general',
      groupTitle: 'announcements',
      combined: 'tlon general announcements chat/~other/tlon-general',
      timestamp: 20,
    });

    expect(
      scoreChatSearchCandidate(splitMatch, tokens, normalizedQuery)
    ).toBeGreaterThan(
      scoreChatSearchCandidate(titleOnlyMatch, tokens, normalizedQuery)
    );

    const ranked = rankChatSearchCandidates(
      [titleOnlyMatch, splitMatch],
      tokens,
      normalizedQuery,
      new Map([
        [titleOnlyMatch.id, { rank: 0, score: 0.01 }],
        [splitMatch.id, { rank: 1, score: 0.2 }],
      ])
    );

    expect(ranked[0].id).toBe(splitMatch.id);
  });
});
