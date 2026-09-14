import { describe, expect, it } from 'vitest';

import { memoryTree } from './git';
import {
  PathRequest,
  Verdict,
  loadDesk,
  markCandidates,
  matchMark,
  matchPath,
  vendoredMarks,
} from './match';

const PERU = `
git module base:
  pick:
    - pkg/base-dev/mar/noun.hoon
git module landscape:
  pick:
    - desk/mar/docket-0.hoon
`;
const VENDORED = vendoredMarks(PERU);

const LEDGER = `
|_  =bowl:gall
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %init ~]              \`\`noun+!>(~)
    [%x ver=?(%v1 %v2) %rows ~]   \`\`noun+!>(~)
    [%x %v1 %row id=@ ~]          \`\`noun+!>(~)
    [%x %v1 %blob rest=*]         \`\`noun+!>(~)
    [%x %v1 %kind =kind:c ~]      \`\`noun+!>(~)
  ==
++  on-watch
  |=  =path
  ?+  path  !!
    [%v1 %rows ~]  ~
  ==
--
`;

/** A desk with %ledger, plus whatever else the case needs. */
function desk(
  over: Record<string, string> = {},
  client?: Record<string, string>
) {
  const files: Record<string, string> = {
    'desk/desk.bill': ':~  %ledger\n==\n',
    'desk/app/ledger.hoon': LEDGER,
    'peru.yaml': PERU,
    ...over,
  };
  return loadDesk(
    memoryTree(files),
    'test',
    client ? memoryTree(client) : undefined
  );
}

const scry = (known: string[], unknownTail = false): PathRequest => ({
  app: 'ledger',
  surface: 'scry',
  known: ['x', ...known],
  unknownTail,
});

const verdictOf = (r: PathRequest, d = desk()): Verdict =>
  matchPath(d, r).verdict;

describe('a request the arms decide outright', () => {
  it('is MATCHED when every segment is consumed by a literal or a typed atom', () => {
    expect(verdictOf(scry(['v1', 'init']))).toBe('MATCHED');
    expect(verdictOf(scry(['v1', 'row', '0v5']))).toBe('MATCHED');
  });

  it('is MATCHED through a `?()` union member, and MISSING outside it', () => {
    expect(verdictOf(scry(['v1', 'rows']))).toBe('MATCHED');
    expect(verdictOf(scry(['v2', 'rows']))).toBe('MATCHED');
    // The union is expanded rather than failed open, so %v3 is an absence.
    expect(verdictOf(scry(['v3', 'rows']))).toBe('MISSING');
  });

  it('is MISSING when no arm can take the prefix', () => {
    const result = matchPath(desk(), scry(['v9', 'init']));
    expect(result.verdict).toBe('MISSING');
    expect(result.rule).toBe('prefix');
    expect(result.failureMode).toBe('empty');
    expect(result.source?.file).toBe('desk/app/ledger.hoon');
  });

  it('reports the watch dispatcher separately, and as a crash', () => {
    const watch = (known: string[]): PathRequest => ({
      app: 'ledger',
      surface: 'subscribe',
      known,
      unknownTail: false,
    });
    expect(verdictOf(watch(['v1', 'rows']))).toBe('MATCHED');
    expect(matchPath(desk(), watch(['v1', 'init']))).toMatchObject({
      verdict: 'MISSING',
      failureMode: 'crash',
    });
  });
});

