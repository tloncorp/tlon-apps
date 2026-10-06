import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppInfo } from './settingsApi';

const scries = vi.hoisted(() => ({
  pikes: {} as Record<string, unknown>,
  charges: {} as Record<string, unknown>,
}));

vi.mock('./requests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./requests')>();
  return {
    ...actual,
    scryRequest: (entry: { path: string }) => async () =>
      entry.path === '/kiln/pikes' ? scries.pikes : { initial: scries.charges },
  };
});

describe('getAppInfo', () => {
  beforeEach(() => {
    scries.pikes = {};
    scries.charges = {};
  });

  it('reads the %tlon desk over a suspended %groups desk', async () => {
    scries.pikes = {
      tlon: { hash: '0v1.tlon', sync: { ship: '~zod' } },
      groups: { hash: '0v1.groups', sync: null },
    };
    scries.charges = {
      tlon: { version: '12.3.1' },
      groups: { version: '12.1.0' },
    };
    await expect(getAppInfo()).resolves.toEqual({
      groupsVersion: '12.3.1',
      groupsHash: '0v1.tlon',
      groupsSyncNode: '~zod',
    });
  });

  it('reads %tlon when the ship has no %groups charge at all', async () => {
    scries.charges = { tlon: { version: '12.3.1' } };
    await expect(getAppInfo()).resolves.toMatchObject({
      groupsVersion: '12.3.1',
    });
  });

  it('still reads %groups on a ship that has not migrated', async () => {
    scries.charges = { groups: { version: '12.2.0' } };
    await expect(getAppInfo()).resolves.toMatchObject({
      groupsVersion: '12.2.0',
    });
  });
});
