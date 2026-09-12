import { describe, expect, it } from 'vitest';

import { memoryTree } from './git';
import { Elem } from './hoon';
import { PathRequest, loadDesk, matchAlternative, matchPath } from './match';

const BILL =
  ':~  %groups\n    %groups-ui\n    %steward\n    %channels\n    %contacts\n==\n';
const elems = (spec: string): Elem[] =>
  spec
    .split('/')
    .map(
      (s) =>
        (s === 'nil' || s === 'rest' || s === 'any'
          ? { k: s }
          : { k: 'lit', v: s }) as Elem
    );

const scry = (
  app: string,
  known: string[],
  unknownTail = false
): PathRequest => ({ app, surface: 'scry', known, unknownTail });
const watch = (
  app: string,
  known: string[],
  unknownTail = false
): PathRequest => ({ app, surface: 'subscribe', known, unknownTail });

/** `<verdict> <rule>`, so a case reads as one line. */
function check(files: Record<string, string>, request: PathRequest): string {
  const desk = loadDesk(
    memoryTree({ 'desk/desk.bill': BILL, ...files }),
    'test'
  );
  const r = matchPath(desk, request);
  return `${r.verdict} ${r.rule}`;
}

const DISPATCHES = `
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %init ~]  \`\`noun+!>(~)
  ==
++  on-watch  on-watch:def
--
`.trim();

const DELEGATES_BOTH = `
++  on-peek  on-peek:def
++  on-watch  on-watch:def
--
`.trim();

const WATCHES = `
++  on-peek  on-peek:def
++  on-watch
  |=  =path
  ?+  path  ~|(bad+path !!)
    [%v1 ~]  cor
  ==
--
`.trim();

describe('a comment in an agent file', () => {
  const COMMENTED = [
    '++  on-peek',
    '  |=  =pole',
    '  ?+    pole  [~ ~]',
    '      [%x %v1 %init ~]',
    '    cor  :: the ?+ in :~ this comment is prose',
    '  ::',
    '      [%x %v2 %init ~]',
    '    cor',
    '  ==',
    '--',
  ].join('\n');

  it('cannot swallow the arms written after it', () => {
    const files = {
      'desk/desk.bill': ':~  %ledger\n==\n',
      'desk/app/ledger.hoon': COMMENTED,
    };
    const loaded = loadDesk(memoryTree(files), 'test');
    for (const version of ['v1', 'v2']) {
      expect(
        matchPath(loaded, scry('ledger', ['x', version, 'init'])).verdict
      ).toBe('FOUND');
    }
    expect(matchPath(loaded, scry('ledger', ['x', 'v3', 'init'])).verdict).toBe(
      'MISSING'
    );
  });
});

describe('dropping an agent from desk.bill', () => {
  const app = '|_  =bowl:gall\n--\n';
  const run = (deskBill: string, clientBill: string | null, r: PathRequest) => {
    const files = (bill: string) => ({
      'desk/desk.bill': bill,
      'desk/app/ledger.hoon': app,
    });
    const result = matchPath(
      loadDesk(
        memoryTree(files(deskBill)),
        'test',
        clientBill === null ? undefined : memoryTree(files(clientBill))
      ),
      r
    );
    return `${result.verdict} ${result.rule} ${result.failureMode ?? '-'}`;
  };
  const request = scry('ledger', ['x', 'v1']);

  it('is a removal even though every line of the agent survives', () => {
    expect(run(':~  %other\n==\n', ':~  %ledger\n==\n', request)).toBe(
      'MISSING P1 not-running'
    );
  });

  it('decides nothing about an agent neither desk bills', () => {
    // %ledger may simply live in another desk.
    expect(run(':~  %other\n==\n', ':~  %other\n==\n', request)).toBe(
      'UNVERIFIED coverage -'
    );
    expect(run(':~  %other\n==\n', null, request)).toBe(
      'UNVERIFIED coverage -'
    );
  });
});