describe('a match the arms do not decide outright', () => {
  it('is WILDCARD when the only arm swallows the tail with `*`', () => {
    expect(verdictOf(scry(['v1', 'blob', 'a', 'b']))).toBe('WILDCARD');
    expect(matchPath(desk(), scry(['v1', 'blob']))).toMatchObject({
      verdict: 'WILDCARD',
      evidence: expect.stringContaining('[%x %v1 %blob rest=*]'),
    });
  });

  it('is WILDCARD when a named mold consumes the segment', () => {
    // `=kind:c` is `?(%diary %heap %chat)`, not any knot: the pattern accepts
    // the pole, but not because this reader established the segment is valid.
    expect(verdictOf(scry(['v1', 'kind', 'diary']))).toBe('WILDCARD');
    expect(verdictOf(scry(['v1', 'kind', 'nonsense']))).toBe('WILDCARD');
  });

  it('is UNVERIFIED when the interpolated tail is what decides', () => {
    // `/x/v1/row/${id}` — the arm needs one more segment, and the request
    // does not say how many it will supply.
    expect(verdictOf(scry(['v1', 'row'], true))).toBe('UNVERIFIED');
    // An interpolation does not stop at a slash, so nothing here is decidable.
    expect(verdictOf(scry(['v1'], true))).toBe('UNVERIFIED');
  });

  it('is UNVERIFIED when an arm pattern would not parse', () => {
    const odd = desk({
      'desk/app/ledger.hoon': `
|_  =bowl:gall
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %init ~]        ~
    [%x %v1 $?(%a %b) ~]    ~
  ==
--
`,
    });
    expect(verdictOf(scry(['v9', 'nope']), odd)).toBe('UNVERIFIED');
    // A positive match still stands; only the absence is withheld.
    expect(verdictOf(scry(['v1', 'init']), odd)).toBe('MATCHED');
  });

  it('does not stop discovery at a dispatcher that reads badly', () => {
    // `on-peek` here holds a body line read as a `~` arm. Stopping there
    // would hide the `?+` in `peek`, where the real arms are.
    const delegating = desk({
      'desk/app/ledger.hoon': `
|_  =bowl:gall
++  on-peek
  |=  =path
  ?:  =(~ path)
    ?+  path  [~ ~]
      ~
    ==
  (peek path)
++  peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %init ~]  ~
  ==
--
`,
    });
    expect(verdictOf(scry(['v1', 'init']), delegating)).toBe('MATCHED');
  });

  it('is UNVERIFIED when the agent rewrites the pole before dispatching', () => {
    const rewriting = desk({
      'desk/app/ledger.hoon': `
|_  =bowl:gall
++  on-peek
  |=  =path
  =.  path
    ?>  ?=([%x *] path)
    t.path
  ?+  path  [~ ~]
    [%v1 %init ~]  ~
  ==
--
`,
    });
    const result = matchPath(rewriting, scry(['v1', 'init']));
    expect(result.verdict).toBe('UNVERIFIED');
    expect(result.reason).toContain('rewrites');
  });

  it('follows the `%v0` the agent injects, rather than reporting an absence', () => {
    const versioned = desk({
      'desk/app/ledger.hoon': `
|_  =bowl:gall
++  on-peek
  |=  =(pole knot)
  =?  +.pole  !?=([?(%v0 %v1) *] +.pole)
    [%v0 +.pole]
  ?+  pole  [~ ~]
    [%x %v0 %hidden ~]  ~
  ==
--
`,
    });
    // Sent as /hidden-posts, dispatched as /v0/hidden.
    expect(verdictOf(scry(['hidden']), versioned)).toBe('MATCHED');
    expect(verdictOf(scry(['v0', 'hidden']), versioned)).toBe('MATCHED');
  });

  it('injects into an empty pole too, which is what the agent does', () => {
    // `!?=([?(%v0 …) *] pole)` holds for `~`, so a bare `/` is dispatched as
    // `/v0` and taken by `[?(%v0 …) ~]`.
    const versioned = desk({
      'desk/app/ledger.hoon': `
|_  =bowl:gall
++  on-watch
  |=  =(pole knot)
  =?  pole  !?=([?(%v0 %v1) *] pole)
    [%v0 pole]
  ?+  pole  !!
    [?(%v0 %v1) ~]  ~
  ==
--
`,
    });
    expect(
      matchPath(versioned, {
        app: 'ledger',
        surface: 'subscribe',
        known: [],
        unknownTail: false,
      }).verdict
    ).toBe('MATCHED');
  });

  it('never calls an absence past a named mold, whose width it cannot know', () => {
    // `=path` is a whole list of knots, not one segment, so the walk after it
    // is against segments the pattern may not have meant.
    const molded = desk({
      'desk/app/ledger.hoon': `
|_  =bowl:gall
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %things =path]        ~
    [%x %posts =kind:c %new ~]  ~
  ==
--
`,
    });
    expect(verdictOf(scry(['things', 'a', 'b']), molded)).toBe('WILDCARD');
    // A mold may stand for no segments at all, so the request can end there.
    expect(verdictOf(scry(['things']), molded)).toBe('WILDCARD');
    expect(verdictOf(scry(['posts', 'diary', 'a', 'new']), molded)).toBe(
      'WILDCARD'
    );
    // With nothing opaque crossed, an absence is still an absence.
    expect(verdictOf(scry(['nope']), molded)).toBe('MISSING');
  });
});

