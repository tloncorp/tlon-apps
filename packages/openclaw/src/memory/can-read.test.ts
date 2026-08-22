import { describe, expect, it } from 'vitest';

import { type GroupSnapshot, audienceContains, canRead } from './can-read.js';

const NEST_OPEN = 'chat/~zod/general';
const NEST_ADMIN = 'chat/~zod/hiring';

function snapshot(overrides?: Partial<GroupSnapshot>): GroupSnapshot {
  return {
    hostShip: '~zod',
    seats: new Map([
      ['~nec', ['member']],
      ['~bus', ['member', 'admin']],
      ['~wex', []],
    ]),
    bannedShips: new Set(['~wex']),
    channelReaders: new Map([
      [NEST_OPEN, []],
      [NEST_ADMIN, ['admin']],
    ]),
    ...overrides,
  };
}

describe('canRead', () => {
  it('lets any member read an open channel', () => {
    expect(canRead('~nec', NEST_OPEN, snapshot())).toBe(true);
  });

  it('requires an intersecting role for a restricted channel', () => {
    expect(canRead('~bus', NEST_ADMIN, snapshot())).toBe(true);
    expect(canRead('~nec', NEST_ADMIN, snapshot())).toBe(false);
  });

  it('host bypasses everything', () => {
    expect(canRead('~zod', NEST_ADMIN, snapshot())).toBe(true);
  });

  it('non-members and banned ships read nothing', () => {
    expect(canRead('~sampel', NEST_OPEN, snapshot())).toBe(false);
    expect(canRead('~wex', NEST_OPEN, snapshot())).toBe(false);
  });

  it('fails closed on unknown channels and unknown kinds', () => {
    expect(canRead('~nec', 'chat/~zod/mystery', snapshot())).toBe(false);
    expect(canRead('~nec', 'notes/~zod/book', snapshot())).toBe(false);
  });
});

describe('audienceContains', () => {
  it('open → restricted is allowed (restricted readers ⊂ open readers)', () => {
    // Memory FROM the open channel INTO the restricted one: everyone who
    // can read #hiring can also read #general.
    expect(audienceContains(NEST_ADMIN, NEST_OPEN, snapshot())).toBe(true);
  });

  it('restricted → open is refused', () => {
    // Memory FROM #hiring INTO #general: ~nec reads #general but not
    // #hiring, so the containment fails.
    expect(audienceContains(NEST_OPEN, NEST_ADMIN, snapshot())).toBe(false);
  });
});
