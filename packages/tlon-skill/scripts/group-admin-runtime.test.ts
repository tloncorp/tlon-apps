import { describe, expect, it } from 'bun:test';

import type { RawGroupForAdminVerification } from './commands/groups-verification';
import {
  type GroupAdminRuntimeDeps,
  assertGroupAdminAccess,
} from './group-admin-runtime';

function makeDeps(
  options: {
    actingShip?: string;
    groups?: RawGroupForAdminVerification[];
    errors?: Error[];
  } = {}
) {
  let read = 0;
  const sleeps: number[] = [];
  const deps: GroupAdminRuntimeDeps = {
    getActingShip: () => options.actingShip ?? '~zod',
    getRawGroup: async () => {
      const error = options.errors?.[read];
      const group = options.groups?.[read] ?? options.groups?.at(-1) ?? {};
      read += 1;
      if (error) throw error;
      return group;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return { deps, reads: () => read, sleeps };
}

describe('group admin runtime guard', () => {
  it('allows the group host without reading subscriber state', async () => {
    const context = makeDeps({ actingShip: '~zod' });

    await expect(
      assertGroupAdminAccess(
        '~zod/hosted',
        'create a Notebook channel',
        context.deps
      )
    ).resolves.toBeUndefined();
    expect(context.reads()).toBe(0);
  });

  it('accepts a custom admin role on the first fresh read', async () => {
    const context = makeDeps({
      actingShip: '~nec',
      groups: [
        {
          admins: ['moderator'],
          seats: { '~nec': { roles: ['moderator'] } },
        },
      ],
    });

    await expect(
      assertGroupAdminAccess(
        '~zod/shared',
        'create a Notebook channel',
        context.deps
      )
    ).resolves.toBeUndefined();
    expect(context.reads()).toBe(1);
    expect(context.sleeps).toEqual([]);
  });

  it('retries a lagging foreign-group snapshot before accepting admin', async () => {
    const context = makeDeps({
      actingShip: '~nec',
      groups: [
        {
          admins: ['moderator'],
          seats: { '~nec': { roles: ['member'] } },
        },
        {
          admins: ['moderator'],
          seats: { '~nec': { roles: ['moderator'] } },
        },
      ],
    });

    await expect(
      assertGroupAdminAccess(
        '~zod/shared',
        'create a Notebook channel',
        context.deps
      )
    ).resolves.toBeUndefined();
    expect(context.reads()).toBe(2);
    expect(context.sleeps).toEqual([500]);
  });

  it('fails closed after five non-admin reads', async () => {
    const context = makeDeps({
      actingShip: '~nec',
      groups: [
        { admins: ['moderator'], seats: { '~nec': { roles: ['member'] } } },
      ],
    });

    await expect(
      assertGroupAdminAccess(
        '~zod/shared',
        'create a Notebook channel',
        context.deps
      )
    ).rejects.toThrow("Can't create a Notebook channel in ~zod/shared");
    expect(context.reads()).toBe(5);
    expect(context.sleeps).toEqual([500, 500, 500, 500]);
  });
});