describe('an app that is not this desk’s to answer for', () => {
  const elsewhere = scry(['v1', 'init']);
  const otherApp = { ...elsewhere, app: 'settings' };

  it('is UNVERIFIED when neither desk had it', () => {
    expect(verdictOf(otherApp)).toBe('UNVERIFIED');
  });

  it('is MISSING when the client desk had the agent and this one does not', () => {
    const removed = desk(
      {},
      {
        'desk/desk.bill': ':~  %ledger %settings\n==\n',
        'desk/app/settings.hoon': LEDGER,
      }
    );
    expect(matchPath(removed, otherApp)).toMatchObject({
      verdict: 'MISSING',
      rule: 'removal',
      failureMode: 'crash',
    });
  });

  it('is MISSING when the name left desk.bill, source and all', () => {
    const unbilled = desk(
      { 'desk/desk.bill': ':~  %other\n==\n' },
      { 'desk/desk.bill': ':~  %ledger\n==\n', 'desk/app/ledger.hoon': LEDGER }
    );
    expect(matchPath(unbilled, elsewhere)).toMatchObject({
      verdict: 'MISSING',
      rule: 'removal',
      failureMode: 'not-running',
    });
  });

  it('does not read a commented-out bill entry as still billed', () => {
    const commented = desk(
      { 'desk/desk.bill': ':~  %other\n    :: %ledger\n==\n' },
      { 'desk/desk.bill': ':~  %ledger\n==\n', 'desk/app/ledger.hoon': LEDGER }
    );
    expect(matchPath(commented, elsewhere).failureMode).toBe('not-running');
  });
});

describe('marks', () => {
  const mars = (...files: string[]) =>
    Object.fromEntries(files.map((f) => [f, ':: mark\n']));

  it('enumerates every hyphen grouping Clay would look at', () => {
    expect(markCandidates('group-action-5')).toEqual([
      'desk/mar/group-action-5.hoon',
      'desk/mar/group/action-5.hoon',
      'desk/mar/group-action/5.hoon',
      'desk/mar/group/action/5.hoon',
    ]);
  });

  it('is MATCHED when the file exists — and claims nothing more', () => {
    const d = desk(mars('desk/mar/ledger/action-1.hoon'));
    expect(matchMark(d, VENDORED, 'ledger', 'ledger-action-1')).toMatchObject({
      verdict: 'MATCHED',
      reason: 'mark file present',
    });
  });

  it('is MISSING when a repo-owned mark has no file', () => {
    expect(
      matchMark(desk(), VENDORED, 'ledger', 'ledger-action-1')
    ).toMatchObject({ verdict: 'MISSING', failureMode: 'crash' });
  });

  it('is MISSING as a removal when the client desk shipped the file', () => {
    const removed = desk(
      {},
      {
        'desk/desk.bill': ':~  %ledger\n==\n',
        ...mars('desk/mar/ledger/action-1.hoon'),
      }
    );
    expect(
      matchMark(removed, VENDORED, 'ledger', 'ledger-action-1')
    ).toMatchObject({ verdict: 'MISSING', rule: 'removal' });
  });

  it('beats the file lookup with the agent and bill checks', () => {
    // A leftover mar would otherwise answer for an agent that is gone.
    const removed = desk(mars('desk/mar/settings/event.hoon'), {
      'desk/desk.bill': ':~  %ledger %settings\n==\n',
      'desk/app/settings.hoon': LEDGER,
    });
    expect(
      matchMark(removed, VENDORED, 'settings', 'settings-event')
    ).toMatchObject({ verdict: 'MISSING', rule: 'removal' });
  });

  it('decides nothing without a resolved mark or app', () => {
    const d = desk(mars('desk/mar/chat/negotiate.hoon'));
    expect(matchMark(d, VENDORED, 'ledger', null).verdict).toBe('UNVERIFIED');
    // A mar file is desk-global, so its presence says nothing about a poke
    // whose target agent this reader could not resolve.
    expect(matchMark(d, VENDORED, null, 'chat-negotiate').verdict).toBe(
      'UNVERIFIED'
    );
  });

  it('decides nothing about a vendored mark, which lives outside the tree', () => {
    expect(matchMark(desk(), VENDORED, 'ledger', 'noun').verdict).toBe(
      'UNVERIFIED'
    );
  });

  it('decides nothing about an app neither desk had', () => {
    expect(
      matchMark(desk(), VENDORED, 'settings', 'settings-event').verdict
    ).toBe('UNVERIFIED');
  });
});
