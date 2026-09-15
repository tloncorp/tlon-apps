import { describe, expect, it } from 'vitest';

import {
  blankQuoted,
  classifyDefault,
  expandPattern,
  indexArms,
  looksLikeArmPattern,
  parseDispatcher,
  rewritesSubject,
  splitTokens,
  stripComment,
  stripComments,
  versionInjection,
} from './hoon';

const lines = (text: string) => stripComments(text.trim().split('\n'));

describe('pattern parsing', () => {
  it('expands literals, typed atoms, wildcards and nil', () => {
    expect(expandPattern('[%x %v1 %init ~]')).toEqual([
      [
        { k: 'lit', v: 'x' },
        { k: 'lit', v: 'v1' },
        { k: 'lit', v: 'init' },
        { k: 'nil' },
      ],
    ]);
    // `@`, `@p`, `@ud` all accept any knot.
    expect(expandPattern('[%x id=@ud ~]')).toEqual([
      [{ k: 'lit', v: 'x' }, { k: 'any' }, { k: 'nil' }],
    ]);
    expect(expandPattern('[%x %chan rest=*]')).toEqual([
      [{ k: 'lit', v: 'x' }, { k: 'lit', v: 'chan' }, { k: 'rest' }],
    ]);
  });

  it('expands a `?()` union into one alternative per member', () => {
    // This is what lets `?(%v0 %v1)` *reject* %v2 rather than fail open.
    expect(expandPattern('[%x ver=?(%v0 %v1) %init ~]')).toEqual([
      [
        { k: 'lit', v: 'x' },
        { k: 'lit', v: 'v0' },
        { k: 'lit', v: 'init' },
        { k: 'nil' },
      ],
      [
        { k: 'lit', v: 'x' },
        { k: 'lit', v: 'v1' },
        { k: 'lit', v: 'init' },
        { k: 'nil' },
      ],
    ]);
  });

  it('flattens a nested tuple, since a path pattern is right-nested', () => {
    expect(expandPattern('[%x %v1 [u=@ ~]]')).toEqual(
      expandPattern('[%x %v1 u=@ ~]')
    );
  });

  it('keeps a named mold opaque rather than calling it any knot', () => {
    // `=kind:c` is `?(%diary %heap %chat)`, not "any": it consumes a segment
    // without establishing the segment is accepted.
    expect(expandPattern('[%x kind=kind:c ~]')).toEqual([
      [{ k: 'lit', v: 'x' }, { k: 'opaque', name: 'kind:c' }, { k: 'nil' }],
    ]);
  });

  it('refuses a pattern it cannot read', () => {
    expect(expandPattern('[%x (got:by m k) ~]')).toBeNull();
  });

  it('keeps bracketed groups whole when splitting tokens', () => {
    expect(splitTokens('%x ?(%v0 %v1) [a b] ~')).toEqual([
      '%x',
      '?(%v0 %v1)',
      '[a b]',
      '~',
    ]);
  });
});

describe('comment stripping', () => {
  it('blanks a comment but keeps the line', () => {
    expect(stripComment('  [%x %v1 ~]  cor  :: handled like ?+  ==')).toBe(
      '  [%x %v1 ~]  cor'
    );
    expect(stripComment(':: whole line')).toBe('');
  });

  it('leaves a `::` inside a cord alone', () => {
    expect(stripComment("  =/  sep  '::'  :: the separator")).toBe(
      "  =/  sep  '::'"
    );
    expect(stripComment('  =/  t  "a::b"')).toBe('  =/  t  "a::b"');
  });

  it('stops a rune in a comment from swallowing the arms below it', () => {
    // Without stripping, the `==` in the comment closes the dispatcher early
    // and `/x/v2/init` reads as MISSING.
    const source = lines(`
++  peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %init ~]  ~  :: like ?+  ==
    [%x %v2 %init ~]  ~
  ==
--
`);
    const d = parseDispatcher(source, 0, source.length);
    expect(d?.arms.map((a) => a.patternText)).toEqual([
      '[%x %v1 %init ~]',
      '[%x %v2 %init ~]',
    ]);
  });
});

