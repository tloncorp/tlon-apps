import { describe, expect, it, vi } from 'vitest';

import {
  createGroupConfigReader,
  parseGroupFlag,
  parseKitsBlob,
} from './group-config.js';

// Real blob value from a live install (JSON string in the group's `blob`
// field), with epoch-ms installedAt.
const LIVE_BLOB = JSON.stringify({
  version: 1,
  kits: [
    {
      installedAt: 1786149333904,
      schedules: [
        { id: 'monthly-pick', cron: '0 17 1 * *' },
        { id: 'weekly-nudge', cron: '0 17 * * 5' },
      ],
      kit: {
        publisher: '~lagrev-ridsyp-nocsyx-lassul',
        version: '0.1.0',
        id: 'book-club',
      },
      installId: 'book-club-0',
      places: {
        picks: 'chat/~lagrev-ridsyp-nocsyx-lassul/picks',
        discussion: 'chat/~lagrev-ridsyp-nocsyx-lassul/discussion',
        log: 'diary/~lagrev-ridsyp-nocsyx-lassul/log',
      },
      setup: 'pending',
      agents: ['~lagrev-ridsyp-nocsyx-lassul'],
    },
  ],
});

describe('parseKitsBlob', () => {
  it('parses a live blob payload', () => {
    const config = parseKitsBlob(LIVE_BLOB);
    expect(config).not.toBeNull();
    expect(config!.version).toBe(1);
    expect(config!.kits).toHaveLength(1);
    const entry = config!.kits[0];
    expect(entry.installId).toBe('book-club-0');
    expect(entry.kit.id).toBe('book-club');
    expect(entry.kit.publisher).toBe('~lagrev-ridsyp-nocsyx-lassul');
    expect(entry.places['discussion']).toBe(
      'chat/~lagrev-ridsyp-nocsyx-lassul/discussion'
    );
    // `enabled` is defaulted by the shared parser (TASK-13): a blob written
    // before the field existed reads as not enabled, never as running.
    expect(entry.schedules).toEqual([
      { id: 'monthly-pick', cron: '0 17 1 * *', enabled: false },
      { id: 'weekly-nudge', cron: '0 17 * * 5', enabled: false },
    ]);
    expect(entry.setup).toBe('pending');
    expect(entry.agents).toEqual(['~lagrev-ridsyp-nocsyx-lassul']);
  });

  it('accepts an ISO-string installedAt (SCHEMA.md variant)', () => {
    const blob = JSON.stringify({
      version: 1,
      kits: [
        {
          installId: 'x-0',
          kit: { id: 'x', version: '1.0.0', publisher: '~zod' },
          places: {},
          schedules: [],
          agents: [],
          setup: 'done',
          installedAt: '2026-07-29T00:00:00Z',
        },
      ],
    });
    expect(parseKitsBlob(blob)?.kits).toHaveLength(1);
  });

  it('tolerates unknown keys at every level', () => {
    const blob = JSON.stringify({
      version: 1,
      future: true,
      kits: [
        {
          installId: 'x-0',
          kit: { id: 'x', version: '1.0.0', publisher: '~zod', extra: 1 },
          places: {},
          schedules: [{ id: 's', cron: '* * * * *', description: 'later' }],
          agents: ['~zod'],
          setup: 'done',
          novel: { nested: true },
        },
      ],
    });
    const config = parseKitsBlob(blob);
    expect(config?.kits).toHaveLength(1);
  });

  it('skips malformed kits[] entries without throwing', () => {
    const log = vi.fn();
    const blob = JSON.stringify({
      version: 1,
      kits: [
        'not-an-object',
        { installId: '', kit: { id: 'x', version: '1', publisher: '~zod' } },
        {
          installId: 'ok-0',
          kit: { id: 'ok', version: '1', publisher: '~zod' },
        },
        { installId: 'no-kit-ref' },
      ],
    });
    const config = parseKitsBlob(blob, { log });
    expect(config?.kits).toHaveLength(1);
    expect(config?.kits[0].installId).toBe('ok-0');
    expect(log).toHaveBeenCalled();
  });

  it('rejects unknown versions', () => {
    expect(parseKitsBlob(JSON.stringify({ version: 2, kits: [] }))).toBeNull();
  });

  it('returns null for absent, non-JSON, and non-kits blobs', () => {
    expect(parseKitsBlob(null)).toBeNull();
    expect(parseKitsBlob(undefined)).toBeNull();
    expect(parseKitsBlob('')).toBeNull();
    expect(parseKitsBlob('not json {')).toBeNull();
    expect(parseKitsBlob(JSON.stringify({ theme: 'dark' }))).toBeNull();
    expect(parseKitsBlob(JSON.stringify(['array']))).toBeNull();
  });
});

describe('parseGroupFlag', () => {
  it('parses ~host/name', () => {
    expect(parseGroupFlag('~lagrev-ridsyp-nocsyx-lassul/book-club')).toEqual({
      host: '~lagrev-ridsyp-nocsyx-lassul',
      name: 'book-club',
    });
  });

  it('rejects malformed flags', () => {
    expect(parseGroupFlag('no-sig/name')).toBeNull();
    expect(parseGroupFlag('~zod')).toBeNull();
    expect(parseGroupFlag('~zod/name/extra')).toBeNull();
    expect(parseGroupFlag('~zod/../etc')).toBeNull();
  });
});

describe('createGroupConfigReader', () => {
  const FLAG = '~zod/club';

  it('scries the targeted group path and parses the blob', async () => {
    const scry = vi.fn().mockResolvedValue({ blob: LIVE_BLOB });
    const reader = createGroupConfigReader({ scry });
    const config = await reader.get(FLAG);
    expect(scry).toHaveBeenCalledWith('/groups/v3/ui/groups/~zod/club.json');
    expect(config?.kits[0].kit.id).toBe('book-club');
  });

  it('caches results (including negative) within the TTL', async () => {
    const scry = vi.fn().mockResolvedValue({ blob: null });
    let clock = 0;
    const reader = createGroupConfigReader({
      scry,
      ttlMs: 1_000,
      now: () => clock,
    });
    expect(await reader.get(FLAG)).toBeNull();
    expect(await reader.get(FLAG)).toBeNull();
    expect(scry).toHaveBeenCalledTimes(1);

    clock = 1_500; // Past TTL → refetch.
    await reader.get(FLAG);
    expect(scry).toHaveBeenCalledTimes(2);
  });

  it('invalidate forces a refetch before the TTL expires', async () => {
    const scry = vi.fn().mockResolvedValue({ blob: LIVE_BLOB });
    const reader = createGroupConfigReader({ scry, ttlMs: 60_000 });
    await reader.get(FLAG);
    reader.invalidate(FLAG);
    await reader.get(FLAG);
    expect(scry).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent reads', async () => {
    let resolveScry!: (value: unknown) => void;
    const scry = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveScry = resolve;
      })
    );
    const reader = createGroupConfigReader({ scry });
    const [a, b] = [reader.get(FLAG), reader.get(FLAG)];
    resolveScry({ blob: LIVE_BLOB });
    expect((await a)?.kits).toHaveLength(1);
    expect((await b)?.kits).toHaveLength(1);
    expect(scry).toHaveBeenCalledTimes(1);
  });

  it('returns null for a malformed group flag without scrying', async () => {
    const scry = vi.fn();
    const reader = createGroupConfigReader({ scry });
    expect(await reader.get('bad flag')).toBeNull();
    expect(scry).not.toHaveBeenCalled();
  });
});
