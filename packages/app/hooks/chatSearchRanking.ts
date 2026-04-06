export type ChatSearchCandidate = {
  id: string;
  title: string;
  groupTitle: string;
  combined: string;
  timestamp: number;
};

export type ChatSearchFuzzyScore = {
  rank: number;
  score: number;
};

export function normalizeChatSearchString(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function tokenizeChatSearchQuery(query: string): string[] {
  return normalizeChatSearchString(query)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function hasAllChatSearchTokens(
  candidate: ChatSearchCandidate,
  tokens: string[]
): boolean {
  if (tokens.length === 0) {
    return false;
  }

  return tokens.every(
    (token) =>
      candidate.title.includes(token) ||
      candidate.groupTitle.includes(token) ||
      candidate.id.includes(token)
  );
}

function tokenPresenceScore(
  value: string,
  token: string,
  weights: {
    exact: number;
    prefix: number;
    contains: number;
  }
): number {
  if (!value || !value.includes(token)) {
    return 0;
  }

  if (value === token) {
    return weights.exact;
  }

  if (value.startsWith(token) || value.includes(` ${token}`)) {
    return weights.prefix;
  }

  return weights.contains;
}

export function scoreChatSearchCandidate(
  candidate: ChatSearchCandidate,
  tokens: string[],
  normalizedQuery: string
): number {
  let score = 0;

  for (const token of tokens) {
    score += tokenPresenceScore(candidate.title, token, {
      exact: 120,
      prefix: 90,
      contains: 40,
    });
    score += tokenPresenceScore(candidate.groupTitle, token, {
      exact: 80,
      prefix: 60,
      contains: 24,
    });
    score += tokenPresenceScore(candidate.id, token, {
      exact: 28,
      prefix: 20,
      contains: 10,
    });
  }

  if (tokens.length > 1) {
    const hasTitleToken = tokens.some((token) =>
      candidate.title.includes(token)
    );
    const hasGroupToken = tokens.some((token) =>
      candidate.groupTitle.includes(token)
    );

    if (hasTitleToken && hasGroupToken) {
      score += 55;
    }
  }

  if (
    normalizedQuery.length > 0 &&
    candidate.combined.includes(normalizedQuery)
  ) {
    score += 25;
  }

  return score;
}

export function rankChatSearchCandidates<T extends ChatSearchCandidate>(
  candidates: T[],
  tokens: string[],
  normalizedQuery: string,
  fuzzyScores: Map<string, ChatSearchFuzzyScore>
): T[] {
  const scored = candidates.map((candidate) => ({
    candidate,
    score: scoreChatSearchCandidate(candidate, tokens, normalizedQuery),
    fuzzy: fuzzyScores.get(candidate.id),
  }));

  scored.sort((a, b) => {
    const scoreDifference = b.score - a.score;
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const fuzzyScoreDifference =
      (a.fuzzy?.score ?? Number.POSITIVE_INFINITY) -
      (b.fuzzy?.score ?? Number.POSITIVE_INFINITY);

    if (fuzzyScoreDifference !== 0) {
      return fuzzyScoreDifference;
    }

    const fuzzyRankDifference =
      (a.fuzzy?.rank ?? Number.MAX_SAFE_INTEGER) -
      (b.fuzzy?.rank ?? Number.MAX_SAFE_INTEGER);

    if (fuzzyRankDifference !== 0) {
      return fuzzyRankDifference;
    }

    return b.candidate.timestamp - a.candidate.timestamp;
  });

  return scored.map((entry) => entry.candidate);
}