describe('dispatcher discovery', () => {
  const source = lines(`
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%x %v1 %init ~]           \`\`noun+!>(~)
    [%x %v1 %chan rest=*]      \`\`noun+!>(~)
  ::
      [%x %v1 %group id=@ ~]
    \`\`noun+!>(~)
  ==
--
`);

  it('reads arms laid out inline and on their own line', () => {
    const d = parseDispatcher(source, 0, source.length);
    expect(d?.subject).toBe('path');
    expect(d?.arms.map((a) => a.patternText)).toEqual([
      '[%x %v1 %init ~]',
      '[%x %v1 %chan rest=*]',
      '[%x %v1 %group id=@ ~]',
    ]);
    expect(d?.unparsedArms).toBe(0);
  });

  it('reports nothing when there is no `?+` to read', () => {
    expect(
      parseDispatcher(lines('++  on-peek\n  on-peek:def\n--'), 0, 3)
    ).toBeNull();
  });

  it('tells an arm pattern from a body expression at the same column', () => {
    expect(looksLikeArmPattern('[%x %v1 ~]')).toBe(true);
    expect(looksLikeArmPattern('%group-changed-3')).toBe(true);
    // A tuple of values, a wing dereference and a call are all expressions.
    expect(looksLikeArmPattern('[indices activity volume-settings]')).toBe(
      false
    );
    expect(looksLikeArmPattern('[id.pole %x]')).toBe(false);
    expect(looksLikeArmPattern('[%x (got:by m k)]')).toBe(false);
  });

  it('counts a line that wants to be a pattern and will not read as one', () => {
    // Discarding these silently is the one thing that cannot be allowed: the
    // arm is there, and every request it takes would read as absent.
    const odd = lines(`
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %new ~]  ~
    [%x %v1
      %split-over-two-lines ~]  ~
    [%x %v1 kind=foo.bar ~]  ~
  ==
`);
    const d = parseDispatcher(odd, 0, odd.length)!;
    expect(d.unparsedArms).toBe(2);
    expect(d.arms.filter((a) => a.parsed).map((a) => a.patternText)).toContain(
      '[%x %v1 %new ~]'
    );
  });

  it('classifies the pattern, not the body sitting beside it on the line', () => {
    // The body holds a call; judging the whole line on that discards a real
    // arm and reports the requests it takes as absent.
    const inline = lines(`
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 kind=foo.bar ~]  (serve path)
  ==
`);
    expect(parseDispatcher(inline, 0, inline.length)!.unparsedArms).toBe(1);
  });

  it('treats an unbalanced opener as the start of an arm it cannot read', () => {
    const split = lines(`
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [
      %x %v1 %init ~]  ~
  ==
`);
    expect(
      parseDispatcher(split, 0, split.length)!.unparsedArms
    ).toBeGreaterThan(0);
  });

  it('does not count a body expression as an arm it failed to read', () => {
    // Counting these would withhold MISSING from every agent whose arm bodies
    // run to more than one line, which is all of them.
    const bodies = lines(`
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %init ~]  ~
      [%x %v1 %rows ~]
    [indices activity volume-settings]
  ::
      [%x %v1 %row ~]
    [id.pole (got:on-event:a stream:base (slav %da id.pole))]
  ==
`);
    const d = parseDispatcher(bodies, 0, bodies.length)!;
    expect(d.unparsedArms).toBe(0);
    expect(d.arms.map((a) => a.patternText)).toEqual([
      '[%x %v1 %init ~]',
      '[%x %v1 %rows ~]',
      '[%x %v1 %row ~]',
    ]);
  });

  it('does not read a rune inside a cord as structure', () => {
    // The `==` in the tape would otherwise close the dispatcher early and
    // hide `/x/v2/init`.
    const quoted = lines(`
++  on-peek
  |=  =path
  ?+  path  [~ ~]
    [%x %v1 %init ~]  ~|('bad ?+ path ==' !!)
    [%x %v2 %init ~]  ~
  ==
`);
    const d = parseDispatcher(quoted, 0, quoted.length)!;
    expect(d.arms.map((a) => a.patternText)).toEqual([
      '[%x %v1 %init ~]',
      '[%x %v2 %init ~]',
    ]);
  });

  it('blanks cords and tapes, leaving the line length alone', () => {
    const blanked = blankQuoted(`=/  t  "a ?+ b"  cor`);
    expect(blanked).toHaveLength(`=/  t  "a ?+ b"  cor`.length);
    expect(blanked.trimEnd()).toBe('=/  t            cor');
    const cord = blankQuoted("=/  c  '=='  cor");
    expect(cord).toHaveLength("=/  c  '=='  cor".length);
    expect(cord).not.toContain('=='.concat(''));
    expect(cord).toContain('cor');
  });

  it('tells a default that answers nothing from one that may serve', () => {
    // Only `[~ ~]`, `~`, `!!` and `:def` answer nothing — as the *whole*
    // expression, or under a trace rune that only decorates the stack.
    // Anything else may take the pole no arm does, so an absence cannot be
    // claimed from the arms alone.
    expect(classifyDefault('[~ ~]')).toBe('empty');
    expect(classifyDefault('~')).toBe('empty');
    expect(classifyDefault('!!')).toBe('crash');
    expect(classifyDefault('~|(bad-watch-path+pole !!)')).toBe('crash');
    expect(classifyDefault('on-peek:def')).toBe('default-agent');
    expect(classifyDefault('  :def  ')).toBe('default-agent');
    expect(classifyDefault('(on-watch:def path)')).toBe('default-agent');
    expect(
      classifyDefault('~|("bad pole: {<pole>}" (on-watch:def pole))')
    ).toBe('default-agent');
    expect(classifyDefault('(serve-legacy pole)')).toBe('serves');
    expect(classifyDefault('(peek:old pole)')).toBe('serves');
  });

  it('reads a mixed default as undecidable, not as the failure inside it', () => {
    // A `!!` or a `:def` reached down one branch says nothing about the other,
    // which may serve the pole. Deciding on the substring made every such
    // default a nack, and so made a pole that falls through to it a blocking
    // MISSING the agent may not have.
    expect(classifyDefault('?.  flag  (serve pole)  !!')).toBe('serves');
    expect(classifyDefault('?:(flag !! (serve pole))')).toBe('serves');
    expect(classifyDefault('?.  flag  (serve pole)  on-watch:def')).toBe(
      'serves'
    );
    // And a trace rune around a served expression is still served.
    expect(classifyDefault('~|(%slow (serve-legacy pole))')).toBe('serves');
  });

  it('reads the default whether it sits on the header line or under it', () => {
    const inline = lines(
      '++  on-peek\n  ?+  path  [~ ~]\n    [%x %v1 ~]  ~\n  ==\n'
    );
    expect(parseDispatcher(inline, 0, inline.length)?.defaultKind).toBe(
      'empty'
    );
    const below = lines(
      '++  on-peek\n  ?+    path\n    (serve-legacy path)\n    [%x %v1 ~]  ~\n  ==\n'
    );
    expect(parseDispatcher(below, 0, below.length)?.defaultKind).toBe('serves');
  });

  it('indexes arms by name', () => {
    expect([...indexArms(source).keys()]).toEqual(['on-peek']);
  });
});

