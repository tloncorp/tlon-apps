import { describe, expect, it } from 'vitest';

import {
  Finding,
  ProtocolBump,
  complementsGuard,
  markCoveredFallbacks,
  matchBump,
} from './check';
import { Dependency } from './extract';
import { ProtocolDifference } from './negotiate';

const difference = (
  over: Partial<ProtocolDifference> = {}
): ProtocolDifference => ({
  agent: 'groups',
  protocol: 'groups',
  clientDeskVersions: ['3'],
  n1Versions: ['2'],
  ...over,
});

const bump = (over: Partial<ProtocolBump> = {}): ProtocolBump => ({
  agent: 'groups',
  protocol: 'groups',
  from: '2',
  to: '3',
  issue: 'TLON-0000',
  ...over,
});

describe('matchBump', () => {
  it('matches the transition in either direction', () => {
    // candidate vs N-1 sees new/old; released-client vs candidate sees old/new.
    expect(matchBump(difference(), [bump()])).toBeDefined();
    expect(
      matchBump(difference({ clientDeskVersions: ['2'], n1Versions: ['3'] }), [
        bump(),
      ])
    ).toBeDefined();
  });

  it('matches nothing else', () => {
    // A bump entry is permission for one pair of versions, not for a protocol.
    for (const other of [
      difference({ clientDeskVersions: ['4'] }),
      difference({ n1Versions: ['1'] }),
      difference({ clientDeskVersions: ['3'], n1Versions: ['3'] }),
      difference({ agent: 'chat' }),
      difference({ protocol: 'chat-dms' }),
    ]) {
      expect(matchBump(other, [bump()])).toBeUndefined();
    }
    // A swapped entry describes a different transition, in either orientation.
    expect(
      matchBump(difference({ n1Versions: ['1'] }), [
        bump({ from: '1', to: '4' }),
      ])
    ).toBeUndefined();
    expect(matchBump(difference(), [])).toBeUndefined();
  });
});

describe('complementsGuard', () => {
  it('accepts the complementary branch of a capability guard', () => {
    const notes = 'getActivitySupportsNotes()';
    expect(complementsGuard(notes, `! (${notes})`)).toBe(true);
    expect(complementsGuard(`${notes} ? …`, `! (${notes})`)).toBe(true);
    // activityAction's third mark: `!A && !R` still complements `A`.
    expect(
      complementsGuard(notes, `! (${notes}) && ! (supportsReactions)`)
    ).toBe(true);
    expect(
      complementsGuard(
        'REACTIONS_MIN_GROUPS_VERSION',
        '! (REACTIONS_MIN_GROUPS_VERSION)'
      )
    ).toBe(true);
  });

  it('rejects a branch that is not about what the desk supports', () => {
    // chatAction picks a mark by conversation kind. Its club branch being
    // served says nothing about whether a DM request works on N-1.
    expect(complementsGuard('whomIsDm(whom)', '! (whomIsDm(whom))')).toBe(
      false
    );
    expect(
      complementsGuard("type === 'channel' ? …", "! (type === 'channel')")
    ).toBe(false);
    expect(
      complementsGuard('count && count > 0 ? …', '! (count && count > 0)')
    ).toBe(false);
  });

  it('rejects a sibling that is not the complementary branch', () => {
    const notes = 'getActivitySupportsNotes()';
    expect(complementsGuard(notes, notes)).toBe(false);
    expect(complementsGuard(notes, '! (somethingElse())')).toBe(false);
    expect(complementsGuard(notes, undefined)).toBe(false);
    expect(complementsGuard(undefined, `! (${notes})`)).toBe(false);
  });
});

const SITE = 'packages/api/src/client/activityApi.ts';
const NOTES = 'getActivitySupportsNotes()';

function record(key: string, line: number, guard?: string): Dependency {
  return {
    key,
    surface: 'poke',
    app: 'activity',
    path: null,
    mark: null,
    thread: null,
    site: { file: SITE, line },
    text: '',
    guard,
  };
}

function build(
  rows: { key: string; verdict: Finding['verdict']; records: Dependency[] }[]
) {
  const grouped = new Map(rows.map((r) => [r.key, r.records]));
  const findings: Finding[] = rows.map((r) => ({
    verdict: r.verdict,
    rule: 'P1',
    reason: '',
    sites: r.records.map((d) => d.site),
    dependency: r.records[0],
  }));
  markCoveredFallbacks(findings, grouped);
  return findings;
}

describe('markCoveredFallbacks', () => {
  it('covers a capability branch whose complement is served at that site', () => {
    const [missing] = build([
      { key: 'new', verdict: 'MISSING', records: [record('new', 28, NOTES)] },
      {
        key: 'old',
        verdict: 'FOUND',
        records: [record('old', 28, `! (${NOTES})`)],
      },
    ]);
    expect(missing.fallback).toEqual({ coveredBy: 'old', guard: NOTES });
  });

  it('does not cover a branch on anything but a capability', () => {
    const [missing] = build([
      {
        key: 'dm',
        verdict: 'MISSING',
        records: [record('dm', 28, 'whomIsDm(whom)')],
      },
      {
        key: 'club',
        verdict: 'FOUND',
        records: [record('club', 28, '! (whomIsDm(whom))')],
      },
    ]);
    expect(missing.fallback).toBeUndefined();
    expect(missing.coverage).toBeUndefined();
  });

  it('covers a request only when every site that would miss is covered', () => {
    // The same request, guarded at one call site and unconditional at another.
    const [missing] = build([
      {
        key: 'new',
        verdict: 'MISSING',
        records: [record('new', 28, NOTES), record('new', 99)],
      },
      {
        key: 'old',
        verdict: 'FOUND',
        records: [record('old', 28, `! (${NOTES})`)],
      },
    ]);
    expect(missing.fallback).toBeUndefined();
    expect(missing.coverage).toEqual({
      covered: [{ file: SITE, line: 28 }],
      blocking: [{ file: SITE, line: 99 }],
    });
  });

  it('does not cover a branch served only at some other call site', () => {
    const [missing] = build([
      { key: 'new', verdict: 'MISSING', records: [record('new', 28, NOTES)] },
      {
        key: 'old',
        verdict: 'FOUND',
        records: [record('old', 99, `! (${NOTES})`)],
      },
    ]);
    expect(missing.fallback).toBeUndefined();
  });
});
