import { describe, expect, it } from 'vitest';

import {
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
