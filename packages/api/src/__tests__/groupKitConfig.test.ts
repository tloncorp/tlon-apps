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
  installedAt: 1786149333904,
};

describe('parseGroupKitConfig', () => {
  test('parses a valid version-1 config', () => {
    const blob = JSON.stringify({ version: 1, kits: [validEntry] });
    expect(parseGroupKitConfig(blob)).toEqual({ kits: [validEntry] });
  });

  test('tolerates unknown keys', () => {
    const blob = JSON.stringify({
      version: 1,
      future: true,
      kits: [{ ...validEntry, extra: 'ignored' }],
    });
    expect(parseGroupKitConfig(blob)).toEqual({ kits: [validEntry] });
  });

  test('skips malformed kits[] entries', () => {
    const blob = JSON.stringify({
      version: 1,
      kits: [{ installId: 'broken' }, validEntry, 'nonsense'],
    });
    expect(parseGroupKitConfig(blob)).toEqual({ kits: [validEntry] });
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
