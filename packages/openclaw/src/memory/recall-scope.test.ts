import { beforeEach, describe, expect, it } from 'vitest';

import { clearGroupIndexForTest, updateGroupIndex } from './group-index.js';
import {
  buildRecallSessionKeys,
  canShipReadNest,
  siblingReadableFromCurrent,
} from './recall-scope.js';

const GROUP = '~zod/tlon-core';
const GENERAL = 'chat/~zod/general';
const DEV = 'chat/~zod/dev';
const HIRING = 'chat/~zod/hiring';
const SECRET = 'chat/~zod/secret';

function indexGroup(overrides?: {
  readers?: Map<string, string[]>;
  seats?: Map<string, string[]> | 'too-large';
}) {
  updateGroupIndex({
    channelToGroup: new Map([
      [GENERAL, GROUP],
      [DEV, GROUP],
      [HIRING, GROUP],
      [SECRET, GROUP],
    ]),
    channelReaders:
      overrides?.readers ??
      new Map([
        [GENERAL, []],
        [DEV, []],
        [HIRING, ['admin']],
        [SECRET, ['admin', 'exec']],
      ]),
    groupSeats: new Map([
      [
        GROUP,
        overrides?.seats ??
          new Map([
            ['~nec', []],
            ['~bus', ['admin']],
          ]),
      ],
    ]),
  });
}

beforeEach(() => {
  clearGroupIndexForTest();
});

describe('canShipReadNest', () => {
  it('member with no roles reads open channels only', () => {
    indexGroup();
    expect(canShipReadNest('~nec', GENERAL)).toBe(true);
    expect(canShipReadNest('~nec', HIRING)).toBe(false);
  });

  it('member with a matching role reads the restricted channel', () => {
    indexGroup();
    expect(canShipReadNest('~bus', HIRING)).toBe(true);
    expect(canShipReadNest('~bus', SECRET)).toBe(true);
  });

  it('group host reads everything', () => {
    indexGroup();
    expect(canShipReadNest('~zod', HIRING)).toBe(true);
    expect(canShipReadNest('~zod', SECRET)).toBe(true);
  });

  it('non-member fails closed', () => {
    indexGroup();
    expect(canShipReadNest('~wex', GENERAL)).toBe(false);
  });

  it('fails closed when seats were not captured', () => {
    indexGroup({ seats: 'too-large' });
    expect(canShipReadNest('~nec', GENERAL)).toBe(false);
    expect(canShipReadNest('~zod', GENERAL)).toBe(true); // host needs no seats
  });

  it('fails closed on unknown readers and unindexed nests', () => {
    indexGroup({
      readers: new Map([
        [GENERAL, ['__unknown__']],
        [DEV, []],
        [HIRING, ['admin']],
        [SECRET, ['admin']],
      ]),
    });
    expect(canShipReadNest('~zod', GENERAL)).toBe(false);
    expect(canShipReadNest('~nec', 'chat/~zod/nowhere')).toBe(false);
  });
});

describe('siblingReadableFromCurrent', () => {
  it('admits open siblings from any channel', () => {
    indexGroup();
    expect(siblingReadableFromCurrent(HIRING, GENERAL)).toBe(true);
    expect(siblingReadableFromCurrent(GENERAL, DEV)).toBe(true);
  });

  it('blocks narrower siblings from an open channel', () => {
    indexGroup();
    expect(siblingReadableFromCurrent(GENERAL, HIRING)).toBe(false);
  });

  it('admits a sibling whose readers contain the current readers', () => {
    indexGroup();
    // HIRING readers [admin] ⊆ SECRET readers [admin, exec]: everyone in
    // HIRING can read SECRET, so SECRET content may enter HIRING.
    expect(siblingReadableFromCurrent(HIRING, SECRET)).toBe(true);
    // Reverse fails: exec is not in HIRING's reader set.
    expect(siblingReadableFromCurrent(SECRET, HIRING)).toBe(false);
  });

  it('fails closed across groups, unknown readers, and unindexed nests', () => {
    indexGroup();
    updateGroupIndex({
      channelToGroup: new Map([['chat/~wex/other', '~wex/elsewhere']]),
      channelReaders: new Map([['chat/~wex/other', []]]),
    });
    expect(siblingReadableFromCurrent(GENERAL, 'chat/~wex/other')).toBe(false);
    expect(siblingReadableFromCurrent(GENERAL, 'chat/~zod/nowhere')).toBe(
      false
    );
    indexGroup({
      readers: new Map([
        [GENERAL, ['__unknown__']],
        [DEV, []],
        [HIRING, ['admin']],
        [SECRET, ['admin']],
      ]),
    });
    expect(siblingReadableFromCurrent(GENERAL, DEV)).toBe(false);
  });
});

describe('buildRecallSessionKeys', () => {
  it('DM scope: the DM plus channels the ship can read, both spellings', () => {
    indexGroup();
    const keys = buildRecallSessionKeys('agent:main:tlon:direct:~bus');
    expect(keys).toContain('agent:main:tlon:direct:~bus');
    expect(keys).toContain(`agent:main:tlon:group:${GENERAL}`);
    expect(keys).toContain(`agent:main:tlon:channel:${GENERAL}`);
    expect(keys).toContain(`agent:main:tlon:group:${HIRING}`);
    // ~bus lacks the exec role but admin is in SECRET's readers
    expect(keys).toContain(`agent:main:tlon:group:${SECRET}`);
  });

  it('DM scope excludes channels the ship cannot read', () => {
    indexGroup();
    const keys = buildRecallSessionKeys('agent:main:tlon:direct:~nec');
    expect(keys).toContain(`agent:main:tlon:group:${GENERAL}`);
    expect(keys).not.toContain(`agent:main:tlon:group:${HIRING}`);
    expect(keys).not.toContain(`agent:main:tlon:channel:${HIRING}`);
  });

  it('DM scope with no seats captured falls back to the DM alone', () => {
    indexGroup({ seats: 'too-large' });
    const keys = buildRecallSessionKeys('agent:main:tlon:direct:~nec');
    expect(keys).toEqual(['agent:main:tlon:direct:~nec']);
  });

  it('channel scope: own keys plus contained siblings, never DMs', () => {
    indexGroup();
    const keys = buildRecallSessionKeys(`agent:main:tlon:group:${GENERAL}`);
    expect(keys).toContain(`agent:main:tlon:group:${GENERAL}`);
    expect(keys).toContain(`agent:main:tlon:channel:${GENERAL}`);
    expect(keys).toContain(`agent:main:tlon:group:${DEV}`);
    expect(keys).not.toContain(`agent:main:tlon:group:${HIRING}`);
    expect(keys.some((k) => k.includes(':direct:'))).toBe(false);
  });

  it('restricted channel scope includes open siblings', () => {
    indexGroup();
    const keys = buildRecallSessionKeys(`agent:main:tlon:group:${HIRING}`);
    expect(keys).toContain(`agent:main:tlon:group:${HIRING}`);
    expect(keys).toContain(`agent:main:tlon:group:${GENERAL}`);
    expect(keys).toContain(`agent:main:tlon:group:${SECRET}`);
  });

  it('strips the active-memory suffix before scoping', () => {
    indexGroup();
    const keys = buildRecallSessionKeys(
      'agent:main:tlon:direct:~bus:active-memory:abc123'
    );
    expect(keys).toContain('agent:main:tlon:direct:~bus');
  });

  it('returns empty for unparseable keys', () => {
    expect(buildRecallSessionKeys('agent:main:discord:channel:123')).toEqual(
      []
    );
    expect(buildRecallSessionKeys('')).toEqual([]);
  });
});
