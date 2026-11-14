import { describe, expect, it } from 'vitest';

import {
  canonicalizeNest,
  parseShipInput,
  parseTlonTarget,
  shipDisplayId,
} from './targets.js';

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

describe('shipDisplayId', () => {
  it('shows a ship as its dotted number', () => {
    expect(shipDisplayId('~zod')).toBe('0');
    expect(shipDisplayId('~sampel-palnet')).toBe('1.624.961.343');
    expect(shipDisplayId('sampel-palnet')).toBe('1.624.961.343');
  });

  it('returns input that is not a ship unchanged', () => {
    expect(shipDisplayId('~robin-dasler')).toBe('~robin-dasler');
  });
});

describe('parseShipInput', () => {
  it('accepts a ship with or without its sig', () => {
    expect(parseShipInput('~sampel-palnet')).toBe('~sampel-palnet');
    expect(parseShipInput(' Sampel-Palnet ')).toBe('~sampel-palnet');
  });

  it('accepts the number, dotted or not', () => {
    expect(parseShipInput('1.624.961.343')).toBe('~sampel-palnet');
    expect(parseShipInput('1624961343')).toBe('~sampel-palnet');
    expect(parseShipInput('0')).toBe('~zod');
  });

  it('rejects anything else', () => {
    expect(parseShipInput('~robin-dasler')).toBeNull();
    expect(parseShipInput('1.62.4')).toBeNull();
    expect(parseShipInput(String(2n ** 128n))).toBeNull();
    expect(parseShipInput('')).toBeNull();
  });
});
