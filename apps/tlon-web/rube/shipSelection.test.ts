import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SelectableShip, shouldIncludeShip } from './shipSelection';

const plain: SelectableShip = { ship: 'zod' };
const optional: SelectableShip = { ship: 'bus', optional: true };
const n1: SelectableShip = { ship: 'bud', optional: true, n1: true };
const disabled: SelectableShip = { ship: 'nec', skipSetup: true };

describe('shouldIncludeShip', () => {
  // Both switches are read from the ambient environment, which a developer or
  // a .env.test may already have set.
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

  it('always includes a required ship', () => {
    expect(shouldIncludeShip(plain)).toBe(true);
    process.env.INCLUDE_OPTIONAL_SHIPS = 'true';
    expect(shouldIncludeShip(plain)).toBe(true);
  });

  it('never includes a skipSetup ship', () => {
    process.env.INCLUDE_OPTIONAL_SHIPS = 'true';
    process.env.N1_SHIP = 'nec';
    expect(shouldIncludeShip(disabled)).toBe(false);
  });

  it('includes an optional ship only under INCLUDE_OPTIONAL_SHIPS', () => {
    expect(shouldIncludeShip(optional)).toBe(false);
    process.env.INCLUDE_OPTIONAL_SHIPS = 'true';
    expect(shouldIncludeShip(optional)).toBe(true);
  });

  it('includes an n1 ship only when N1_SHIP names it', () => {
    expect(shouldIncludeShip(n1)).toBe(false);
    process.env.N1_SHIP = 'bud';
    expect(shouldIncludeShip(n1)).toBe(true);
    process.env.N1_SHIP = 'wes';
    expect(shouldIncludeShip(n1)).toBe(false);
  });

  it('keeps the n1 ship out of INCLUDE_OPTIONAL_SHIPS', () => {
    // This is the whole reason `n1` is a separate flag. The archive
    // preparation run and the parallel Docker image both turn optional ships
    // on, and neither has the N-1 pier — rube/Dockerfile bakes in
    // zod/bus/ten/mug only.
    process.env.INCLUDE_OPTIONAL_SHIPS = 'true';
    expect(shouldIncludeShip(n1)).toBe(false);
    expect(shouldIncludeShip(optional)).toBe(true);
  });

  it('ignores a blank N1_SHIP', () => {
    process.env.N1_SHIP = '   ';
    expect(shouldIncludeShip(n1)).toBe(false);
  });
});