describe('handing a surface to default-agent', () => {
  const BILL_LEDGER = ':~  %ledger\n==\n';
  const desk = (app: string) => ({
    'desk/desk.bill': BILL_LEDGER,
    'desk/app/ledger.hoon': app,
  });
  const run = (deskApp: string, clientApp: string | null, r: PathRequest) => {
    const loaded = loadDesk(
      memoryTree(desk(deskApp)),
      'test',
      clientApp === null ? undefined : memoryTree(desk(clientApp))
    );
    const result = matchPath(loaded, r);
    return `${result.verdict} ${result.rule}`;
  };
  const failureOf = (
    deskApp: string,
    clientApp: string,
    r: PathRequest,
    deskFiles: Record<string, string> = {}
  ) =>
    matchPath(
      loadDesk(
        memoryTree({ ...desk(deskApp), ...deskFiles }),
        'test',
        memoryTree(desk(clientApp))
      ),
      r
    ).failureMode;

  it('is a removal when the client desk dispatched that surface itself', () => {
    // The pinned default-agent nacks, so `on-peek:def` deletes the surface as
    // surely as deleting the arms would.
    expect(
      run(DELEGATES_BOTH, DISPATCHES, scry('ledger', ['x', 'v1', 'init']))
    ).toBe('MISSING P1');
  });

  it('stays unverifiable when it was the default in both trees', () => {
    expect(
      run(DELEGATES_BOTH, DELEGATES_BOTH, scry('ledger', ['x', 'v1', 'init']))
    ).toBe('UNVERIFIED coverage');
    // No client desk at all (a self-consistency run) decides nothing either.
    expect(run(DELEGATES_BOTH, null, scry('ledger', ['x', 'v1', 'init']))).toBe(
      'UNVERIFIED coverage'
    );
  });

  it('reads a stub or a vanished arm the same way', () => {
    const stub = [
      '++  on-peek  |=(* ~)',
      '++  on-watch  on-watch:def',
      '--',
    ].join('\n');
    const gone = ['++  on-watch  on-watch:def', '--'].join('\n');
    for (const removed of [stub, gone]) {
      expect(
        run(removed, DISPATCHES, scry('ledger', ['x', 'v1', 'init']))
      ).toBe('MISSING P1');
      // Unchanged between the trees, it is still merely unreadable.
      expect(run(removed, removed, scry('ledger', ['x', 'v1', 'init']))).toBe(
        'UNVERIFIED coverage'
      );
    }
    // A peek that answers nothing is empty; a watch that answers nothing nacks.
    expect(failureOf(stub, DISPATCHES, scry('ledger', ['x', 'v1']))).toBe(
      'empty'
    );
    expect(failureOf(gone, WATCHES, watch('ledger', ['v1']))).toBe('crash');
  });

  it('does not call an arm it failed to index a removal', () => {
    // The arm is plainly in the file; not finding it is this reader's problem,
    // and a reader failure must never read as a removal.
    const unreadable = [
      '++  on-peek',
      '  |=  =path',
      '  ?:  =(path /x/v1/init)  [~ ~]',
      '  [~ ~]',
      '--',
    ].join('\n');
    expect(
      run(unreadable, DISPATCHES, scry('ledger', ['x', 'v1', 'init']))
    ).toBe('UNVERIFIED coverage');
  });

  it('judges each surface on its own', () => {
    // %ledger dispatches on-peek and delegates on-watch in *both* trees, so the
    // watch is unverifiable while the peek is read normally.
    expect(run(DISPATCHES, DISPATCHES, watch('ledger', ['v1']))).toBe(
      'UNVERIFIED coverage'
    );
    expect(run(DISPATCHES, DISPATCHES, scry('ledger', ['x', 'v2']))).toBe(
      'MISSING P1'
    );
  });
});

// %chat's real root subscription: `~` is an arm like any other, so a request
// with no segments is a request, not a missing one.
const ROOT_WATCH = `
++  on-watch
  |=  =path
  ?+  path  ~|(bad-path+path !!)
    ~          cor
    [%ui ~]    cor
  ==
--
`.trim();

const NO_ROOT_WATCH = `
++  on-watch
  |=  =path
  ?+  path  ~|(bad-path+path !!)
    [%ui ~]    cor
  ==
--
`.trim();

describe('the root path', () => {
  const chat = (app: string) => ({
    'desk/desk.bill': ':~  %chat\n==\n',
    'desk/app/chat.hoon': app,
  });

  it('is served when an arm terminates immediately', () => {
    expect(check(chat(ROOT_WATCH), watch('chat', []))).toBe('FOUND P1');
  });

  it('is missing when every arm demands a segment', () => {
    expect(check(chat(NO_ROOT_WATCH), watch('chat', []))).toBe('MISSING P1');
  });
});

