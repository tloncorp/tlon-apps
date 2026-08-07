import { describe, expect, it, test } from 'vitest';

import { canonicalizeNest, formatTargetHint } from './targets.js';
import { repairTlonCommandArgs } from './tlon-arg-repair.js';

describe('canonicalizeNest', () => {
  it('returns canonical form unchanged', () => {
    expect(canonicalizeNest('chat/~zod/general')).toBe('chat/~zod/general');
    expect(canonicalizeNest('heap/~bus/links')).toBe('heap/~bus/links');
    expect(canonicalizeNest('diary/~zod/notes')).toBe('diary/~zod/notes');
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

describe('formatTargetHint', () => {
  test('sends notes nests to the tool that can actually write them', () => {
    const hint = formatTargetHint('notes/~zod/research-1');
    expect(hint).toContain('note-create');
    expect(hint).toContain('notes/~zod/research-1');
  });

  test('strips the channel prefix from both the check and the suggestion', () => {
    const hint = formatTargetHint('tlon:notes/~zod/research-1');
    expect(hint).toContain('note-create notes/~zod/research-1');
    // A hint that echoes the prefix would produce another invalid command.
    expect(hint).not.toContain('tlon:notes');
  });

  test('suggests a command the argument repair will actually accept', () => {
    const hint = formatTargetHint('notes/~zod/research-1');
    // The hint used to name --stdin, which the repair refuses outright: the
    // recovery advice sent the model straight into a second rejection.
    // Asserting against the repair itself keeps the two from drifting.
    expect(hint).not.toContain('--stdin');
    const suggested = hint
      .slice(hint.indexOf('notes note-create'))
      .replace(/'.*$/s, '')
      .trim()
      .split(/\s+/);
    const repaired = repairTlonCommandArgs(suggested, {
      readFile: () => {
        throw new Error('not read in this test');
      },
    });
    expect(repaired.ok).toBe(true);
  });

  test('falls back to the plain list for everything else', () => {
    expect(formatTargetHint('chat/~zod/general')).not.toContain('note-create');
    expect(formatTargetHint()).not.toContain('note-create');
  });
});
