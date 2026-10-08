import { describe, expect, test } from 'vitest';

import {
  WorkspaceConfigWriteError,
  parseWorkspaceConfigBlob,
  readWorkspaceConfig,
  updateWorkspaceConfigBlob,
} from './workspaceConfig';

const bookClub = {
  ref: '~lagrev-ridsyp-nocsyx-lassul/book-club@0.1.0',
  places: { discussion: 'chat/~host/discussion' },
};

describe('parseWorkspaceConfigBlob', () => {
  test('an absent blob is empty', () => {
    expect(parseWorkspaceConfigBlob(null)).toEqual({ kind: 'empty' });
    expect(parseWorkspaceConfigBlob('')).toEqual({ kind: 'empty' });
  });

  test('reads a workspace config', () => {
    const blob = JSON.stringify({
      version: 2,
      bot: '~bot',
      instructions: 'Be brief.',
      kits: [bookClub],
    });
    expect(parseWorkspaceConfigBlob(blob)).toEqual({
      kind: 'config',
      config: {
        version: 2,
        bot: '~bot',
        instructions: 'Be brief.',
        kits: [bookClub],
      },
    });
  });

  test('keeps unknown keys at the top level and in kit entries', () => {
    const blob = JSON.stringify({
      version: 2,
      future: { a: 1 },
      kits: [{ ...bookClub, note: 'x' }],
    });
    expect(readWorkspaceConfig(blob)).toEqual({
      version: 2,
      future: { a: 1 },
      kits: [{ ...bookClub, note: 'x' }],
    });
  });

  test('skips malformed kit entries', () => {
    const blob = JSON.stringify({
      version: 2,
      kits: [bookClub, { places: {} }, 'nope'],
    });
    expect(readWorkspaceConfig(blob)?.kits).toEqual([bookClub]);
  });

  test('defaults a kit entry without places to an empty map', () => {
    const blob = JSON.stringify({ version: 2, kits: [{ ref: bookClub.ref }] });
    expect(readWorkspaceConfig(blob)?.kits).toEqual([
      { ref: bookClub.ref, places: {} },
    ]);
  });

  test('a later version is newer, and reads as unconfigured', () => {
    const blob = JSON.stringify({ version: 3, instructions: 'x' });
    expect(parseWorkspaceConfigBlob(blob)).toEqual({
      kind: 'newer',
      version: 3,
    });
    expect(readWorkspaceConfig(blob)).toBeNull();
  });

  test.each([
    ['not JSON', 'hello'],
    ['an array', '[1,2]'],
    ['no version', '{"instructions":"x"}'],
    ['the kits v1 shape', '{"version":1,"kits":[]}'],
    ['a mistyped field', '{"version":2,"instructions":5}'],
  ])('%s is foreign', (_, blob) => {
    expect(parseWorkspaceConfigBlob(blob)).toEqual({ kind: 'foreign' });
    expect(readWorkspaceConfig(blob)).toBeNull();
  });
});

describe('updateWorkspaceConfigBlob', () => {
  test('starts a document from an empty blob', () => {
    const blob = updateWorkspaceConfigBlob(null, (config) => ({
      ...config,
      instructions: 'Be brief.',
    }));
    expect(JSON.parse(blob!)).toEqual({
      version: 2,
      instructions: 'Be brief.',
    });
  });

  test('changes one field and keeps the rest, unknown keys included', () => {
    const before = JSON.stringify({
      version: 2,
      bot: '~bot',
      instructions: 'old',
      future: true,
      kits: [bookClub],
    });
    const blob = updateWorkspaceConfigBlob(before, (config) => ({
      ...config,
      instructions: 'new',
    }));
    expect(JSON.parse(blob!)).toEqual({
      version: 2,
      bot: '~bot',
      instructions: 'new',
      future: true,
      kits: [bookClub],
    });
  });

  test('clearing the last field writes no document', () => {
    const before = JSON.stringify({ version: 2, instructions: 'x', kits: [] });
    expect(
      updateWorkspaceConfigBlob(before, (config) => ({
        ...config,
        instructions: '',
      }))
    ).toBeNull();
  });

  test('drops empty known fields but keeps unknown ones as written', () => {
    const blob = updateWorkspaceConfigBlob(null, (config) => ({
      ...config,
      defaults: {},
      kits: [],
      future: [],
    }));
    expect(JSON.parse(blob!)).toEqual({ version: 2, future: [] });
  });

  test('the updater cannot change the version', () => {
    const blob = updateWorkspaceConfigBlob(null, (config) => ({
      ...config,
      version: 7 as 2,
      bot: '~bot',
    }));
    expect(JSON.parse(blob!).version).toBe(2);
  });

  test.each([
    ['newer', JSON.stringify({ version: 3 })],
    ['foreign', 'hello'],
  ])('refuses to overwrite a %s blob', (kind, blob) => {
    expect(() => updateWorkspaceConfigBlob(blob, (config) => config)).toThrow(
      new WorkspaceConfigWriteError(kind as 'newer' | 'foreign')
    );
  });
});
