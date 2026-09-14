import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  Finding,
  KnownGap,
  ProtocolBump,
  Report,
  classify,
  exemptionFor,
  exitCodeFor,
  runCheck,
  formatReport,
  isBlocking,
  isCapabilityGuard,
  markdownReport,
  missingKeys,
  matchBump,
  staleGapsFor,
} from './check';
import { Dependency } from './extract';
import { memoryTree } from './git';
import { loadDesk } from './match';
import { ProtocolDifference } from './negotiate';

const difference = (
  over: Partial<ProtocolDifference> = {}
): ProtocolDifference => ({
  agent: 'groups',
  peer: 'groups',
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

  it('excuses nothing within one tree, whatever the versions say', () => {
    // An exposure raised without its local consumers is an inconsistency the
    // candidate's own agents would reject each other over. A cross-release
    // entry describes a transition; inside one tree there is none to be
    // mid-way through.
    expect(matchBump(difference(), [bump()], true)).toBeUndefined();
    expect(matchBump(difference(), [bump()], false)).toBeDefined();
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

  it('turns a MISSING behind a capability guard into GUARDED, and only that', () => {
    expect(classify([dep()], desk, new Set()).verdict).toBe('MISSING');
    expect(
      classify([dep('getActivitySupportsNotes() ? …')], desk, new Set()).verdict
    ).toBe('GUARDED');
    // A situational guard still blocks.
    expect(classify([dep('whomIsDm(whom)')], desk, new Set()).verdict).toBe(
      'MISSING'
    );
    // And a request that matched is untouched by any guard.
    const matched = { ...dep('getActivitySupportsNotes()') };
    matched.path = { known: ['v4'], unknownTail: false, text: "'/v4'" };
    expect(classify([matched], desk, new Set()).verdict).toBe('MATCHED');
  });

  it('is decided over every occurrence, not whichever came first', () => {
    // The same request, guarded at one call site and sent bare at another. The
    // bare one is what reaches an N-1 desk, so the request still blocks — and
    // the verdict must not depend on which site the extractor saw first.
    const guarded = dep('getActivitySupportsNotes() ? …');
    const bare = { ...dep(), site: { file: 'b.ts', line: 9 } };
    for (const group of [
      [guarded, bare],
      [bare, guarded],
    ]) {
      const result = classify(group, desk, new Set());
      expect(result.verdict).toBe('MISSING');
      expect(result.coverage).toEqual({
        guarded: [guarded.site],
        blocking: [bare.site],
      });
    }
    // Guarded everywhere is still GUARDED, and carries no split.
    const both = classify([guarded, { ...guarded }], desk, new Set());
    expect(both.verdict).toBe('GUARDED');
    expect(both.coverage).toBeUndefined();
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
  selfCheck: false,
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

describe('reporting an entry that excused nothing', () => {
  const entry: KnownGap = { key: 'subscribe groups /chan/{}', reason: 'debt' };
  const unused = new Set<string>();

  it('is said only by the run against the release this client supports', () => {
    expect(staleGapsFor('v12.2.0', [entry], unused, 'v12.2.0')).toEqual([
      entry,
    ]);
    // The candidate's own desk may have fixed a gap N-1 still has, and the
    // released-client run is measuring a different client entirely.
    expect(staleGapsFor('candidate-sha', [entry], unused, 'v12.2.0')).toEqual(
      []
    );
    expect(staleGapsFor('v12.0.0', [entry], unused, 'v12.2.0')).toEqual([]);
  });

  it('says nothing when the entry did excuse something', () => {
    expect(
      staleGapsFor('v12.2.0', [entry], new Set([entry.key]), 'v12.2.0')
    ).toEqual([]);
  });
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

describe('a known-gaps entry', () => {
  const entry: KnownGap = {
    key: 'subscribe groups /chan/{}',
    reason: 'debt',
    issue: 'TLON-6538',
  };

  it('excuses a request the base already made and could not serve', () => {
    expect(
      exemptionFor(entry.key, entry, new Set([entry.key]), 'origin/develop')
    ).toEqual({ allowed: entry });
  });

  it('refuses one this change introduced alongside it', () => {
    // A PR adding an unsupported request and its exemption in one commit is
    // the whole reason the base is consulted.
    const refused = exemptionFor(entry.key, entry, new Set(), 'origin/develop');
    expect(refused.allowed).toBeUndefined();
    expect(refused.exemptionRejected).toBe(
      'exemption does not apply: request not present (or not missing) at base origin/develop'
    );
  });

  it('is taken at face value only when there is no base to check', () => {
    expect(exemptionFor(entry.key, entry, null)).toEqual({ allowed: entry });
    // And says nothing about a request no entry names.
    expect(exemptionFor('scry groups /other', undefined, null)).toEqual({});
  });
});

describe('the base a known-gaps entry is measured against', () => {
  const client = memoryTree({
    'packages/api/src/client/a.ts':
      "import { scry } from './urbit';\nexport const f = () => scry({ app: 'ledger', path: '/v1/init' });",
  });
  const deskWith = (arm: string) =>
    memoryTree({
      'desk/desk.bill': ':~  %ledger\n==\n',
      'desk/app/ledger.hoon': `
|_  =bowl:gall
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x ${arm} ~]  ~
  ==
--
`,
      'peru.yaml': '',
    });
  const keys = (tree: ReturnType<typeof deskWith>) =>
    missingKeys(client, loadDesk(tree, 'test'), new Set());

  it('reads the desk it is handed, so a base desk that served it is not missing', () => {
    // The entry bar is "already broken at base". Measuring the base client
    // against the *candidate* desk instead makes every request the candidate
    // just broke look already-broken, and an entry added in the same commit
    // clears the bar.
    expect([...keys(deskWith('%v9 %gone'))]).toEqual(['scry ledger /v1/init']);
    expect([...keys(deskWith('%v1 %init'))]).toEqual([]);
  });
});

describe('opening the trees', () => {
  it('releases the ones it opened when a later open throws', () => {
    // The desk ref is nonsense, so the second open fails after the first
    // succeeded. Disposal is invisible in the return value, so watch what
    // `openTree` leaves behind — in a temp directory of this test's own, since
    // the rest of the suite is opening trees at the same time.
    const sandbox = mkdtempSync(join(tmpdir(), 'desk-compat-test-'));
    const previous = process.env.TMPDIR;
    process.env.TMPDIR = sandbox;
    try {
      expect(() =>
        runCheck({ clientRef: 'v12.2.0', deskRef: 'no-such-ref-at-all' })
      ).toThrow();
      expect(readdirSync(sandbox)).toEqual([]);
    } finally {
      if (previous === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previous;
      rmSync(sandbox, { recursive: true, force: true });
    }
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

  it('warns about an entry that excused nothing, in both formats', () => {
    const stale = report({
      staleGaps: [{ key: 'scry groups /gone', reason: 'debt' }],
      staleBumps: [bump()],
    });
    const text = formatReport(stale);
    expect(text).toContain(
      'known-gaps entry "scry groups /gone" excused nothing'
    );
    expect(text).toContain('protocolBumps entry %groups');
    const md = markdownReport(stale);
    expect(md).toContain('`scry groups /gone` excused nothing');
    expect(md).toContain('`%groups ~.groups 2->3` (TLON-0000)');
  });

  it('names the known gap it is counting, rather than only counting it', () => {
    const md = markdownReport(
      report({
        findings: [
          finding({
            allowed: {
              key: 'subscribe groups /chan/{}',
              reason: 'deprecated in favour of /v1/channels/…/preview',
              broke_at: '50f96a667f',
              issue: 'TLON-6538',
            },
          }),
        ],
        counts: { ...report().counts, allowed: 1 },
      })
    );
    expect(md).toContain('#### Known gaps (allowed, 1)');
    expect(md).toContain('`50f96a667f`');
    expect(md).toContain('TLON-6538');
  });

  it('lists every site for a verdict a human must act on', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ file: 'a.ts', line: i + 1 }));
    const md = (verdict: Finding['verdict']) =>
      markdownReport(
        report({ findings: [finding({ verdict, sites: many(20) })] })
      );
    // MISSING and GUARDED are worklists: truncating them hides work.
    expect(md('MISSING')).toContain('`a.ts:20`');
    expect(md('GUARDED')).toContain('`a.ts:20`');
    // UNVERIFIED runs to dozens; the remainder is stated rather than dropped.
    const unverified = md('UNVERIFIED');
    expect(unverified).not.toContain('`a.ts:20`');
    expect(unverified).toContain('(+12 more)');
  });

  it('fences an excerpt that contains backticks', () => {
    const md = markdownReport(
      report({
        findings: [
          finding({
            excerpt: ['  ?+  path  ```one``` [~ ~]'],
            source: { file: 'desk/app/groups.hoon', line: 1 },
          }),
        ],
      })
    );
    // A three-backtick fence would be closed by the arm's own `` prefix.
    expect(md).toContain('````hoon');
  });
});
