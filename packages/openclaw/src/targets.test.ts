import { describe, expect, it } from 'vitest';

import { canonicalizeNest, parseTlonTarget } from './targets.js';

describe('canonicalizeNest', () => {
  it('returns canonical form unchanged', () => {
    expect(canonicalizeNest('chat/~zod/general')).toBe('chat/~zod/general');
    expect(canonicalizeNest('heap/~bus/links')).toBe('heap/~bus/links');
    expect(canonicalizeNest('diary/~zod/notes')).toBe('diary/~zod/notes');
    expect(canonicalizeNest('notes/~zod/field-notes')).toBe(
      'notes/~zod/field-notes'
    );
  });

  it('adds missing ~ on host ship', () => {
    expect(canonicalizeNest('chat/zod/general')).toBe('chat/~zod/general');
    expect(canonicalizeNest('heap/sampel-palnet/links')).toBe(
      'heap/~sampel-palnet/links'
    );
  });

  it('lowercases the nest prefix', () => {
    expect(canonicalizeNest('CHAT/~zod/general')).toBe('chat/~zod/general');
    expect(canonicalizeNest('Heap/~zod/links')).toBe('heap/~zod/links');
  });

  it('lowercases the host ship (Urbit @p is always lowercase)', () => {
    expect(canonicalizeNest('chat/~ZOD/general')).toBe('chat/~zod/general');
    expect(canonicalizeNest('chat/ZOD/general')).toBe('chat/~zod/general');
    expect(canonicalizeNest('chat/~Sampel-Palnet/foo')).toBe(
      'chat/~sampel-palnet/foo'
    );
  });

  it('canonicalizes a notes nest as a supported outbound channel', () => {
    expect(canonicalizeNest('Notes/ZOD/Field-Notes', 'notes')).toBe(
      'notes/~zod/Field-Notes'
    );
    expect(canonicalizeNest('Notes/ZOD/Field-Notes')).toBe(
      'notes/~zod/Field-Notes'
    );
  });

  it('preserves channel-name case', () => {
    expect(canonicalizeNest('chat/~zod/General')).toBe('chat/~zod/General');
    expect(canonicalizeNest('chat/~zod/q6QH2RoI')).toBe('chat/~zod/q6QH2RoI');
  });

  it('trims surrounding whitespace', () => {
    expect(canonicalizeNest('  chat/~zod/general  ')).toBe('chat/~zod/general');
  });

  it('returns null for invalid inputs', () => {
    expect(canonicalizeNest('')).toBeNull();
    expect(canonicalizeNest('not-a-nest')).toBeNull();
    expect(canonicalizeNest('chat/~zod')).toBeNull();
    expect(canonicalizeNest('chat/~zod/general/extra')).toBeNull();
    expect(canonicalizeNest('foo/~zod/general')).toBeNull(); // unsupported prefix
  });
});

describe('parseTlonTarget', () => {
  it('keeps notebooks distinct from chat-like channels', () => {
    expect(parseTlonTarget('notes/~zod/field-notes')).toEqual({
      kind: 'notebook',
      nest: 'notes/~zod/field-notes',
      hostShip: '~zod',
      notebookName: 'field-notes',
    });
    expect(parseTlonTarget('chat/~zod/general')).toEqual({
      kind: 'channel',
      nest: 'chat/~zod/general',
      hostShip: '~zod',
      channelName: 'general',
    });
  });
});
