import { Tree } from './git';
import { Desk, MatchResult } from './match';

/**
 * Marks vendored from upstream, read off `peru.yaml`'s pick lists.
 *
 * Ownership is decided by **exclusion**: everything under `desk/mar` that is
 * not on a pick list and is not an out-of-desk app is repo-owned by
 * construction. The obvious alternative — "a mark is ours if it resolves at
 * either ref of the pair" — is self-defeating for the removal case, because
 * deleting the mar file also erases the proof we ever owned the mark, and a
 * real removal PR must delete the backend references too or the desk will not
 * build.
 */
export function vendoredMarks(peruYaml: string): Set<string> {
  return new Set(
    Array.from(
      peruYaml.matchAll(/^\s*-\s+\S*mar\/([A-Za-z0-9_/-]+)\.hoon\s*$/gm)
    ).map((m) => m[1].split('/').join('-'))
  );
}

export function loadOwnership(tree: Tree): Set<string> {
  const peru = tree.readFile('peru.yaml');
  return peru === null ? new Set() : vendoredMarks(peru);
}

/**
 * Every file path Clay would consider for a name. `%a-b-c` may live at any
 * hyphen grouping — `mar/group/action-5.hoon`, `mar/chat/club/action-2.hoon`,
 * `mar/invite-decline.hoon` — so every subset of the hyphens is a candidate
 * directory split.
 */
export function markCandidates(mark: string): string[] {
  const parts = mark.split('-');
  const out: string[] = [];
  for (let mask = 0; mask < 1 << Math.min(parts.length - 1, 12); mask++) {
    const segments = [parts[0]];
    for (let i = 1; i < parts.length; i++) {
      if (mask & (1 << (i - 1))) segments.push(parts[i]);
      else segments[segments.length - 1] += `-${parts[i]}`;
    }
    out.push(`desk/mar/${segments.join('/')}.hoon`);
  }
  return [...new Set(out)];
}

export function matchMark(
  desk: Desk,
  vendored: Set<string>,
  app: string | null,
  mark: string | null
): MatchResult {
  const unverified = (reason: string): MatchResult => ({
    verdict: 'UNVERIFIED',
    rule: 'marks',
    reason,
  });
  if (mark === null)
    return unverified('mark could not be resolved to a string literal');
  // A deleted agent cannot accept any mark, however many mar files survive it.
  // Checking before the file lookup is the point: a leftover mar would
  // otherwise report FOUND for a poke that now crashes.
  if (app !== null && !desk.hasApp(app) && desk.clientHadApp(app)) {
    return {
      verdict: 'MISSING',
      rule: 'marks',
      reason: `%${app} is no longer an agent in this desk, but the client still pokes it`,
      evidence: `desk/app/${app}.hoon (removed)`,
      failureMode: 'crash',
    };
  }
  // Dropping the name from desk.bill stops the agent while leaving its source
  // — and its marks — in place, so this too must beat the mar file lookup.
  if (app !== null && !desk.bill.has(app) && desk.clientBilled(app)) {
    return {
      verdict: 'MISSING',
      rule: 'marks',
      reason: `%${app} is no longer listed in desk/desk.bill, so it does not run`,
      evidence: 'desk/desk.bill (removed)',
      failureMode: 'not-running',
    };
  }
  const candidates = markCandidates(mark);
  const hit = candidates.find((c) => desk.marFiles.has(c));
  // FOUND for a mark claims only that the file exists — not that the agent
  // accepts it, and nothing about the JSON shape.
  if (hit) {
    return {
      verdict: 'FOUND',
      rule: 'marks',
      reason: 'mark file present',
      evidence: hit,
    };
  }
  if (vendored.has(mark)) {
    return unverified(
      `%${mark} is vendored by peru into desk-deps/, which is not in the repo tree`
    );
  }
  if (app !== null && !desk.hasApp(app)) {
    return unverified(
      `%${mark} targets %${app}, which is not an agent in this desk`
    );
  }
  if (app !== null && !desk.bill.has(app)) {
    return unverified(
      `%${mark} targets %${app}, which is not listed in desk/desk.bill`
    );
  }
  return {
    verdict: 'MISSING',
    rule: 'marks',
    reason: `no mar file for %${mark} (repo-owned by exclusion from peru.yaml)`,
    evidence: candidates.slice(0, 4).join(', '),
    failureMode: 'crash',
  };
}
