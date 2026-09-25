import { MIN_GROUPS_VERSION } from '@tloncorp/shared/logic/deskCompatibility';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import shipManifest from '../e2e/shipManifest.json';
import { shouldIncludeShip } from './shipSelection';

const N1_KEY = '~bud';

type ManifestShip = (typeof shipManifest)[keyof typeof shipManifest] & {
  optional?: boolean;
  n1?: boolean;
  deskVersion?: string;
};

const ships = Object.entries(shipManifest) as [string, ManifestShip][];

/**
 * The pin is a *label*: it cannot prove the published archive carries that
 * desk — n1-desk.spec.ts asserts the running ship's reported version for that.
 * What it does catch, on every PR rather than only on a staging push, is
 * raising MIN_GROUPS_VERSION without rebuilding the pier.
 */
describe('the pinned N-1 ship', () => {
  const n1 = shipManifest[N1_KEY] as ManifestShip;

  it('is pinned to the policy floor', () => {
    expect(n1.deskVersion).toBe(MIN_GROUPS_VERSION);
  });

  it('names an archive that matches the convention', () => {
    expect(n1.downloadUrl).toMatch(new RegExp(`/rube-${n1.ship}\\d+\\.tgz$`));
  });

  it('is never built by rube', () => {
    // rube skips desk copy, mount and commit for a skipCommit ship. Flipping
    // this would overwrite the N-1 desk with the candidate one on every run,
    // and the spec would then compare a ship with itself.
    expect(n1.skipCommit).toBe(true);
  });

  describe('selection', () => {
    // Both switches come from the ambient environment, and a run with
    // INCLUDE_OPTIONAL_SHIPS already set would otherwise read as a pass.
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
      saved = {
        N1_SHIP: process.env.N1_SHIP,
        INCLUDE_OPTIONAL_SHIPS: process.env.INCLUDE_OPTIONAL_SHIPS,
      };
      delete process.env.N1_SHIP;
      delete process.env.INCLUDE_OPTIONAL_SHIPS;
    });

    afterEach(() => {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it('is off by default and on when N1_SHIP names it', () => {
      expect(n1.n1).toBe(true);
      expect(shouldIncludeShip(n1)).toBe(false);
      process.env.N1_SHIP = n1.ship;
      expect(shouldIncludeShip(n1)).toBe(true);
    });

    it('stays off under INCLUDE_OPTIONAL_SHIPS', () => {
      // The archive preparation run and the parallel Docker image both set
      // that flag, and neither has this pier.
      process.env.INCLUDE_OPTIONAL_SHIPS = 'true';
      expect(shouldIncludeShip(n1)).toBe(false);
    });

    it('leaves the other optional ships on INCLUDE_OPTIONAL_SHIPS', () => {
      for (const [key, ship] of ships) {
        if (key === N1_KEY || !ship.optional) continue;
        expect(shouldIncludeShip(ship), key).toBe(false);
        process.env.INCLUDE_OPTIONAL_SHIPS = 'true';
        expect(shouldIncludeShip(ship), key).toBe(true);
        delete process.env.INCLUDE_OPTIONAL_SHIPS;
      }
    });
  });
});

describe('the manifest as a whole', () => {
  it('gives every ship a distinct web port and http port', () => {
    const webPorts = ships.map(([, ship]) => ship.webUrl);
    const httpPorts = ships.map(([, ship]) => ship.httpPort);
    expect(new Set(webPorts).size).toBe(webPorts.length);
    expect(new Set(httpPorts).size).toBe(httpPorts.length);
  });

  it('keeps web ports distinct modulo 20', () => {
    // helpers.ownShipForPage identifies a page's ship by web port modulo 20,
    // because parallel shards offset every port by a multiple of 20.
    const mods = ships.map(
      ([, ship]) => parseInt(ship.webUrl.match(/:(\d+)/)![1], 10) % 20
    );
    expect(new Set(mods).size).toBe(mods.length);
  });

  it('only pins a desk version on a ship rube does not commit to', () => {
    for (const [key, ship] of ships) {
      if (ship.deskVersion === undefined) continue;
      expect(ship.deskVersion, key).toMatch(/^\d+\.\d+\.\d+$/);
      expect(ship.skipCommit, key).toBe(true);
    }
  });

  it('marks exactly one ship as the N-1 pier, and pins its desk', () => {
    const n1Ships = ships.filter(([, ship]) => ship.n1);
    expect(n1Ships.map(([key]) => key)).toEqual([N1_KEY]);
    for (const [key, ship] of n1Ships) {
      expect(ship.deskVersion, key).toBe(MIN_GROUPS_VERSION);
    }
  });
});