describe('matchAlternative', () => {
  const m = (alt: string, known: string[], unknownTail: boolean) =>
    matchAlternative(elems(alt), known, unknownTail);

  it('serves a literal request only when an arm terminates exactly there', () => {
    expect(m('x/v10/init/nil', ['x', 'v10', 'init'], false)).toBe('exact');
    expect(m('x/v9/init/nil', ['x', 'v10', 'init'], false)).toBe('no');
    // The bare /v1/lens against [%v1 %recent ~]: an arm needing more segments
    // than a literal request has does not serve it.
    expect(m('v1/recent/nil', ['v1'], false)).toBe('no');
    expect(m('x/v1/nil', ['x', 'v1', 'more'], false)).toBe('no');
  });

  it('treats an unknown tail as unbounded in value and in segment count', () => {
    expect(m('x/v1/lens/rest', ['x', 'v1', 'lens'], true)).toBe('open');
    expect(m('x/v11/changes/any/nil', ['x', 'v11', 'changes'], true)).toBe(
      'prefix'
    );
    expect(m('x/v11/changes/any/nil', ['x', 'v11', 'changes'], false)).toBe(
      'no'
    );
    // An arm that ends at the prefix cannot serve a request with more to come.
    expect(m('x/v3/groups/nil', ['x', 'v3', 'groups'], true)).toBe('no');
  });
});

const PEEK = `
++  on-peek   peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v9 %init ~]  \`\`ui-init-9+!>(init)
  ::
      [%x ver=?(%v0 %v1 %v2) %ui %groups ship=@ name=@ ~]
    \`\`group-ui+!>(group)
  ==
--
`.trim();

// A `$(pole …)` rewrite sitting behind a head a %v3 prefix cannot reach.
const WATCH = `
++  on-watch   watch:cor
--
++  watch
  |=  =(pole knot)
  ?+  pole  ~|(bad-watch-path+pole !!)
    [%v1 %groups ~]  ?>(from-self cor)
  ::
      [%gangs ship=@ name=@ %preview ~]
    $(pole /v1/foreigns/[ship.pole]/[name.pole]/preview)
  ==
--
`.trim();

// channels' shape: a version injection, plus an arm for a version the
// injection does not list — which is the way a real one goes wrong.
const OBSTRUCTED = `
++  on-peek   peek:cor
--
++  peek
  |=  =(pole knot)
  =?  +.pole  !?=([?(%v0 %v1) *] +.pole)
    [%v0 +.pole]
  ?+    pole  [~ ~]
      [%x %v0 %init ~]  \`\`init+!>(init)
  ::
      [%x %v7 %init ~]  \`\`init+!>(init)
  ==
--
`.trim();

// A pre-dispatch guard this reader cannot discharge: it may reject before the
// dispatcher is reached, so absence proves nothing.
const GUARDED = `
++  on-peek
  |=  =path
  ?>  (can-read:perms src.bowl)
  (peek:cor path)
--
++  peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %status ~]  \`\`json+!>(status)
  ==
--
`.trim();

// steward's actual shape: the guard is a self-check, satisfied by every
// frontend request, so it changes nothing either way.
const SELF_GUARDED = GUARDED.replace(
  '?>  (can-read:perms src.bowl)',
  '?>  =(src our):bowl'
);

// groups' /vN/changes shape: `since` is required before the `rest` capture.
const REQUIRED_SUFFIX = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v3 %changes since=@ rest=*]
    \`\`group-changed-groups-3+!>(changes)
  ==
--
`.trim();

// channels' /vN/changes shape: a nested `?+` decides the tail.
const NESTED = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v6 %changes since=@ rest=*]
    ?+  rest.pole  [~ ~]
        ~
      \`\`channel-changed-posts-1+!>(changes)
    ::
        [%count ~]
      \`\`json+!>(count)
    ==
  ==
--
`.trim();

// contacts.hoon's shape: the pattern matches, then the body rejects.
const BRANCHING_BODY = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v1 %book her=@p ~]
    ?~  who=(slaw %p her.pole)
      [~ ~]
    \`\`contact-page-0+!>(page)
  ==
--
`.trim();

// The same empty-or-/count decision as NESTED, spelled with `?:`.
const CONDITIONAL_TAIL = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v6 %changes since=@ rest=*]
    ?:  =(~ rest.pole)
      \`\`changed-posts+!>(changes)
    \`\`json+!>(count)
  ==
--
`.trim();

