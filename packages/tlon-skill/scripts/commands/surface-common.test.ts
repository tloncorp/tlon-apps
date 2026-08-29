import { describe, expect, it } from 'bun:test';

import {
  SURFACE_KIND_TAILS,
  SurfaceError,
  buildSurfaceBlob,
  canonicalJson,
  channelHostShip,
  observeUntil,
  parseSurfaceArgs,
  parseSurfaceNest,
  singleValue,
  surfaceWireKind,
} from './surface-common';

const HELP = 'usage: test';

describe('canonicalJson', () => {
  it('is insensitive to key order at every depth', () => {
    expect(canonicalJson({ b: { d: 1, c: 2 }, a: [3, { f: 4, e: 5 }] })).toBe(
      canonicalJson({ a: [3, { e: 5, f: 4 }], b: { c: 2, d: 1 } })
    );
  });

  it('is sensitive to array order, which is meaning', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('drops undefined the way JSON.stringify does', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it('distinguishes values a loose comparison would merge', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: '1' }));
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}));
  });
});

describe('surface blobs', () => {
  it('always writes exactly one entry', () => {
    const blob = buildSurfaceBlob({ type: 'surface-event' });
    expect(JSON.parse(blob)).toEqual([{ type: 'surface-event' }]);
  });
});

describe('kinds and nests', () => {
  it('builds the wire kind a surface post must carry', () => {
    expect(surfaceWireKind('event')).toBe('/chat/surface/event');
    expect(surfaceWireKind('spec')).toBe('/chat/surface/spec');
    expect(surfaceWireKind('snapshot')).toBe('/chat/surface/snapshot');
    expect(Object.values(SURFACE_KIND_TAILS)).toEqual([
      'surface/spec',
      'surface/event',
      'surface/snapshot',
    ]);
  });

  it('reads the host out of a nest and rejects a non-nest', () => {
    expect(channelHostShip('chat/~zod/dash')).toBe('~zod');
    expect(parseSurfaceNest('chat/~zod/dash')).toEqual({
      kind: 'chat',
      host: '~zod',
      name: 'dash',
    });
    expect(() => parseSurfaceNest('~zod/dash')).toThrow(SurfaceError);
    expect(() => parseSurfaceNest('chat//dash')).toThrow(SurfaceError);
  });
});

describe('parseSurfaceArgs', () => {
  const spec = {
    value: ['--title', '--del'],
    pair: ['--set'],
    boolean: ['--json'],
  } as const;

  it('keeps every occurrence in argv order', () => {
    const parsed = parseSurfaceArgs(
      ['x', '--set', '/a', '1', '--del', '/b', '--set', '/c', '2'],
      spec,
      HELP
    );
    expect(parsed.positional).toEqual(['x']);
    expect(parsed.ordered).toEqual([
      { flag: '--set', values: ['/a', '1'] },
      { flag: '--del', values: ['/b'] },
      { flag: '--set', values: ['/c', '2'] },
    ]);
    expect(singleValue(parsed, '--del')).toBe('/b');
  });

  it('refuses an unknown option instead of ignoring it', () => {
    expect(() => parseSurfaceArgs(['--nope'], spec, HELP)).toThrow(
      SurfaceError
    );
  });

  it('refuses a flag with a missing value', () => {
    expect(() => parseSurfaceArgs(['--title'], spec, HELP)).toThrow(
      SurfaceError
    );
    expect(() => parseSurfaceArgs(['--set', '/a'], spec, HELP)).toThrow(
      SurfaceError
    );
  });

  it('stops at help wherever it appears', () => {
    expect(parseSurfaceArgs(['a', '--help'], spec, HELP).help).toBe(true);
    expect(parseSurfaceArgs(['-h'], spec, HELP).help).toBe(true);
  });

  it('lets a negative-looking value through as a value', () => {
    const parsed = parseSurfaceArgs(['--title', '-1'], spec, HELP);
    expect(singleValue(parsed, '--title')).toBe('-1');
  });
});

describe('observeUntil', () => {
  const deps = { sleep: async () => {} };

  it('stops at the first success and reports the attempt count', async () => {
    let calls = 0;
    const result = await observeUntil(
      deps,
      { attempts: 5, intervalMs: 0 },
      async () => {
        calls += 1;
        return calls === 3
          ? { done: true as const, value: 'seen' }
          : { done: false as const, detail: `not yet (${calls})` };
      }
    );
    expect(result).toEqual({ ok: true, value: 'seen', attempts: 3 });
    expect(calls).toBe(3);
  });

  it('carries the last probe detail, not a generic timeout', async () => {
    const result = await observeUntil(
      deps,
      { attempts: 2, intervalMs: 0 },
      async () => ({ done: false as const, detail: 'groups never listed it' })
    );
    expect(result).toEqual({
      ok: false,
      detail: 'groups never listed it',
      attempts: 2,
    });
  });

  it('does not sleep after the final attempt', async () => {
    const sleeps: number[] = [];
    await observeUntil(
      {
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
      { attempts: 3, intervalMs: 7 },
      async () => ({ done: false as const, detail: 'no' })
    );
    expect(sleeps).toEqual([7, 7]);
  });
});
