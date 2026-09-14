import { describe, expect, it } from 'vitest';

import {
  Finding,
  KnownGap,
  ProtocolBump,
  Report,
  classify,
  exitCodeFor,
  formatReport,
  isBlocking,
  isCapabilityGuard,
  markdownReport,
  matchBump,
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
    // Candidate vs N-1 sees new/old; released-client vs candidate sees old/new.
    expect(matchBump(difference(), [bump()])).toBeDefined();
    expect(
      matchBump(difference({ clientDeskVersions: ['2'], n1Versions: ['3'] }), [
        bump(),
      ])
    ).toBeDefined();
  });

  it('excuses only that one pair of versions, on that one protocol', () => {
    expect(
      matchBump(difference({ n1Versions: ['1'] }), [bump()])
    ).toBeUndefined();
    expect(
      matchBump(difference({ clientDeskVersions: ['4'] }), [bump()])
    ).toBeUndefined();
    expect(
      matchBump(difference({ protocol: 'channels' }), [bump()])
    ).toBeUndefined();
    expect(matchBump(difference({ agent: 'chat' }), [bump()])).toBeUndefined();
  });
});

describe('the GUARDED rule', () => {
  it('recognises a guard that names what the desk supports', () => {
    for (const guard of [
      'getActivitySupportsNotes()',
      'getActivitySupportsNotes() ? …',
      'activityVersionSupportsNotes',
      'groupsVersionSupportsNotesSearch',
      'REACTIONS_MIN_GROUPS_VERSION',
      '! (groupsVersion)',
    ]) {
      expect(isCapabilityGuard(guard)).toBe(true);
    }
  });

  it('rejects a branch that is about the situation, not the desk', () => {
    // chatAction picks a mark by conversation kind. Its club branch being
    // served says nothing about whether a DM request works on N-1.
    for (const guard of [
      'whomIsDm(whom)',
      "type === 'channel' ? …",
      'count && count > 0',
      undefined,
    ]) {
      expect(isCapabilityGuard(guard)).toBe(false);
    }
  });

  it('turns a MISSING behind a capability guard into GUARDED, and only that', () => {
    const desk = loadDesk(
      memoryTree({
        'desk/desk.bill': ':~  %activity\n==\n',
        'desk/app/activity.hoon':
          '|_  =bowl:gall\n++  on-peek\n  |=  =path\n  ?+  path  [~ ~]\n    [%x %v4 ~]  ~\n  ==\n--\n',
        'peru.yaml': '',
      }),
      'test'
    );
    const dep = (guard?: string): Dependency => ({
      key: 'scry activity /v6',
      surface: 'scry',
      app: 'activity',
      path: { known: ['v6'], unknownTail: false, text: "'/v6'" },
      mark: null,
      thread: null,
      site: { file: 'a.ts', line: 1 },
      text: '',
      guard,
    });
    expect(classify(dep(), desk, new Set()).verdict).toBe('MISSING');
    expect(
      classify(dep('getActivitySupportsNotes() ? …'), desk, new Set()).verdict
    ).toBe('GUARDED');
    // A situational guard still blocks.
    expect(classify(dep('whomIsDm(whom)'), desk, new Set()).verdict).toBe(
      'MISSING'
    );
    // And a request that matched is untouched by any guard.
    const matched = { ...dep('getActivitySupportsNotes()') };
    matched.path = { known: ['v4'], unknownTail: false, text: "'/v4'" };
    expect(classify(matched, desk, new Set()).verdict).toBe('MATCHED');
  });
});

const SITE = { file: 'packages/api/src/client/activityApi.ts', line: 28 };

const finding = (over: Partial<Finding> = {}): Finding => ({
  verdict: 'MISSING',
  rule: 'prefix',
  reason: 'no peek arm in %activity can match /x/v6',
  dependency: {
    key: 'scry activity /v6',
    surface: 'scry',
    app: 'activity',
    path: { known: ['v6'], unknownTail: false, text: "'/v6'" },
    mark: null,
    thread: null,
    site: SITE,
    text: '',
  },
  sites: [SITE],
  ...over,
});

const report = (over: Partial<Report> = {}): Report => ({
  clientRef: 'worktree',
  deskRef: 'v12.2.0',
  protocolDifferences: [],
  allowedBumps: [],
  staleBumps: [],
  staleGaps: [],
  findings: [],
  counts: {
    matched: 0,
    wildcard: 0,
    missing: 0,
    guarded: 0,
    unverified: 0,
    allowed: 0,
  },
  ...over,
});

describe('what fails the run', () => {
  it('is MISSING, and a protocol difference — nothing else', () => {
    const gap: KnownGap = { key: 'k', reason: 'debt' };
    expect(isBlocking(finding())).toBe(true);
    expect(isBlocking(finding({ allowed: gap }))).toBe(false);
    for (const verdict of [
      'MATCHED',
      'WILDCARD',
      'UNVERIFIED',
      'GUARDED',
    ] as const)
      expect(isBlocking(finding({ verdict }))).toBe(false);

    expect(exitCodeFor(report({ findings: [finding()] }))).toBe(1);
    expect(
      exitCodeFor(report({ findings: [finding({ verdict: 'GUARDED' })] }))
    ).toBe(0);
    expect(exitCodeFor(report({ protocolDifferences: [difference()] }))).toBe(
      1
    );
    // An allowed bump is printed loudly and excluded from the exit code.
    expect(
      exitCodeFor(
        report({ allowedBumps: [{ difference: difference(), bump: bump() }] })
      )
    ).toBe(0);
  });
});

describe('the reports', () => {
  const filled = report({
    findings: [
      finding(),
      finding({
        verdict: 'GUARDED',
        dependency: {
          ...finding().dependency,
          key: 'scry activity /v6/volume-settings',
          guard: 'getActivitySupportsNotes() ? …',
        },
        excerpt: ['  ?+  path  [~ ~]'],
        source: { file: 'desk/app/activity.hoon', line: 425 },
      }),
    ],
    counts: {
      matched: 3,
      wildcard: 1,
      missing: 1,
      guarded: 1,
      unverified: 2,
      allowed: 0,
    },
  });

  it('says in both formats that MATCHED is not a promise', () => {
    expect(formatReport(filled)).toContain('not a promise');
    expect(markdownReport(filled)).toContain('not that the agent answers');
  });

  it('gives every section its own heading, with the guard and the sites', () => {
    const md = markdownReport(filled);
    expect(md).toContain('#### MISSING (1)');
    expect(md).toContain('#### GUARDED (1)');
    expect(md).toContain('`getActivitySupportsNotes() ? …`');
    expect(md).toContain('`packages/api/src/client/activityApi.ts:28`');
    // The arm or dispatcher the verdict turned on, quoted.
    expect(md).toContain('`desk/app/activity.hoon:425`');
    expect(md).toContain('```hoon');
  });

  it('warns about an entry that excused nothing, in both files', () => {
    const stale = formatReport(
      report({
        staleGaps: [{ key: 'scry groups /gone', reason: 'debt' }],
        staleBumps: [bump()],
      })
    );
    expect(stale).toContain(
      'known-gaps entry "scry groups /gone" excused nothing'
    );
    expect(stale).toContain('protocolBumps entry %groups');
  });
});