// A `?~` between the arm and the nested `?+` may already have returned.
const GUARDED_NESTED = NESTED.replace(
  '    ?+  rest.pole  [~ ~]',
  '    ?~  since.pole  [~ ~]\n    ?+  rest.pole  [~ ~]'
);

// A `.^` that only runs on one side of a `?:` cannot prove absence.
const CONDITIONAL_FANOUT = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v10 %init ~]
    ?:  cached
      \`\`ui-init-10+!>(cache)
    =+  .^(a (scry %gx %groups /v4/init/noun))
    \`\`ui-init-10+!>(init)
  ==
--
`.trim();

// One readable `.^` to a missing path, beside one this reader cannot read.
const MIXED_FANOUT = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v10 %init ~]
    =+  .^(a (scry %gx %groups (snoc rest %init)))
    =+  .^(b (scry %gx %groups /v4/init/noun))
    \`\`ui-init-10+!>(init)
  ==
--
`.trim();

// steward's shape: a `*`-tailed arm forwarding into a sub-core that serves
// only some completions, and a watch surface that inverts it exactly.
const DELEGATING = `
++  on-peek
  |=  =path
  (peek:cor path)
++  on-watch  watch:cor
--
++  watch
  |=  =path
  ?+  path  ~|(bad-watch-path+path !!)
    [%v1 %lens *]  (le-watch:le-core [%v1 t.t.path])
  ==
++  peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %lens *]  (le-peek:le-core [%v1 t.t.t.path])
  ==
++  le-core
  |%
  ++  le-watch
    |=  =path
    ?+  path  ~|(bad-lens-watch-path+path !!)
      [%v1 ~]  cor
    ==
  ++  le-peek
    |=  =path
    ?+  path  [~ ~]
      [%v1 %recent ~]  \`\`lens-update-1+!>(recent)
    ==
  --
--
`.trim();

// An arm that serves when `rest` is empty and re-dispatches otherwise.
const PARTIAL = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v3 %ui %groups ship=@ name=@ rest=*]
    ?.  ?=(~ rest.pole)
      $(pole [%x %v3 %groups ship name rest]:pole)
    \`\`group-ui+!>(group)
  ==
--
`.trim();

const FANOUT = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v10 %init ~]
    =+  .^(a (scry %gx %groups /v4/init/noun))
    \`\`ui-init-10+!>(init)
  ==
--
`.trim();

const GROUPS_V4 = `
++  on-peek  peek:cor
--
++  peek
  |=  =(pole knot)
  ?+    pole  [~ ~]
      [%x %v4 %init ~]  \`\`init+!>(init)
  ==
--
`.trim();

const ui = { 'desk/app/groups-ui.hoon': PEEK };
const steward = { 'desk/app/steward.hoon': DELEGATING };

