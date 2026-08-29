import { describe, expect, it } from 'bun:test';

import {
  type FakeShipOptions,
  createTestSurfaceDeps,
} from '../surface-test-doubles';
import {
  isBurnedName,
  isBuntGroupFlag,
  readChannelPresence,
} from './surface-create';
import { run } from './surface';

const GROUP = '~zod/dashboards';

function setup(options: FakeShipOptions & { admin?: boolean } = {}) {
  const harness = createTestSurfaceDeps(options);
  harness.ship.addGroup(GROUP, {
    admins: ['admin'],
    seats:
      options.admin === false
        ? { '~zod': { roles: ['member'] } }
        : { '~zod': { roles: ['admin'] } },
  });
  return harness;
}

/** `~ten` acting in `~zod`'s group: seated, but not an admin. */
function setupAsGuest() {
  const harness = createTestSurfaceDeps({ ship: '~ten' });
  harness.ship.addGroup(GROUP, {
    admins: ['admin'],
    seats: { '~ten': { roles: ['member'] } },
  });
  return harness;
}

describe('surface create — presence predicates', () => {
  const base = {
    channelId: 'chat/~zod/dash',
    groupId: GROUP,
    nests: {},
    groupChannels: {},
  };

  it('reads both agents independently', () => {
    expect(
      readChannelPresence({
        ...base,
        nests: { 'chat/~zod/dash': { perms: { group: GROUP } } },
      })
    ).toEqual({ inChannels: true, inGroups: false, channelsGroupFlag: GROUP });

    expect(
      readChannelPresence({
        ...base,
        groupChannels: { 'chat/~zod/dash': {} as never },
      })
    ).toEqual({ inChannels: false, inGroups: true, channelsGroupFlag: null });
  });

  it('treats an unreadable group listing as "not listed", never as "listed"', () => {
    const presence = readChannelPresence({
      ...base,
      nests: { 'chat/~zod/dash': { perms: { group: GROUP } } },
      groupChannels: null,
    });
    expect(presence.inGroups).toBe(false);
    expect(isBurnedName(presence)).toBe(true);
  });

  it('recognises the burned-name signature and the bunt flag', () => {
    expect(
      isBurnedName({
        inChannels: true,
        inGroups: false,
        channelsGroupFlag: '~zod/',
      })
    ).toBe(true);
    expect(
      isBurnedName({
        inChannels: true,
        inGroups: true,
        channelsGroupFlag: GROUP,
      })
    ).toBe(false);
    expect(isBuntGroupFlag('~zod/')).toBe(true);
    expect(isBuntGroupFlag('~zod/dashboards')).toBe(false);
    expect(isBuntGroupFlag(null)).toBe(false);
  });
});

describe('surface create — observing both agents', () => {
  it('succeeds only once %channels holds it AND %groups lists it', async () => {
    const harness = setup();
    const code = await run(
      ['create', GROUP, '--title', 'Potluck', '--json'],
      harness.deps
    );

    expect(code).toBe(0);
    const result = harness.json();
    expect(result.ok).toBe(true);
    expect(result.observedIn).toEqual(['channels', 'groups']);
    const channelId = result.channel as string;
    expect(harness.ship.nests.has(channelId)).toBe(true);
    expect(harness.ship.groups.get(GROUP)?.channels[channelId]).toBeDefined();
  });

  it('fails when only %channels took the create — the D50 half-create', async () => {
    const harness = setup({ createEffect: 'channels-only' });
    const code = await run(
      ['create', GROUP, '--title', 'Potluck', '--json'],
      harness.deps
    );

    expect(code).toBe(1);
    const result = harness.json();
    expect(result.ok).toBe(false);
    expect(result.code).toBe('create-unconfirmed');
    expect(
      String((result.details as Record<string, unknown>).observed)
    ).toContain('has not listed it');
  });

  it('fails when only %groups took the create', async () => {
    const harness = setup({ createEffect: 'groups-only' });
    const code = await run(
      ['create', GROUP, '--title', 'Potluck', '--json'],
      harness.deps
    );

    expect(code).toBe(1);
    expect(harness.json().code).toBe('create-unconfirmed');
    expect(
      String((harness.json().details as Record<string, unknown>).observed)
    ).toContain('%channels does not hold it');
  });

  it('fails when the poke reached neither agent, despite resolving', async () => {
    const harness = setup({ createEffect: 'none' });
    const code = await run(
      ['create', GROUP, '--title', 'Potluck', '--json'],
      harness.deps
    );

    expect(code).toBe(1);
    expect(harness.json().code).toBe('create-unconfirmed');
    // The poke itself was accepted — that is precisely the point.
    expect(harness.ship.createPokes).toHaveLength(1);
  });

  it('waits for the listing to catch up rather than failing on the first poll', async () => {
    const harness = setup({
      createDelayPolls: 2,
      budget: { attempts: 8, intervalMs: 0 },
    });
    const code = await run(
      ['create', GROUP, '--title', 'Potluck', '--json'],
      harness.deps
    );

    expect(code).toBe(0);
    expect(Number(harness.json().attempts)).toBeGreaterThan(1);
    expect(harness.ship.sleeps.length).toBeGreaterThan(0);
  });
});

