import { describe, expect, it } from 'vitest';

import { parseGroupKitConfig } from './index.js';

const entry = {
  installId: 'book-club-0',
  kit: { id: 'book-club', version: '0.1.0', publisher: '~sampel-palnet' },
  places: { discussion: 'chat/~host/book-club-discussion-1234' },
  schedules: [{ id: 'monthly-pick', cron: '0 17 1 * *', enabled: false }],
  agents: ['~sampel-palnet'],
  setup: 'pending',
  permissions: ['postToPlaces'],
  installedAt: 1786149333904,
};

function blobOf(value: unknown) {
  return JSON.stringify(value);
}

describe('parseGroupKitConfig', () => {
  it('parses a version-1 payload', () => {
    expect(parseGroupKitConfig(blobOf({ version: 1, kits: [entry] }))).toEqual({
      version: 1,
      kits: [entry],
    });
  });

  it('applies defaults for the optional collections', () => {
    const bare = {
      installId: 'x',
      kit: { id: 'k', version: '0.1.0', publisher: '~zod' },
    };
    const parsed = parseGroupKitConfig(blobOf({ version: 1, kits: [bare] }));
    expect(parsed?.kits[0]).toMatchObject({
      places: {},
      schedules: [],
      agents: [],
      permissions: [],
      setup: 'done',
    });
  });

  it('skips a malformed entry without losing its siblings', () => {
    const parsed = parseGroupKitConfig(
      blobOf({ version: 1, kits: ['nonsense', entry, { installId: '' }] })
    );
    expect(parsed?.kits).toEqual([entry]);
  });

  it('reports why a payload was rejected', () => {
    const messages: string[] = [];
    parseGroupKitConfig('not json', { log: (m) => messages.push(m) });
    parseGroupKitConfig(blobOf({ version: 9, kits: [] }), {
      log: (m) => messages.push(m),
    });
    expect(messages).toEqual([
      'group blob is not JSON',
      'unsupported kits blob version 9',
    ]);
  });

  it('returns null for anything that is not a kits payload', () => {
    for (const value of [null, undefined, '', '   ', 'not json']) {
      expect(parseGroupKitConfig(value)).toBeNull();
    }
    expect(parseGroupKitConfig(blobOf({ hello: 'world' }))).toBeNull();
    expect(parseGroupKitConfig(blobOf({ version: 2, kits: [] }))).toBeNull();
  });
});
