import { describe, expect, it } from 'vitest';

import {
  Finding,
  KnownGap,
  ProtocolBump,
  Report,
  complementsGuard,
  formatReport,
  gapApplies,
  isBlocking,
  markCoveredFallbacks,
  matchBump,
  staleGapsIn,
} from './check';
import { Dependency } from './extract';
import { memoryTree } from './git';
import { loadDesk } from './match';
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

const finding = (over: Partial<Finding> = {}): Finding => ({
  verdict: 'MISSING',
  rule: 'P1',
  reason: '',
  dependency: record('k', 1),
  sites: [{ file: SITE, line: 1 }],
  ...over,
});

describe('isBlocking', () => {
  it('is the one answer to "does this MISSING fail the run?"', () => {
    const gap: KnownGap = { key: 'k', reason: 'debt' };
    expect(isBlocking(finding())).toBe(true);
    expect(isBlocking(finding({ allowed: gap }))).toBe(false);
    expect(isBlocking(finding({ fallback: { coveredBy: 'other' } }))).toBe(
      false
    );
    expect(isBlocking(finding({ verdict: 'FOUND' }))).toBe(false);
    expect(isBlocking(finding({ verdict: 'UNVERIFIED' }))).toBe(false);
  });
});

describe('gapApplies', () => {
  // %ledger serves /x/v1/init and nothing else.
  const SERVES = `
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %init ~]  \`\`noun+!>(~)
  ==
--
`.trim();
  const clientDesk = (app: string) =>
    loadDesk(
      memoryTree({
        'desk/desk.bill': ':~  %ledger\n==\n',
        'desk/app/ledger.hoon': app,
      }),
      'client'
    );
  const dep = (path: string): Dependency => ({
    key: `scry ledger ${path}`,
    surface: 'scry',
    app: 'ledger',
    path: {
      known: path.split('/').filter(Boolean),
      unknownTail: false,
      text: path,
    },
    mark: null,
    thread: null,
    site: { file: SITE, line: 1 },
    text: '',
  });

  it('stands when nothing disproves it', () => {
    // A self-consistency run has no client-side desk to compare against.
    expect(gapApplies(dep('/v1/init'), null, null)).toBe(true);
    expect(gapApplies(dep('/v2/init'), clientDesk(SERVES), new Set())).toBe(
      true
    );
  });

  it('does not excuse a request the client shipped a desk for', () => {
    // /v1/init worked at the client's own baseline, so a gap entry about some
    // older breakage is not about this one — the change under review broke it.
    expect(gapApplies(dep('/v1/init'), clientDesk(SERVES), new Set())).toBe(
      false
    );
  });
});

describe('staleGapsIn', () => {
  const gap = (key: string): KnownGap => ({ key, reason: 'debt' });

  it('names an entry that excused nothing', () => {
    const live = gap('live');
    const dead = gap('dead');
    expect(
      staleGapsIn([live, dead], [finding({ allowed: live })]).map((g) => g.key)
    ).toEqual(['dead']);
  });

  it('keeps quiet when every entry did its job', () => {
    const live = gap('live');
    expect(staleGapsIn([live], [finding({ allowed: live })])).toEqual([]);
  });
});

const report = (over: Partial<Report> = {}): Report => ({
  clientRef: 'worktree',
  deskRef: 'v12.2.0',
  protocolDifferences: [],
  allowedBumps: [],
  staleBumps: [],
  staleGaps: [],
  findings: [],
  counts: { found: 0, missing: 0, unverified: 0, allowed: 0, fallback: 0 },
  ...over,
});

describe('formatReport', () => {
  it('does not claim the desks agree when a bump is being allowed through', () => {
    const plain = formatReport(report());
    expect(plain).toContain('negotiation protocols: no version difference');

    const bumped = formatReport(
      report({ allowedBumps: [{ difference: difference(), bump: bump() }] })
    );
    expect(bumped).toContain(
      'negotiation protocols: no blocking protocol difference'
    );
    expect(bumped).not.toContain('no version difference');
    expect(bumped).toContain('ALLOWED PROTOCOL BUMP');
  });

  it('warns about a gap entry that excused nothing', () => {
    const text = formatReport(
      report({
        staleGaps: [
          { key: 'subscribe groups /chan/{}', reason: 'debt', issue: 'TLON-1' },
        ],
      })
    );
    expect(text).toContain(
      'warning: known-gaps.json still excuses subscribe groups /chan/{} (TLON-1)'
    );
  });
});
