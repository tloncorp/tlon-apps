import { describe, expect, it } from 'bun:test';

import {
  type RawGroupForAdminVerification,
  actingShipCanAdminister,
  getShipRecordValue,
  seatHasRole,
  shipIsBanned,
  shipIsSeated,
} from './groups-verification';

// Minimal stand-in for the real `preSig`-based normalizer: ensure a leading sig.
const normalizeShip = (ship: string): string =>
  ship.startsWith('~') ? ship : `~${ship}`;

const HOST = '~ravmel-ropdyl';
const ADMIN = '~admin-ship';
const MEMBER = '~lorhep-binfen';

describe('getShipRecordValue', () => {
  it('returns undefined for a missing record', () => {
    expect(
      getShipRecordValue(undefined, MEMBER, normalizeShip)
    ).toBeUndefined();
  });

  it('matches on the raw key directly', () => {
    const record = { [MEMBER]: { roles: ['admin'] } };
    expect(getShipRecordValue(record, MEMBER, normalizeShip)).toEqual({
      roles: ['admin'],
    });
  });

  it('falls back to a normalized comparison for unnormalized keys', () => {
    // record key has the sig, lookup ship does not
    const record = { '~zod': 7 };
    expect(getShipRecordValue(record, 'zod', normalizeShip)).toBe(7);
  });

  it('returns undefined when the ship is absent', () => {
    expect(
      getShipRecordValue({ [HOST]: 1 }, MEMBER, normalizeShip)
    ).toBeUndefined();
  });
});

describe('seatHasRole', () => {
  const group: RawGroupForAdminVerification = {
    seats: { [MEMBER]: { roles: ['admin', 'editor'] } },
  };

  it('is true when the seat holds the role', () => {
    expect(seatHasRole(group, MEMBER, 'admin', normalizeShip)).toBe(true);
  });

  it('is false when the seat lacks the role', () => {
    expect(seatHasRole(group, MEMBER, 'moderator', normalizeShip)).toBe(false);
  });

  it('is false when the ship has no seat', () => {
    expect(seatHasRole(group, HOST, 'admin', normalizeShip)).toBe(false);
  });
});

describe('shipIsSeated', () => {
  const group: RawGroupForAdminVerification = {
    seats: { [MEMBER]: { roles: [] } },
  };

  it('is true for a seated ship', () => {
    expect(shipIsSeated(group, MEMBER, normalizeShip)).toBe(true);
  });

  it('is false for a ship without a seat', () => {
    expect(shipIsSeated(group, HOST, normalizeShip)).toBe(false);
  });
});

describe('shipIsBanned', () => {
  const group: RawGroupForAdminVerification = {
    admissions: { banned: { ships: ['~zod'] } },
  };

  it('is true for a banned ship (normalized match)', () => {
    expect(shipIsBanned(group, 'zod', normalizeShip)).toBe(true);
  });

  it('is false for a ship that is not banned', () => {
    expect(shipIsBanned(group, MEMBER, normalizeShip)).toBe(false);
  });

  it('is false when there is no ban list', () => {
    expect(shipIsBanned({}, MEMBER, normalizeShip)).toBe(false);
  });
});

describe('actingShipCanAdminister', () => {
  it('allows the host even without a seat', () => {
    const group: RawGroupForAdminVerification = {};
    expect(actingShipCanAdminister(group, HOST, HOST, normalizeShip)).toEqual({
      ok: true,
    });
  });

  it('allows a member holding a role listed in admins', () => {
    const group: RawGroupForAdminVerification = {
      admins: ['admin'],
      seats: { [ADMIN]: { roles: ['admin'] } },
    };
    expect(actingShipCanAdminister(group, ADMIN, HOST, normalizeShip)).toEqual({
      ok: true,
    });
  });

  it('allows a custom (non-"admin") admin role id', () => {
    const group: RawGroupForAdminVerification = {
      admins: ['steward'],
      seats: { [ADMIN]: { roles: ['steward'] } },
    };
    expect(actingShipCanAdminister(group, ADMIN, HOST, normalizeShip)).toEqual({
      ok: true,
    });
  });

  it('refuses a non-admin member and names the host', () => {
    const group: RawGroupForAdminVerification = {
      admins: ['admin'],
      seats: { [MEMBER]: { roles: ['member'] } },
    };
    const result = actingShipCanAdminister(group, MEMBER, HOST, normalizeShip);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain(MEMBER);
      expect(result.reason).toContain(HOST);
    }
  });

  it('refuses a ship that is not in the group', () => {
    const group: RawGroupForAdminVerification = {
      admins: ['admin'],
      seats: { [HOST]: { roles: ['admin'] } },
    };
    const result = actingShipCanAdminister(group, MEMBER, HOST, normalizeShip);
    expect(result.ok).toBe(false);
  });

  it('refuses when a seated member holds no role marked admin', () => {
    // member holds the "admin" role string, but the group does not mark it admin
    const group: RawGroupForAdminVerification = {
      admins: [],
      seats: { [MEMBER]: { roles: ['admin'] } },
    };
    expect(actingShipCanAdminister(group, MEMBER, HOST, normalizeShip).ok).toBe(
      false
    );
  });
});

describe('batch verification predicate', () => {
  // Mirrors how the groups.ts batch loop filters targets against one scry snapshot:
  // of two targets, only the unverified one should remain.
  it('identifies only the ship that did not gain the role', () => {
    const promoted = '~zod';
    const notPromoted = '~nec';
    const group: RawGroupForAdminVerification = {
      seats: {
        [promoted]: { roles: ['admin'] },
        [notPromoted]: { roles: ['member'] },
      },
    };

    const unverified = [promoted, notPromoted].filter(
      (ship) => !seatHasRole(group, ship, 'admin', normalizeShip)
    );

    expect(unverified).toEqual([notPromoted]);
  });
});