describe('surface create — names', () => {
  it('uses a random slug by default', async () => {
    const harness = setup();
    await run(['create', GROUP, '--title', 'Potluck', '--json'], harness.deps);
    expect(harness.json().channel).toBe('chat/~zod/dash-0001');
    expect(harness.json().reused).toBe(false);
  });

  it('refuses a burned name without poking', async () => {
    const harness = setup();
    harness.ship.burnName('chat/~zod/standup');
    const code = await run(
      ['create', GROUP, '--title', 'Standup', '--name', 'standup', '--json'],
      harness.deps
    );

    expect(code).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('name-burned');
    expect((result.details as Record<string, unknown>).buntGroupFlag).toBe(
      true
    );
    expect(harness.ship.createPokes).toHaveLength(0);
  });

  it('refuses a name already live in the group, and reuses it on request', async () => {
    const harness = setup();
    harness.ship.addChannel(GROUP, 'chat/~zod/standup');

    const failed = await run(
      ['create', GROUP, '--title', 'Standup', '--name', 'standup', '--json'],
      harness.deps
    );
    expect(failed).toBe(1);
    expect(harness.json().code).toBe('name-taken');
    expect(harness.ship.createPokes).toHaveLength(0);

    const reused = createTestSurfaceDeps({});
    reused.ship.addGroup(GROUP);
    reused.ship.addChannel(GROUP, 'chat/~zod/standup');
    const code = await run(
      [
        'create',
        GROUP,
        '--title',
        'Standup',
        '--name',
        'standup',
        '--on-collision',
        'reuse',
        '--json',
      ],
      reused.deps
    );
    expect(code).toBe(0);
    expect(reused.json().reused).toBe(true);
    expect(reused.ship.createPokes).toHaveLength(0);
  });

  it('requires a collision decision to be about an explicit name', async () => {
    const harness = setup();
    const code = await run(
      ['create', GROUP, '--title', 'X', '--on-collision', 'reuse', '--json'],
      harness.deps
    );
    expect(code).toBe(1);
    expect(harness.json().code).toBe('usage');
  });

  it('rejects a name the backend could not carry', async () => {
    const harness = setup();
    const code = await run(
      ['create', GROUP, '--title', 'X', '--name', 'Not A Slug', '--json'],
      harness.deps
    );
    expect(code).toBe(1);
    expect(harness.json().code).toBe('usage');
    expect(harness.ship.createPokes).toHaveLength(0);
  });
});

describe('surface create — pre-flight failures are distinguishable', () => {
  it('names a missing admin role', async () => {
    const harness = setupAsGuest();
    const code = await run(
      ['create', GROUP, '--title', 'X', '--json'],
      harness.deps
    );
    expect(code).toBe(1);
    expect(harness.json().code).toBe('admin-required');
    expect(harness.ship.createPokes).toHaveLength(0);
  });

  it('names a missing group', async () => {
    const harness = createTestSurfaceDeps({});
    const code = await run(
      ['create', '~zod/nope', '--title', 'X', '--json'],
      harness.deps
    );
    expect(code).toBe(1);
    expect(harness.json().code).toBe('group-not-found');
  });

  it('separates unreachable storage from a missing bucket', async () => {
    const noStorage = setup({
      storage: { canStore: false, reason: 'no-storage' },
    });
    expect(
      await run(['create', GROUP, '--title', 'X', '--json'], noStorage.deps)
    ).toBe(1);
    expect(noStorage.json().code).toBe('storage-unavailable');

    const noBucket = setup({
      storage: { canStore: false, reason: 'no-bucket' },
    });
    expect(
      await run(['create', GROUP, '--title', 'X', '--json'], noBucket.deps)
    ).toBe(1);
    expect(noBucket.json().code).toBe('storage-no-bucket');
  });

  it('treats an unreadable storage scry as unknown, not as incapable', async () => {
    const harness = setup({ storage: null });
    expect(
      await run(['create', GROUP, '--title', 'X', '--json'], harness.deps)
    ).toBe(0);
  });

  it('can skip the storage pre-flight', async () => {
    const harness = setup({
      storage: { canStore: false, reason: 'no-storage' },
    });
    expect(
      await run(
        ['create', GROUP, '--title', 'X', '--skip-storage-check', '--json'],
        harness.deps
      )
    ).toBe(0);
  });
});

describe('surface create — what it writes', () => {
  it('creates the channel with the surface renderer and no composer', async () => {
    const harness = setup();
    await run(
      [
        'create',
        GROUP,
        '--title',
        'Potluck',
        '--description',
        'Who brings what',
      ],
      harness.deps
    );

    const poke = harness.ship.createPokes[0];
    expect(poke.kind).toBe('chat');
    expect(poke.group).toBe(GROUP);
    expect(poke.writers).toEqual([]);
    const payload = JSON.parse(poke.description);
    expect(payload.description).toBe('Who brings what');
    expect(payload.channelContentConfiguration).toEqual({
      draftInput: 'tlon.r0.input.none',
      defaultPostContentRenderer: 'tlon.r0.content.chat',
      defaultPostCollectionRenderer: 'tlon.r0.collection.surface',
    });
  });

  it('says what it observed in the human report', async () => {
    const harness = setup();
    await run(['create', GROUP, '--title', 'Potluck'], harness.deps);
    expect(harness.out()).toContain('present in %channels and listed in');
  });
});
