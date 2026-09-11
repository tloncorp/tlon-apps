import { describe, expect, it } from 'vitest';

import {
  expandPattern,
  indexArms,
  parseDispatcher,
  preDispatchObstructions,
  splitTokens,
} from './hoon';

/** Flattened alternatives as `seg/seg/…` strings, or null when unparseable. */
const shapes = (pattern: string) =>
  expandPattern(pattern)?.map((alt) =>
    alt.map((e) => (e.k === 'lit' ? e.v : e.k)).join('/')
  ) ?? null;

describe('pattern grammar', () => {
  it('reads every atomic form the desk uses', () => {
    expect(shapes('[%x %v10 %init ~]')).toEqual(['x/v10/init/nil']);
    expect(shapes('[%x %v5 %changes since=@ ~]')).toEqual([
      'x/v5/changes/any/nil',
    ]);
    expect(shapes('[%server %groups ship=@ name=@ rest=*]')).toEqual([
      'server/groups/any/any/rest',
    ]);
    expect(shapes('[%u %v1 %book her=@p ~]')).toEqual(['u/v1/book/any/nil']);
    expect(shapes('~')).toEqual(['nil']);
  });

  it('does not mistake a named mold for "any knot"', () => {
    // `=kind:c` is ?(%diary %heap %chat) (sur/channels.hoon:147) and `=cid` is
    // @uvF — neither accepts every segment, so both stay opaque.
    expect(shapes('[%x v=%v0 =kind:c ship=@ ~]')).toEqual([
      'x/v0/opaque/any/nil',
    ]);
    expect(shapes('[%u %v1 %book %id =cid ~]')).toEqual([
      'u/v1/book/id/opaque/nil',
    ]);
  });

  it('expands unions, which is what lets a version be rejected rather than failed open', () => {
    expect(shapes('[%x ver=?(%v0 %v1 %v2) %ui %groups ~]')).toEqual([
      'x/v0/ui/groups/nil',
      'x/v1/ui/groups/nil',
      'x/v2/ui/groups/nil',
    ]);
    expect(shapes('[%x %v1 %heads since=?(~ [u=@ ~])]')).toEqual([
      'x/v1/heads/nil',
      'x/v1/heads/any/nil',
    ]);
    expect(shapes('[%record ?([@ @ ~] [@ @ @ ~])]')).toEqual([
      'record/any/any/nil',
      'record/any/any/any/nil',
    ]);
    expect(shapes('[?(%x %u) %show *]')).toEqual([
      'x/show/rest',
      'u/show/rest',
    ]);
  });

  it('refuses syntax it does not model, rather than guessing', () => {
    expect(shapes('[%~.~ %foo ~]')).toBeNull();
    expect(shapes('[!>(`action`vase) ~]')).toBeNull();
  });

  it('keeps bracketed and parenthesised groups whole when tokenising', () => {
    expect(splitTokens('%x ver=?(%v0 %v1) [u=@ ~] *')).toEqual([
      '%x',
      'ver=?(%v0 %v1)',
      '[u=@ ~]',
      '*',
    ]);
  });
});

// Arm pattern alone at headerIndent+4 with the body underneath, and a nested
// `:*` whose `==` must not end the dispatcher early.
const STANDALONE = `
?+    pole  [~ ~]
    [%x %pins ~]  \`\`ui-pins+!>(pins)
::
    [%x %v9 %init ~]
  =+  .^(a (scry %gx %groups /v3/init/noun))
  =/  init=init-9:u
    :*  a
        b
    ==
  \`\`ui-init-9+!>(init)
::
    [%x %v11 %changes since=@ ~]
  \`\`json+!>(changes)
==
`.trim();

// Pattern and body sharing a line at headerIndent+2, mixed with the other
// layout, plus a bare bracketed body line that must not read as an arm.
const MIXED = `
?+  pole  ~|(bad-watch-path+pole !!)
    [%server %groups ship=@ name=@ rest=*]
  =/  se-core  (se-abed:se-core [our.bowl name.pole])
  [[bot %steward] %poke %some-mark !>(payload)]
::
  [%v1 %groups ~]  ?>(from-self cor)
::
  [%v2 %groups ~]  ?>(from-self cor)
==
`.trim();

// The three real shapes whose body lines sit at an arm column: a `:^` child
// (groups.hoon:1336), a `?~` branch result (contacts.hoon:809), and a `=/`
// initialiser (activity.hoon:631). Each must stay body — stealing one
// truncates its arm, hiding whatever the rest of the body depends on.
const OUTDENTED_BODIES = `
?+    pole  [~ ~]
      [%x %v3 %changes since=@ rest=*]
    =+  since=(slav %da since.pole)
    :^  ~  ~
      %group-changed-groups-3
    (~(run by (changes since)) group-ui:group:v11:gc)
::
        [%x %v1 %book her=@p ~]
      ?~  who=(slaw %p her.pat)
        [~ ~]
      \`\`contact-page-0+page
::
      [%x ver=?(%v4 %v5) %event id=@ ~]
    =/  =time-event:a
      [id.pole (got:on-event:a stream:base (slav %da id.pole))]
    \`\`json+!>(event)
::
      [%x ver=?(%v4 %v5 %v6) ~]
    =/  =full-info:a
      [indices activity volume-settings]
    ?-    ver.pole
        %v4  \`\`activity-full-4+!>(legacy)
    ==
::
      [%x %v7 %pair ~]
    :-  %noun
      [indices activity]
    \`\`noun+!>(out)
::
      [%x %v8 %fallback ~]
    =/  default
      [%x %v1 ~]
    \`\`noun+!>(default)
==
`.trim();

