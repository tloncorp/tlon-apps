import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import path from 'path';

import {
  SURFACE_ERROR_CLASS,
  SURFACE_ERROR_CODES,
  SURFACE_KIND_TAILS,
  SurfaceError,
  type SurfaceErrorCode,
  assertSnapshotRecordValid,
  buildSurfaceBlob,
  canonicalJson,
  channelHostShip,
  observeUntil,
  parseSurfaceArgs,
  parseSurfaceNest,
  singleValue,
  surfaceError,
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

/**
 * The taxonomy, tested at runtime rather than only in the type checker —
 * `bun test` strips types, so a `Record` that stopped covering every code
 * would compile away silently in exactly the place this vocabulary is used.
 */
describe('error classification', () => {
  it('classifies every code, and no code that does not exist', () => {
    expect(Object.keys(SURFACE_ERROR_CLASS).sort()).toEqual(
      [...SURFACE_ERROR_CODES].sort()
    );
  });

  it('only ever says author or environment', () => {
    for (const value of Object.values(SURFACE_ERROR_CLASS)) {
      expect(['author', 'environment']).toContain(value);
    }
  });

  it('puts the class on the error and in the details a bot reads', () => {
    const authored = surfaceError('invalid-ops', 'bad op');
    expect(authored.errorClass).toBe('author');
    expect(authored.details.errorClass).toBe('author');

    const refused = surfaceError('state-too-large', 'too big');
    expect(refused.errorClass).toBe('environment');
    expect(refused.details.errorClass).toBe('environment');
  });

  it('does not let a call site relabel its own failure', () => {
    const error = surfaceError('state-too-large', 'too big', {
      errorClass: 'author',
    });
    expect(error.details.errorClass).toBe('environment');
  });
});

describe('assertSnapshotRecordValid', () => {
  it('passes a record the schema accepts', () => {
    expect(() =>
      assertSnapshotRecordValid(
        { validateEntry: () => ({ ok: true }) },
        {},
        { channel: 'chat/~zod/dash', specRevision: 2 }
      )
    ).not.toThrow();
  });

  it('refuses with a system code, not an author code', () => {
    let thrown: SurfaceError | null = null;
    try {
      assertSnapshotRecordValid(
        {
          validateEntry: () => ({
            ok: false,
            issues: ['snapshot state exceeds 131072 bytes'],
          }),
        },
        {},
        { channel: 'chat/~zod/dash', specRevision: 2 }
      );
    } catch (error) {
      thrown = error as SurfaceError;
    }
    expect(thrown?.code).toBe('state-too-large');
    expect(thrown?.errorClass).toBe('environment');
    // The schema's own words travel, so the message can never be more
    // specific about the cause than what actually failed.
    expect(thrown?.message).toContain('snapshot state exceeds 131072 bytes');
    expect(thrown?.details.issues).toEqual([
      'snapshot state exceeds 131072 bytes',
    ]);
  });
});

/**
 * The doctrine the bot follows and the classification the CLI emits are two
 * statements of the same fact, and they are written in different files by
 * different hands. When they disagree the bot does the wrong thing
 * confidently: a system-level refusal documented as an author error sends it
 * to rewrite a working app instead of repairing a channel.
 *
 * So SKILL.md's table is checked against the code, not merely proofread. It
 * does not have to name every code — an undocumented code falls through to
 * `details.errorClass` — but every code it DOES name must be filed under the
 * class the CLI actually gives it.
 */
describe('SKILL.md failure doctrine', () => {
  const doc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'skills', 'surfaces', 'SKILL.md'),
    'utf-8'
  );

  /** `| \`a\`, \`b\` | environment | … |` → [['a','environment'], …] */
  function documentedClasses(): [string, string][] {
    const rows: [string, string][] = [];
    for (const line of doc.split('\n')) {
      const cells = line.split('|').map((cell) => cell.trim());
      // [leading empty, codes, class, …]
      if (cells.length < 4) continue;
      const declared = cells[2];
      if (declared !== 'author' && declared !== 'environment') continue;
      for (const match of cells[1].matchAll(/`([a-z-]+)`/g)) {
        rows.push([match[1], declared]);
      }
    }
    return rows;
  }

  it('documents at least the codes a publish or repair loop branches on', () => {
    const documented = new Set(documentedClasses().map(([code]) => code));
    for (const code of [
      'lint-failed',
      'invalid-ops',
      'migration-pending',
      'state-too-large',
      'publish-unconfirmed',
      'post-unconfirmed',
    ]) {
      expect(documented).toContain(code);
    }
  });

  it('files every code it names under the class the CLI gives it', () => {
    const rows = documentedClasses();
    expect(rows.length).toBeGreaterThan(0);
    const known: readonly string[] = SURFACE_ERROR_CODES;
    for (const [code, declared] of rows) {
      expect(known).toContain(code);
      // Paired with the code so a mismatch names the row that is wrong.
      expect([code, SURFACE_ERROR_CLASS[code as SurfaceErrorCode]]).toEqual([
        code,
        declared,
      ]);
    }
  });
});
