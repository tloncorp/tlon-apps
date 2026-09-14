import { MIN_GROUPS_VERSION } from '@tloncorp/shared/logic/deskPolicy';
import { describe, expect, it } from 'vitest';

import shipManifest from '../e2e/shipManifest.json';
import { shouldIncludeShip } from './shipSelection';

const N1_KEY = '~bud';

type ManifestShip = (typeof shipManifest)[keyof typeof shipManifest] & {
  optional?: boolean;
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

  it('is optional, and off unless N1_SHIP names it', () => {
    expect(n1.optional).toBe(true);

    const before = process.env.N1_SHIP;
    try {
      delete process.env.N1_SHIP;
      expect(shouldIncludeShip(n1)).toBe(false);
      process.env.N1_SHIP = n1.ship;
      expect(shouldIncludeShip(n1)).toBe(true);
    } finally {
      if (before === undefined) delete process.env.N1_SHIP;
      else process.env.N1_SHIP = before;
    }
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
});