describe('parseDispatcher', () => {
  const parse = (source: string) => {
    const lines = source.split('\n');
    return parseDispatcher(lines, 0, lines.length)!;
  };

  it('reads both arm layouts and neither nested runes nor bracketed body lines', () => {
    const standalone = parse(STANDALONE);
    expect(standalone.subject).toBe('pole');
    expect(standalone.defaultKind).toBe('empty');
    expect(standalone.arms.map((a) => a.patternText)).toEqual([
      '[%x %pins ~]',
      '[%x %v9 %init ~]',
      '[%x %v11 %changes since=@ ~]',
    ]);
    const mixed = parse(MIXED);
    expect(mixed.defaultKind).toBe('crash');
    expect(mixed.arms.map((a) => a.patternText)).toEqual([
      '[%server %groups ship=@ name=@ rest=*]',
      '[%v1 %groups ~]',
      '[%v2 %groups ~]',
    ]);
    expect([standalone.unparsedArms, mixed.unparsedArms]).toEqual([0, 0]);
  });

  it('keeps an arm body, so delegation and fan-out can be read from it', () => {
    expect(parse(STANDALONE).arms[1].bodyText).toContain('/v3/init/noun');
  });

  it('does not mistake an outdented body line for an arm', () => {
    const d = parse(OUTDENTED_BODIES);
    expect(d.arms.map((a) => a.patternText)).toEqual([
      '[%x %v3 %changes since=@ rest=*]',
      '[%x %v1 %book her=@p ~]',
      '[%x ver=?(%v4 %v5) %event id=@ ~]',
      '[%x ver=?(%v4 %v5 %v6) ~]',
      '[%x %v7 %pair ~]',
      '[%x %v8 %fallback ~]',
    ]);
    // Nothing was left unparseable, which is what would suppress MISSING.
    expect(d.unparsedArms).toBe(0);
    // Each arm keeps its whole body, so what the body depends on stays visible.
    expect(d.arms[0].bodyText).toContain('group-changed-groups-3');
    expect(d.arms[2].bodyText).toContain('got:on-event:a');
    // activity.hoon:452 — a tuple of bare names is a value, and the `?-` it
    // precedes must stay inside the arm.
    expect(d.arms[3].bodyText).toContain('[indices activity volume-settings]');
    expect(d.arms[3].bodyText).toContain('?-    ver.pole');
    // The same tuple-of-names under a `:-` rather than a `=/`: a bracket that
    // pins no `%tag`, face, aura, `*` or `~` is a value, whatever precedes it.
    expect(d.arms[4].bodyText).toContain('[indices activity]');
    // And a `=/` that binds a genuinely path-shaped tuple: the value of a
    // binding is never the next arm, however much it looks like a pattern.
    expect(d.arms[5].bodyText).toContain('[%x %v1 ~]');
  });

  it('reports source line numbers when parsing a slice of a file', () => {
    const lines = OUTDENTED_BODIES.split('\n');
    const d = parseDispatcher(lines, 0, lines.length, 1456)!;
    expect(d.headerLine).toBe(1457);
    expect(d.arms[0].line).toBe(1458);
    expect(d.arms[0].bodyStartLine).toBe(1459);
  });

  it('treats a `:def` default as a nack, since the pinned default-agent crashes', () => {
    expect(
      parse('?+  path  (on-peek:def path)\n  [%x %a ~]  ``json+!>(a)\n==')
        .defaultKind
    ).toBe('default-agent');
  });
});

it('indexes each `++` arm with the range its body occupies', () => {
  const arms = indexArms([
    '|_  =bowl:gall',
    '++  peek',
    '  |=  =path',
    '  [~ ~]',
    '++  watch',
    '  cor',
    '--',
  ]);
  expect([...arms.keys()]).toEqual(['peek', 'watch']);
  expect([arms.get('peek')!.start, arms.get('peek')!.end]).toEqual([1, 4]);
});

describe('preDispatchObstructions', () => {
  const find = (lines: string[], subject: string) =>
    preDispatchObstructions(lines, 0, lines.length, subject);

  it('tells a guard apart from a rewrite of the subject', () => {
    const found = find(
      [
        '?>  ?=(^ pole)',
        '=?  +.pole  !?=([?(%v0 %v1) *] +.pole)',
        '  [%v0 +.pole]',
      ],
      'pole'
    );
    expect(found.map((o) => o.kind)).toEqual(['guard', 'rewrite']);
    // `+.pole` skips the care, and the injection cannot fire for %v0 or %v1.
    expect(found[1].inertWhen).toEqual({ index: 1, members: ['v0', 'v1'] });
  });

  it('resolves a locally bound union, as reel spells the same injection', () => {
    const found = find(
      ['=/  any  ?(%v0 %v1)', '=?  pole  !?=([any *] pole)', '  [%v0 pole]'],
      'pole'
    );
    expect(found[0].inertWhen).toEqual({ index: 0, members: ['v0', 'v1'] });
  });

  it('leaves a rewrite it cannot read with no inert case', () => {
    // lanyard strips the care and gates on %v1; nothing about that is a union.
    expect(find(['=.  path  t.path'], 'path')[0]).toMatchObject({
      kind: 'rewrite',
      inertWhen: undefined,
    });
  });

  it('ignores bindings that leave the subject alone', () => {
    // `=^ cards state` in a delegating on-watch is an ordinary binding.
    expect(
      find(['=^  cards  state', '  abet:(watch:cor path)'], 'path')
    ).toEqual([]);
    expect(find(['=/  =(pole knot)  path'], 'pole')).toEqual([]);
  });
});
