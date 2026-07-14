import { describe, expect, it } from 'vitest';

import { matchScope, parseScope, scopeKey } from './scopes.js';

describe('parseScope', () => {
  it('parses each scope kind', () => {
    expect(parseScope('~sampel-palnet')).toEqual({
      kind: 'dm',
      ship: '~sampel-palnet',
    });
    expect(parseScope('0v5.abcde')).toEqual({ kind: 'club', id: '0v5.abcde' });
    expect(parseScope('chat/~zod/general')).toEqual({
      kind: 'channel',
      nest: 'chat/~zod/general',
    });
    expect(parseScope('chat/~zod/general/170.141.184')).toEqual({
      kind: 'thread',
      nest: 'chat/~zod/general',
      parentId: '170141184',
    });
  });

  it('normalizes ship case and missing sig', () => {
    expect(parseScope('SAMPEL')).toBeNull(); // no sig, not a nest
    expect(parseScope('~SAMPEL')).toEqual({ kind: 'dm', ship: '~sampel' });
    expect(parseScope('chat/~ZOD/general')?.kind).toBe('channel');
  });

  it('rejects garbage', () => {
    expect(parseScope('')).toBeNull();
    expect(parseScope('chat/general')).toBeNull();
    expect(parseScope('chat/~zod/general/x/y')).toBeNull();
  });
});

describe('matchScope', () => {
  const scopes = [
    parseScope('~ten')!,
    parseScope('chat/~zod/general')!,
    parseScope('chat/~zod/dev/170.141.184')!,
  ];

  it('matches DMs by counterparty', () => {
    expect(matchScope(scopes, { whom: '~ten' })?.kind).toBe('dm');
    expect(matchScope(scopes, { whom: '~bus' })).toBeUndefined();
  });

  it('matches channel scopes for posts and their threads', () => {
    expect(
      matchScope(scopes, { nest: 'chat/~zod/general' })?.kind
    ).toBe('channel');
    expect(
      matchScope(scopes, {
        nest: 'chat/~zod/general',
        parentId: '1.234',
      })?.kind
    ).toBe('channel');
  });

  it('matches thread scopes only under the claimed post', () => {
    expect(
      matchScope(scopes, {
        nest: 'chat/~zod/dev',
        parentId: '170141184',
      })?.kind
    ).toBe('thread');
    expect(
      matchScope(scopes, { nest: 'chat/~zod/dev', parentId: '999' })
    ).toBeUndefined();
    expect(matchScope(scopes, { nest: 'chat/~zod/dev' })).toBeUndefined();
  });

  it('scopeKey round-trips through parseScope', () => {
    for (const scope of scopes) {
      expect(scopeKey(parseScope(scopeKey(scope))!)).toBe(scopeKey(scope));
    }
  });
});