describe('classification precedence', () => {
  it('P1 — no arm can match the known prefix, whatever the suffix', () => {
    expect(check(ui, scry('groups-ui', ['x', 'v10', 'init']))).toBe(
      'MISSING P1'
    );
    expect(check(ui, scry('groups-ui', ['x', 'v9', 'init']))).toBe('FOUND P1');
    // The `?(...)` union-expander regression: right shape, right arity,
    // excluded solely because %v3 sits outside ?(%v0 %v1 %v2).
    expect(
      check(ui, scry('groups-ui', ['x', 'v3', 'ui', 'groups'], true))
    ).toBe('MISSING P1');
    // A rewrite behind a head the prefix cannot reach is no back door.
    expect(
      check(
        { 'desk/app/groups.hoon': WATCH },
        watch('groups', ['v3', 'groups'])
      )
    ).toBe('MISSING P1');
  });

  it('P2 — the prefix matches but the arm rejects some completions', () => {
    expect(
      check(ui, scry('groups-ui', ['x', 'v1', 'ui', 'groups'], true))
    ).toBe('UNVERIFIED P2');
  });

  it('P0 — a rewrite of the pole forbids FOUND as well as MISSING', () => {
    const files = { 'desk/app/groups.hoon': OBSTRUCTED };
    // A `%v7 %init` arm added without extending the injection list matches
    // here, while the live pole becomes /v0/v7/init. Claiming FOUND would be
    // the false positive that matters.
    expect(check(files, scry('groups', ['x', 'v7', 'init']))).toBe(
      'UNVERIFIED P0'
    );
    expect(check(files, scry('groups', ['x', 'v9', 'init']))).toBe(
      'UNVERIFIED P0'
    );
    // %v0 is in the union the injection tests for, so it provably does not
    // fire and the arm really is what the request reaches.
    expect(check(files, scry('groups', ['x', 'v0', 'init']))).toBe('FOUND P1');
  });

  it('P0 — a guard this reader cannot discharge forbids both verdicts', () => {
    // It may reject a request the arms would have served, so a match proves no
    // more than an absence does. Same treatment as the in-body rule.
    const files = { 'desk/app/steward.hoon': GUARDED };
    expect(check(files, scry('steward', ['x', 'v1', 'status']))).toBe(
      'UNVERIFIED P0'
    );
    expect(check(files, scry('steward', ['x', 'v1', 'gone']))).toBe(
      'UNVERIFIED P0'
    );
  });

  it('reports an agent the client uses and the desk deleted', () => {
    // Without the client-side desk, a removed agent is indistinguishable from
    // one that was never in this desk, and the removal gate passes.
    const desk = loadDesk(
      memoryTree({ 'desk/desk.bill': BILL }),
      'test',
      memoryTree({ 'desk/app/steward.hoon': DELEGATING })
    );
    const result = matchPath(desk, scry('steward', ['x', 'v1', 'lens']));
    expect([result.verdict, result.rule]).toEqual(['MISSING', 'P1']);
    expect(result.reason).toContain('no longer an agent');
    // An app in neither tree is simply out of desk.
    const absent = loadDesk(memoryTree({ 'desk/desk.bill': BILL }), 'test');
    expect(matchPath(absent, scry('settings', ['x', 'all'])).verdict).toBe(
      'UNVERIFIED'
    );
  });

  it('a self-guard is satisfied by construction and changes no verdict', () => {
    // The client only ever asks its own ship, so `?> =(src our)` cannot reject
    // it — and must not hide an absent arm either.
    const files = { 'desk/app/steward.hoon': SELF_GUARDED };
    expect(check(files, scry('steward', ['x', 'v1', 'status']))).toBe(
      'FOUND P1'
    );
    expect(check(files, scry('steward', ['x', 'v1', 'gone']))).toBe(
      'MISSING P1'
    );
    for (const guard of [
      '?>  from-self',
      '?>  =(our.bowl src.bowl)',
      '?>  =(src.bowl our.bowl)',
      '?>  =(our src)',
      '?>  (team:title our.bowl src.bowl)',
      '?>(from-self (peek:cor path))',
    ]) {
      const spelling = {
        'desk/app/steward.hoon': GUARDED.replace(
          '?>  (can-read:perms src.bowl)',
          guard
        ).replace(guard.startsWith('?>(') ? '  (peek:cor path)\n' : '', ''),
      };
      expect(check(spelling, scry('steward', ['x', 'v1', 'gone']))).toBe(
        'MISSING P1'
      );
    }
    // `?<` asserts the negation, so a self-check there rejects the frontend.
    const inverted = {
      'desk/app/steward.hoon': GUARDED.replace(
        '?>  (can-read:perms src.bowl)',
        '?<  from-self'
      ),
    };
    expect(check(inverted, scry('steward', ['x', 'v1', 'gone']))).toBe(
      'UNVERIFIED P0'
    );
  });

  it('P3 — matching a `*` tail is not service; only an arm that serves terminates', () => {
    expect(check(steward, scry('steward', ['x', 'v1', 'lens', 'recent']))).toBe(
      'FOUND P1'
    );
    expect(check(steward, scry('steward', ['x', 'v1', 'lens']))).toBe(
      'MISSING P1'
    );
    // The watch surface inverts exactly: only the bare prefix is accepted.
    expect(check(steward, watch('steward', ['v1', 'lens']))).toBe('FOUND P1');
    expect(check(steward, watch('steward', ['v1', 'lens', 'recent']))).toBe(
      'MISSING P1'
    );
    // An arm that both serves and re-dispatches claims neither verdict.
    expect(
      check(
        { 'desk/app/groups.hoon': PARTIAL },
        scry('groups', ['x', 'v3', 'ui', 'groups', '~zod', 'x'])
      )
    ).toBe('UNVERIFIED P3');
  });

  it('reaches a `rest` capture only once every element before it matched', () => {
    const files = { 'desk/app/groups.hoon': REQUIRED_SUFFIX };
    // /v3/changes omits the required `since`, so the arm does not match and
    // the dispatcher falls through to its empty default.
    expect(check(files, scry('groups', ['x', 'v3', 'changes']))).toBe(
      'MISSING P1'
    );
    expect(
      check(files, scry('groups', ['x', 'v3', 'changes', '~2026.1.1']))
    ).toBe('FOUND P3');
  });

  it('follows a nested `?+` inside the matched arm', () => {
    const files = { 'desk/app/channels.hoon': NESTED };
    const at = (...tail: string[]) =>
      check(
        files,
        scry('channels', ['x', 'v6', 'changes', '~2026.1.1', ...tail])
      );
    expect(at()).toBe('FOUND P1');
    expect(at('count')).toBe('FOUND P1');
    // The nested dispatcher serves only those two; the outer `rest=*` does not
    // make the arm accept everything after it.
    expect(at('bogus')).toBe('MISSING P1');
  });

  it('follows `.^` fan-out one level, and MISSING wins over unreadable', () => {
    const req = scry('groups-ui', ['x', 'v10', 'init']);
    const withGroups = (source: string) => ({
      'desk/app/groups-ui.hoon': FANOUT,
      'desk/app/groups.hoon': source,
    });
    expect(check(withGroups(GROUPS_V4), req)).toBe('FOUND P1');
    expect(check(withGroups(GROUPS_V4.replace('%v4', '%v3')), req)).toBe(
      'MISSING P3'
    );
    // One scry this reader cannot resolve must not mask the literal one beside
    // it that is genuinely gone.
    const mixed = {
      'desk/app/groups-ui.hoon': MIXED_FANOUT,
      'desk/app/groups.hoon': GROUPS_V4.replace('%v4', '%v3'),
    };
    expect(check(mixed, req)).toBe('MISSING P3');
  });

  it('does not claim service when the body still decides', () => {
    // contacts.hoon:808 matches `her=@p` and then rejects with `?~ (slaw %p …)`.
    const files = { 'desk/app/contacts.hoon': BRANCHING_BODY };
    expect(check(files, scry('contacts', ['x', 'v1', 'book', '~zod']))).toBe(
      'UNVERIFIED P3'
    );
    // The same empty-or-/count decision written with `?:` instead of a `?+`
    // must not read as "the arm serves everything after `rest`".
    const tail = { 'desk/app/channels.hoon': CONDITIONAL_TAIL };
    expect(
      check(
        tail,
        scry('channels', ['x', 'v6', 'changes', '~2026.1.1', 'bogus'])
      )
    ).toBe('UNVERIFIED P3');
    // A branch before a nested `?+` may already have returned, so the nested
    // dispatcher is not the whole decision either way.
    const guarded = { 'desk/app/channels.hoon': GUARDED_NESTED };
    const at = (...tail: string[]) =>
      check(
        guarded,
        scry('channels', ['x', 'v6', 'changes', '~2026.1.1', ...tail])
      );
    expect(at()).toBe('UNVERIFIED P3');
    expect(at('bogus')).toBe('UNVERIFIED P3');
  });

  it('bounds `.^` fan-out at one level across agents', () => {
    // groups-ui → groups → channels. The second hop must not be followed, or
    // the "one level" limit would be per-agent rather than per-request.
    const chain = {
      'desk/app/groups-ui.hoon': FANOUT,
      'desk/app/groups.hoon': FANOUT.replace('%v10', '%v4').replace(
        '%groups /v4/init',
        '%channels /v6/init'
      ),
      'desk/app/channels.hoon': GROUPS_V4.replace('%v4', '%v9'),
    };
    expect(check(chain, scry('groups-ui', ['x', 'v10', 'init']))).toBe(
      'UNVERIFIED P3'
    );
  });

  it('sees a branch in wide form, and every rune that can reject', () => {
    // Wide form puts the rune against its `(`: contacts.hoon:873 is
    // `?:(?=([~ ^ *] per) …)`, groups.hoon:1142 is `?>(from-self cor)`.
    const arm = (body: string) =>
      check(
        {
          'desk/app/groups.hoon':
            '++  on-peek  peek:cor\n--\n++  peek\n  |=  =(pole knot)\n' +
            `  ?+    pole  [~ ~]\n      [%x %v1 %thing ~]  ${body}\n  ==\n--\n`,
        },
        scry('groups', ['x', 'v1', 'thing'])
      );
    expect(arm('``json+!>(0)')).toBe('FOUND P1');
    // A self-guard is satisfied, so it leaves the arm serving.
    expect(arm('?>(from-self ``json+!>(0))')).toBe('FOUND P1');
    expect(arm('?>(=(our.bowl src.bowl) ``json+!>(0))')).toBe('FOUND P1');
    // contacts.hoon:923 nests the guard inside a `~|` trace.
    expect(
      arm('~|(local-news+src.bowl ?>(=(our src):bowl ``json+!>(0)))')
    ).toBe('FOUND P1');
    for (const body of [
      '?:(cached [~ ~] ``json+!>(0))',
      '?>((can-read:perms src.bowl) ``json+!>(0))',
      '?<(from-self ``json+!>(0))',
      '?&(a b)',
      '?|(a b)',
      '=?(a b ``json+!>(0))',
      '``json+!>((need (get id)))',
      '%-  need  (get id)',
    ]) {
      expect(arm(body)).toBe('UNVERIFIED P3');
    }
  });

  it('does not blame a `.^` that only runs on one branch', () => {
    const files = {
      'desk/app/groups-ui.hoon': CONDITIONAL_FANOUT,
      'desk/app/groups.hoon': GROUPS_V4.replace('%v4', '%v3'),
    };
    expect(check(files, scry('groups-ui', ['x', 'v10', 'init']))).toBe(
      'UNVERIFIED P3'
    );
  });

  it('does not resolve a request through a mold it cannot read', () => {
    const channels = {
      'desk/app/channels.hoon':
        '++  on-watch  watch:cor\n--\n++  watch\n  |=  =(pole knot)\n' +
        '  ?+  pole  ~|(bad !!)\n    [%v4 =kind:c ship=@ name=@ ~]  cor\n  ==\n--\n',
    };
    // %notes is not in ?(%diary %heap %chat), so the live dispatcher crashes.
    expect(
      check(channels, watch('channels', ['v4', 'notes', '~zod', 'example']))
    ).toBe('UNVERIFIED extraction');
  });

  it('claims nothing about what it cannot read', () => {
    expect(check({}, watch('settings', ['desk', 'groups']))).toBe(
      'UNVERIFIED coverage'
    );
    expect(
      check({ 'desk/app/notes.hoon': PEEK }, scry('notes', ['x', 'v0'], true))
    ).toBe('UNVERIFIED coverage');
    const stub = { 'desk/app/groups.hoon': '++  on-peek  on-peek:def\n--\n' };
    expect(check(stub, scry('groups', ['x', 'anything']))).toBe(
      'UNVERIFIED coverage'
    );
  });
});

