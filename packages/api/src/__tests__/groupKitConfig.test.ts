import { describe, expect, test } from 'vitest';

import { parseGroupKitConfig } from '../client/groupKitConfig';

const validEntry = {
  installId: 'book-club-0',
  kit: {
    id: 'book-club',
    version: '0.1.0',
    publisher: '~sampel-palnet',
  },
  places: {
    discussion: 'chat/~host/book-club-discussion-1234',
  },
  schedules: [{ id: 'monthly-pick', cron: '0 17 1 * *' }],
  agents: ['~sampel-palnet'],
  setup: 'pending',
  permissions: ['postToPlaces'],
  installedAt: 1786149333904,
};

describe('parseGroupKitConfig', () => {
  test('parses a valid version-1 config', () => {
    const blob = JSON.stringify({ version: 1, kits: [validEntry] });
    expect(parseGroupKitConfig(blob)).toEqual({
      version: 1,
      kits: [validEntry],
    });
  });

  // Unknown keys survive the round trip rather than being stripped. SCHEMA.md
  // requires blob writers to read-modify-write the whole payload, so a parser
  // that dropped fields it did not recognize would make an older client erase
  // a newer one's config on the next write.
  test('carries unknown keys through instead of dropping them', () => {
    const blob = JSON.stringify({
      version: 1,
      future: true,
      kits: [{ ...validEntry, extra: 'ignored' }],
    });
    expect(parseGroupKitConfig(blob)).toEqual({
      version: 1,
      kits: [{ ...validEntry, extra: 'ignored' }],
    });
  });

  test('skips malformed kits[] entries', () => {
    const blob = JSON.stringify({
      version: 1,
      kits: [{ installId: 'broken' }, validEntry, 'nonsense'],
    });
    expect(parseGroupKitConfig(blob)).toEqual({
      version: 1,
      kits: [validEntry],
    });
  });

  // Firing setup posts a conversation and writes scaffolds, so an absent or
  // unreadable value must not re-run it.
  test('defaults an absent or unreadable setup to done', () => {
    const { setup: _omitted, ...withoutSetup } = validEntry;
    const blob = JSON.stringify({ version: 1, kits: [withoutSetup] });
    expect(parseGroupKitConfig(blob)?.kits[0].setup).toBe('done');

    const garbled = JSON.stringify({
      version: 1,
      kits: [{ ...validEntry, setup: 'halfway' }],
    });
    expect(parseGroupKitConfig(garbled)?.kits[0].setup).toBe('done');
  });

  // The live agent writes epoch ms; SCHEMA.md's example shows an ISO string.
  test('accepts installedAt in either form', () => {
    const iso = JSON.stringify({
      version: 1,
      kits: [{ ...validEntry, installedAt: '2026-08-19T00:00:00.000Z' }],
    });
    expect(parseGroupKitConfig(iso)?.kits[0].installedAt).toBe(
      '2026-08-19T00:00:00.000Z'
    );
  });

  test('returns null for absent, non-JSON, or non-kit-config blobs', () => {
    expect(parseGroupKitConfig(null)).toBeNull();
    expect(parseGroupKitConfig(undefined)).toBeNull();
    expect(parseGroupKitConfig('')).toBeNull();
    expect(parseGroupKitConfig('not json')).toBeNull();
    expect(
      parseGroupKitConfig(JSON.stringify({ version: 2, kits: [] }))
    ).toBeNull();
    expect(parseGroupKitConfig(JSON.stringify({ hello: 'world' }))).toBeNull();
  });
});