describe('the `%v0` injection channels and reel write', () => {
  it('reads an inline union', () => {
    const source = lines(`
++  peek
  |=  =(pole knot)
  =?  +.pole  !?=([?(%v0 %v1 %v2) *] +.pole)
    [%v0 +.pole]
  ?+    pole  [~ ~]
    [%x %v0 %hidden-posts ~]  ~
  ==
`);
    expect(versionInjection(source, 0, source.length)).toEqual({
      index: 1,
      members: ['v0', 'v1', 'v2'],
      inject: 'v0',
      line: 2,
    });
  });

  it('reads a union bound a line or two up, which is how reel writes it', () => {
    const source = lines(`
++  peek
  |=  =(pole knot)
  =/  any  ?(%v0 %v1)
  =?  +.pole  !?=([any *] +.pole)
    [%v0 +.pole]
  ?+  pole  [~ ~]
    [%x any %bait ~]  ~
  ==
`);
    expect(versionInjection(source, 0, source.length)?.members).toEqual([
      'v0',
      'v1',
    ]);
  });
});

describe('a subject rewritten before dispatch', () => {
  const source = lines(`
++  on-peek
  |=  =path
  =.  path
    ?>  ?=([%x *] path)
    t.path
  ?+  path  [~ ~]
    [%records ~]  ~
  ==
`);

  it('is seen, so the arms are known not to be written against the pole sent', () => {
    // %lanyard strips the care off `path`; matching the two would report a
    // MISSING the agent does not have.
    const d = parseDispatcher(source, 0, source.length)!;
    expect(rewritesSubject(source, 0, d.headerLine - 1, d.subject)).toBe(true);
  });

  it('sees a rebinding however the face is written', () => {
    const rewritten = (bind: string) => {
      const src = lines(`
++  on-peek
  |=  =path
  ${bind}
  ?+  path  [~ ~]
    [%v1 %init ~]  ~
  ==
`);
      const d = parseDispatcher(src, 0, src.length)!;
      return rewritesSubject(src, 0, d.headerLine - 1, d.subject);
    };
    // A `name=` prefix, a wing into the subject, and the other binding runes.
    expect(rewritten('=/  path=path  t.path')).toBe(true);
    expect(rewritten('=.  t.path  ~')).toBe(true);
    expect(rewritten('=*  path  t.path')).toBe(true);
    expect(rewritten('=+  path=t.path')).toBe(true);
    expect(rewritten('=;  path  ~')).toBe(true);
    // The face shorthand binds the subject too.
    expect(rewritten('=/  =path  t.path')).toBe(true);
    // A different name is a different binding — including when the subject is
    // only the *type* it is annotated with.
    expect(rewritten('=/  other  t.path')).toBe(false);
    expect(rewritten('=/  pathological  ~')).toBe(false);
    expect(rewritten('=/  other=path  ~')).toBe(false);
  });

  it('does not count a guard, which can only reject', () => {
    const guarded = lines(`
++  on-peek
  |=  =path
  ?>  ?=(^ path)
  ?+  path  [~ ~]
    [%x %v1 ~]  ~
  ==
`);
    const d = parseDispatcher(guarded, 0, guarded.length)!;
    expect(rewritesSubject(guarded, 0, d.headerLine - 1, d.subject)).toBe(
      false
    );
  });
});