describe('what a verdict reports', () => {
  const desk = (files: Record<string, string>) =>
    loadDesk(memoryTree({ 'desk/desk.bill': BILL, ...files }), 'test');

  it('records the failure mode, which differs between a peek and a watch', () => {
    expect(
      matchPath(desk(ui), scry('groups-ui', ['x', 'v10', 'init'])).failureMode
    ).toBe('empty');
    expect(
      matchPath(
        desk({ 'desk/app/groups.hoon': WATCH }),
        watch('groups', ['v3', 'groups'])
      ).failureMode
    ).toBe('crash');
  });

  it('reports a nested verdict against its real file line', () => {
    // The nested `?+` is parsed from the arm body, so its evidence must carry
    // the file offset, not a line number relative to that slice.
    const result = matchPath(
      desk({ 'desk/app/channels.hoon': NESTED }),
      scry('channels', ['x', 'v6', 'changes', '~2026.1.1', 'count'])
    );
    const line = Number(
      /channels\.hoon:(\d+)/.exec(result.evidence ?? '')?.[1]
    );
    expect(NESTED.split('\n')[line - 1]).toContain('[%count ~]');
  });

  it('names the sub-dispatcher and the onward scry a verdict turned on', () => {
    expect(
      matchPath(desk(steward), scry('steward', ['x', 'v1', 'lens'])).reason
    ).toContain('le-peek');
    const gone = {
      'desk/app/groups-ui.hoon': FANOUT,
      'desk/app/groups.hoon': GROUPS_V4.replace('%v4', '%v3'),
    };
    expect(
      matchPath(desk(gone), scry('groups-ui', ['x', 'v10', 'init'])).reason
    ).toContain('%groups /v4/init');
  });
});
