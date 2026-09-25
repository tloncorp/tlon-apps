import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  type GroupChannelJournalDeps,
  type GroupsUiChannelHandlerDeps,
  createGroupChannelJournal,
  filterJoinedShips,
  handleGroupsUiChannelFact,
  parseGroupsUiChannelFact,
  parseGroupsUiMemberJoinFact,
  canReadChannel,
  applyGroupsUiRoleFact,
  parseGroupsUiRoleFact,
} from './group-channels.js';

// Literal `/groups/ui` facts, in the shape the ship's encoder emits:
// desk/lib/groups-json.hoon:1215-1245 — every v2 diff becomes
// `{flag, update: {time, diff: {<tag>: …}}}`. A join arrives as `diff.create`
// (the host's initial group), a later channel as `diff.channel.{nest, diff.add}`.
const CREATE_FACT = {
  flag: '~zod/test',
  update: {
    time: '170141184506740591263857466587466039296',
    diff: {
      create: {
        meta: { title: 'Test' },
        channels: {
          'chat/~zod/general': { meta: { title: 'General' } },
          'heap/~zod/pics': { meta: { title: 'Pics' } },
          'diary/~zod/notes': { meta: { title: 'Notes' } },
          'calendar/~zod/cal': { meta: { title: 'Cal' } },
        },
        fleet: {},
        cabals: {},
        zones: {},
        'zone-ord': [],
        bloc: [],
        cordon: { open: { ships: [], ranks: [] } },
        secret: false,
        'flagged-content': {},
      },
    },
  },
};

const CHANNEL_ADD_FACT = {
  flag: '~zod/test',
  update: {
    time: '170141184506740591263857466587466039297',
    diff: {
      channel: {
        nest: 'chat/~zod/new',
        diff: { add: { meta: { title: 'New' } } },
      },
    },
  },
};

const FLEET_FACT = {
  flag: '~zod/test',
  update: {
    time: '170141184506740591263857466587466039298',
    diff: { fleet: { ships: ['~nec'], diff: { add: null } } },
  },
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A held put, so a test can interleave observations and further persists. */
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Every put value the journal produced, in order. The harness records around
 * whatever `putEntry` the test injects, so a held or rejecting put is still
 * visible here.
 */
function makeJournal(overrides: Partial<GroupChannelJournalDeps> = {}) {
  const values: string[][] = [];
  const inner = overrides.putEntry ?? (async () => 0);
  const log = vi.fn();
  const error = vi.fn();
  const journal = createGroupChannelJournal({
    initial: undefined,
    trusted: true,
    protectedNests: () => new Set<string>(),
    ...overrides,
    putEntry: (value) => {
      values.push(value);
      return inner(value);
    },
    log,
    error,
  });
  return { journal, log, error, values: () => values };
}

function makeHandlerDeps(
  overrides: Partial<GroupsUiChannelHandlerDeps> = {}
): GroupsUiChannelHandlerDeps {
  return {
    watched: new Set<string>(),
    channelToGroup: new Map<string, string>(),
    channelNameCache: new Map<string, string>(),
    groupNameCache: new Map<string, string>(),
    botShip: '~bus',
    groupRoles: new Map(),
    persist: vi.fn(async (_nests: readonly string[]) => undefined),
    scan: vi.fn(async (_nest: string) => undefined),
    log: vi.fn(),
    ...overrides,
  };
}

describe('parseGroupsUiChannelFact', () => {
  it('reads a create fact, keeping only chat/heap/diary channels', () => {
    expect(parseGroupsUiChannelFact(CREATE_FACT)).toEqual({
      flag: '~zod/test',
      kind: 'create',
      roles: { botSects: [], bloc: [] },
      groupTitle: 'Test',
      channels: [
        { nest: 'chat/~zod/general', title: 'General', readers: [] },
        { nest: 'heap/~zod/pics', title: 'Pics', readers: [] },
        { nest: 'diary/~zod/notes', title: 'Notes', readers: [] },
      ],
    });
  });

  it('returns a create fact with no channels when none qualify', () => {
    // The caller still caches the group title from it.
    const fact = {
      flag: '~zod/empty',
      update: {
        time: '170141184506740591263857466587466039296',
        diff: {
          create: {
            meta: { title: 'Empty' },
            channels: { 'calendar/~zod/cal': { meta: { title: 'Cal' } } },
            fleet: {},
            cabals: {},
            zones: {},
            'zone-ord': [],
            bloc: [],
            cordon: { open: { ships: [], ranks: [] } },
            secret: false,
            'flagged-content': {},
          },
        },
      },
    };

    expect(parseGroupsUiChannelFact(fact)).toEqual({
      flag: '~zod/empty',
      kind: 'create',
      roles: { botSects: [], bloc: [] },
      groupTitle: 'Empty',
      channels: [],
    });
  });

  it('omits a group title the create meta does not carry', () => {
    const fact = {
      flag: '~zod/test',
      update: {
        time: '170141184506740591263857466587466039296',
        diff: { create: { channels: { 'chat/~zod/general': {} } } },
      },
    };

    expect(parseGroupsUiChannelFact(fact)).toEqual({
      flag: '~zod/test',
      kind: 'create',
      roles: { botSects: [], bloc: [] },
      channels: [{ nest: 'chat/~zod/general', readers: [] }],
    });
  });

  it('reads a channel add', () => {
    expect(parseGroupsUiChannelFact(CHANNEL_ADD_FACT)).toEqual({
      flag: '~zod/test',
      kind: 'channel-add',
      channels: [{ nest: 'chat/~zod/new', title: 'New', readers: [] }],
    });
  });

  it('reads a channel add whose meta carries no title', () => {
    const fact = {
      flag: '~zod/test',
      update: {
        time: '170141184506740591263857466587466039297',
        diff: { channel: { nest: 'heap/~zod/pics', diff: { add: {} } } },
      },
    };

    expect(parseGroupsUiChannelFact(fact)).toEqual({
      flag: '~zod/test',
      kind: 'channel-add',
      channels: [{ nest: 'heap/~zod/pics', readers: [] }],
    });
  });

  it('ignores a channel add of a kind the plugin does not monitor', () => {
    const fact = {
      flag: '~zod/test',
      update: {
        time: '170141184506740591263857466587466039297',
        diff: {
          channel: {
            nest: 'calendar/~zod/cal',
            diff: { add: { meta: { title: 'Cal' } } },
          },
        },
      },
    };

    expect(parseGroupsUiChannelFact(fact)).toBeNull();
  });

  it('ignores every non-additive channel diff', () => {
    for (const diff of [
      { edit: { meta: { title: 'Renamed' } } },
      { del: null },
      { join: null },
      { 'add-sects': ['admin'] },
      { 'del-sects': ['admin'] },
      { zone: 'misc' },
    ]) {
      expect(
        parseGroupsUiChannelFact({
          flag: '~zod/test',
          update: {
            time: '170141184506740591263857466587466039297',
            diff: { channel: { nest: 'chat/~zod/new', diff } },
          },
        })
      ).toBeNull();
    }
  });

  it('ignores every other outer diff tag', () => {
    expect(parseGroupsUiChannelFact(FLEET_FACT)).toBeNull();
    for (const diff of [
      { cabal: { sect: 'admin', diff: { add: { meta: {} } } } },
      { bloc: ['admin'] },
      { cordon: { open: { ships: ['~nec'], ranks: [] } } },
      { zone: { id: 'misc', meta: {} } },
      { meta: { title: 'Renamed' } },
      { secret: false },
      { del: null },
      { 'flag-content': { content: true, flag: '~nec' } },
    ]) {
      expect(
        parseGroupsUiChannelFact({
          flag: '~zod/test',
          update: { time: '170141184506740591263857466587466039298', diff },
        })
      ).toBeNull();
    }
  });

  it('ignores malformed facts', () => {
    expect(parseGroupsUiChannelFact('nope')).toBeNull();
    expect(parseGroupsUiChannelFact(null)).toBeNull();
    expect(parseGroupsUiChannelFact(undefined)).toBeNull();
    expect(parseGroupsUiChannelFact([])).toBeNull();
    expect(
      parseGroupsUiChannelFact({
        update: { time: '1', diff: { create: { channels: {} } } },
      })
    ).toBeNull();
    expect(
      parseGroupsUiChannelFact({ flag: '~zod/test', diff: { create: {} } })
    ).toBeNull();
    expect(
      parseGroupsUiChannelFact({ flag: '~zod/test', update: { time: '1' } })
    ).toBeNull();
    expect(
      parseGroupsUiChannelFact({
        flag: '~zod/test',
        update: { time: '1', diff: 'create' },
      })
    ).toBeNull();
    expect(
      parseGroupsUiChannelFact({
        flag: '~zod/test',
        update: {
          time: '1',
          diff: { channel: { nest: 'chat/~zod/new', readers: [] } },
        },
      })
    ).toBeNull();
  });
});

describe('parseGroupsUiChannelFact readability data', () => {
  const RESTRICTED_CREATE = {
    flag: '~zod/test',
    update: {
      time: '1',
      diff: {
        create: {
          meta: { title: 'Test' },
          channels: {
            'chat/~zod/general': { meta: { title: 'General' }, readers: [] },
            'chat/~zod/staff': {
              meta: { title: 'Staff' },
              readers: ['staff', 'admin'],
            },
          },
          fleet: {
            '~bus': { sects: ['member'], joined: '1' },
            '~zod': { sects: ['admin'], joined: '1' },
          },
          cabals: {},
          zones: {},
          'zone-ord': [],
          bloc: ['admin'],
          cordon: { open: { ships: [], ranks: [] } },
          secret: false,
          'flagged-content': {},
        },
      },
    },
  };

  it("extracts each channel's readers and the bot's roles from a create fact", () => {
    const fact = parseGroupsUiChannelFact(RESTRICTED_CREATE, {
      botShip: '~bus',
    })!;
    expect(fact.roles).toEqual({ botSects: ['member'], bloc: ['admin'] });
    expect(fact.channels).toEqual([
      { nest: 'chat/~zod/general', title: 'General', readers: [] },
      { nest: 'chat/~zod/staff', title: 'Staff', readers: ['staff', 'admin'] },
    ]);
    // Unknown bot ship (or absent vessel): no roles, but still a fact.
    expect(parseGroupsUiChannelFact(RESTRICTED_CREATE)!.roles).toEqual({
      botSects: [],
      bloc: ['admin'],
    });
  });

  it('extracts the readers of an added channel', () => {
    const fact = parseGroupsUiChannelFact({
      flag: '~zod/test',
      update: {
        time: '1',
        diff: {
          channel: {
            nest: 'chat/~zod/staff',
            diff: { add: { meta: { title: 'Staff' }, readers: ['staff'] } },
          },
        },
      },
    })!;
    expect(fact.channels).toEqual([
      { nest: 'chat/~zod/staff', title: 'Staff', readers: ['staff'] },
    ]);
  });
});

describe('parseGroupsUiMemberJoinFact', () => {
  const fleetFact = (ships: string[], diff: unknown) => ({
    flag: '~zod/test',
    update: { time: FLEET_FACT.update.time, diff: { fleet: { ships, diff } } },
  });

  it('reads a fleet add as one join naming every ship but the bot', () => {
    expect(
      parseGroupsUiMemberJoinFact(
        fleetFact(['~nec', '~bus', '~wes'], { add: null }),
        {
          botShip: '~bus',
        }
      )
    ).toEqual({ groupId: '~zod/test', ships: ['~nec', '~wes'] });
    expect(
      parseGroupsUiMemberJoinFact(fleetFact(['~bus'], { add: null }), {
        botShip: '~bus',
      })
    ).toBeNull();
  });

  it('ignores fleet dels, channel facts, and the old update.fleet shape', () => {
    expect(
      parseGroupsUiMemberJoinFact(fleetFact(['~nec'], { del: null }))
    ).toBeNull();
    expect(parseGroupsUiMemberJoinFact(CHANNEL_ADD_FACT)).toBeNull();
    expect(
      parseGroupsUiMemberJoinFact({
        flag: '~zod/test',
        update: { fleet: { '~nec': { add: null } } },
      })
    ).toBeNull();
  });
});

describe('filterJoinedShips', () => {
  it('drops ships whose seat joined time is the @da bunt', async () => {
    const scry = vi.fn(async (_path: string) => ({
      seats: {
        '~nec': { roles: [], joined: 1710342753588 },
        '~wes': { roles: [], joined: 946684800000 },
      },
    }));
    const join = { groupId: '~zod/test', ships: ['~nec', '~wes', '~ten'] };
    expect(await filterJoinedShips(join, scry)).toEqual(['~nec']);
    expect(scry).toHaveBeenCalledWith('/groups/v2/groups/~zod/test.json');
  });
});

describe('canReadChannel', () => {
  it('mirrors go-can-read for a member', () => {
    const member = { botSects: ['member'], bloc: ['admin'] };
    const admin = { botSects: ['admin'], bloc: ['admin'] };
    const staff = { botSects: ['staff'], bloc: ['admin'] };
    // Open channel: readable by every member, even with no known roles.
    expect(canReadChannel([], member)).toBe(true);
    expect(canReadChannel([], undefined)).toBe(true);
    // Restricted channel: admins, or a reader role.
    expect(canReadChannel(['staff'], member)).toBe(false);
    expect(canReadChannel(['staff'], staff)).toBe(true);
    expect(canReadChannel(['staff'], admin)).toBe(true);
    // Restricted with unknown roles (a channel add for a group whose create
    // fact this process never saw): treated as unreadable.
    expect(canReadChannel(['staff'], undefined)).toBe(false);
    // The host reads everything, whatever its roles (go-is-admin).
    expect(canReadChannel(['staff'], undefined, true)).toBe(true);
    expect(canReadChannel(['staff'], member, true)).toBe(true);
  });
});

describe('parseGroupsUiRoleFact / applyGroupsUiRoleFact', () => {
  const fleet = (ships: string[], diff: Record<string, unknown>) => ({
    flag: '~zod/test',
    update: { time: '1', diff: { fleet: { ships, diff } } },
  });
  const bloc = (diff: Record<string, unknown>) => ({
    flag: '~zod/test',
    update: { time: '1', diff: { bloc: diff } },
  });

  it('reads role changes for the bot and for the admin roles', () => {
    const bot = { botShip: '~bus' };
    expect(
      parseGroupsUiRoleFact(
        fleet(['~bus', '~nec'], { 'add-sects': ['staff'] }),
        bot
      )
    ).toEqual({ flag: '~zod/test', kind: 'bot-sects-add', sects: ['staff'] });
    expect(
      parseGroupsUiRoleFact(fleet(['~bus'], { 'del-sects': ['staff'] }), bot)
    ).toEqual({ flag: '~zod/test', kind: 'bot-sects-del', sects: ['staff'] });
    expect(parseGroupsUiRoleFact(fleet(['~bus'], { del: null }), bot)).toEqual({
      flag: '~zod/test',
      kind: 'bot-left',
      sects: [],
    });
    expect(parseGroupsUiRoleFact(bloc({ add: ['mod'] }), bot)).toEqual({
      flag: '~zod/test',
      kind: 'bloc-add',
      sects: ['mod'],
    });
    expect(parseGroupsUiRoleFact(bloc({ del: ['mod'] }), bot)).toEqual({
      flag: '~zod/test',
      kind: 'bloc-del',
      sects: ['mod'],
    });
  });

  it('ignores fleet facts about other ships, joins, and unrelated tags', () => {
    const bot = { botShip: '~bus' };
    expect(
      parseGroupsUiRoleFact(fleet(['~nec'], { 'add-sects': ['staff'] }), bot)
    ).toBeNull();
    expect(
      parseGroupsUiRoleFact(fleet(['~bus'], { add: null }), bot)
    ).toBeNull();
    expect(
      parseGroupsUiRoleFact(fleet(['~bus'], { 'add-sects': ['x'] }))
    ).toBeNull();
    expect(parseGroupsUiRoleFact(CREATE_FACT, bot)).toBeNull();
    expect(parseGroupsUiRoleFact(CHANNEL_ADD_FACT, bot)).toBeNull();
  });

  it('applies deltas to remembered roles and drops a group the bot left', () => {
    const groupRoles = new Map([
      ['~zod/test', { botSects: ['member'], bloc: ['admin'] }],
    ]);
    applyGroupsUiRoleFact(
      { flag: '~zod/test', kind: 'bot-sects-add', sects: ['staff'] },
      groupRoles
    );
    applyGroupsUiRoleFact(
      { flag: '~zod/test', kind: 'bloc-add', sects: ['mod'] },
      groupRoles
    );
    expect(groupRoles.get('~zod/test')).toEqual({
      botSects: ['member', 'staff'],
      bloc: ['admin', 'mod'],
    });
    applyGroupsUiRoleFact(
      { flag: '~zod/test', kind: 'bot-sects-del', sects: ['staff'] },
      groupRoles
    );
    applyGroupsUiRoleFact(
      { flag: '~zod/test', kind: 'bloc-del', sects: ['mod'] },
      groupRoles
    );
    expect(groupRoles.get('~zod/test')).toEqual({
      botSects: ['member'],
      bloc: ['admin'],
    });
    // Unknown group: stays unknown (conservative), nothing is created.
    applyGroupsUiRoleFact(
      { flag: '~zod/other', kind: 'bloc-add', sects: ['mod'] },
      groupRoles
    );
    expect(groupRoles.has('~zod/other')).toBe(false);
    applyGroupsUiRoleFact(
      { flag: '~zod/test', kind: 'bot-left', sects: [] },
      groupRoles
    );
    expect(groupRoles.has('~zod/test')).toBe(false);
  });

  it('makes a later restricted channel add follow a lost role', async () => {
    const deps = makeHandlerDeps({
      groupRoles: new Map([
        ['~zod/test', { botSects: ['staff'], bloc: ['admin'] }],
      ]),
    });
    applyGroupsUiRoleFact(
      { flag: '~zod/test', kind: 'bot-sects-del', sects: ['staff'] },
      deps.groupRoles
    );
    await handleGroupsUiChannelFact(
      {
        flag: '~zod/test',
        kind: 'channel-add',
        channels: [{ nest: 'chat/~zod/later', readers: ['staff'] }],
      },
      deps
    );
    expect(deps.watched.has('chat/~zod/later')).toBe(false);
  });
});

describe('createGroupChannelJournal.observe', () => {
  it('seeds the observed base from the startup value', () => {
    const { journal } = makeJournal({ initial: ['chat/~zod/a'] });

    expect(journal.observe(['chat/~zod/a'])).toEqual({
      added: [],
      removed: [],
    });
    expect(journal.observe([])).toEqual({
      added: [],
      removed: ['chat/~zod/a'],
    });
  });

  it('returns added and removed nests, protecting config-sourced ones', () => {
    const { journal } = makeJournal({
      initial: ['chat/~zod/old', 'chat/~zod/file', 'chat/~zod/discovered'],
      protectedNests: () => new Set(['chat/~zod/file', 'chat/~zod/discovered']),
    });

    expect(journal.observe(['chat/~zod/new', 'chat/~zod/file'])).toEqual({
      added: ['chat/~zod/new'],
      removed: ['chat/~zod/old'],
    });
  });

  it('treats a deleted or malformed entry as empty', () => {
    const { journal } = makeJournal({
      initial: ['chat/~zod/settings', 'chat/~zod/file'],
      protectedNests: () => new Set(['chat/~zod/file']),
    });

    expect(journal.observe(undefined)).toEqual({
      added: [],
      removed: ['chat/~zod/settings'],
    });
  });

  it('changes nothing on a re-presented or same-valued observation and keeps unconfirmed nests', async () => {
    const initial = ['chat/~zod/a'];
    const { journal, values } = makeJournal({ initial });
    await journal.persist(['chat/~zod/b']);
    expect(values()).toEqual([['chat/~zod/a', 'chat/~zod/b']]);

    // An unrelated settings fact re-presents the value: not an observation
    // at all. `b` has not echoed yet and must survive it.
    expect(journal.observe(initial, { keyFact: false })).toEqual({
      added: [],
      removed: [],
    });
    expect(journal.observationSeq).toBe(0);
    // A same-valued key fact is an observation (it supersedes an in-flight
    // scry) but reconciles nothing, and `b` still survives it.
    expect(journal.observe(['chat/~zod/a'])).toEqual({
      added: [],
      removed: [],
    });
    expect(journal.observationSeq).toBe(1);

    await journal.persist(['chat/~zod/c']);
    expect(values().at(-1)).toEqual([
      'chat/~zod/a',
      'chat/~zod/b',
      'chat/~zod/c',
    ]);
  });

  it('neither confirms nor unwatches an unconfirmed nest the echo lacks', async () => {
    const { journal, values } = makeJournal();
    await journal.persist(['chat/~zod/a']);

    // Echo lag: the ship has applied the put but this fact predates it.
    expect(journal.observe([])).toEqual({ added: [], removed: [] });

    await journal.persist(['chat/~zod/b']);
    expect(values().at(-1)).toEqual(['chat/~zod/a', 'chat/~zod/b']);
  });

  it('confirms an unconfirmed nest the echo contains', async () => {
    const { journal, values } = makeJournal();
    await journal.persist(['chat/~zod/a']);

    expect(journal.observe(['chat/~zod/a'])).toEqual({
      added: ['chat/~zod/a'],
      removed: [],
    });
    // Confirmed means it joined the observed base, so dropping it from the key
    // is now a real removal rather than echo lag.
    expect(journal.observe([])).toEqual({
      added: [],
      removed: ['chat/~zod/a'],
    });
    // And a later write must not resurrect it: confirmed then removed is gone
    // from the write base, not parked in `unconfirmed`.
    await journal.persist(['chat/~zod/b']);
    expect(values().at(-1)).toEqual(['chat/~zod/b']);
  });

  it('counts every key fact as an observation, but not a fact about another key', () => {
    const initial = ['chat/~zod/a'];
    const { journal } = makeJournal({ initial });

    expect(journal.observationSeq).toBe(0);
    // A fact about another key re-presents the value: not a key fact.
    journal.observe(initial, { keyFact: false });
    expect(journal.observationSeq).toBe(0);
    // A key fact with an unchanged value is still an observation: it must
    // supersede a scry in flight, e.g. an operator restoring the last-seen
    // value while a stale scry is out.
    expect(journal.observe(['chat/~zod/a'])).toEqual({
      added: [],
      removed: [],
    });
    expect(journal.observationSeq).toBe(1);
    journal.observe(['chat/~zod/a', 'chat/~zod/b']);
    expect(journal.observationSeq).toBe(2);
    journal.observe(undefined);
    expect(journal.observationSeq).toBe(3);
  });

  it('counts a deletion of an already-absent key as an observation', () => {
    const { journal } = makeJournal({ initial: undefined, trusted: false });
    expect(journal.observationSeq).toBe(0);
    // A del-entry maps to undefined, the value already seen; it still has to
    // supersede a scry in flight that captured a pre-deletion list.
    journal.observe(undefined);
    expect(journal.observationSeq).toBe(1);
    expect(journal.trusted).toBe(true);
    // A fact about another key that re-presents undefined does not.
    journal.observe(undefined, { keyFact: false });
    expect(journal.observationSeq).toBe(1);
  });

  it('trusts the snapshot after a same-valued key fact', async () => {
    const { journal, values } = makeJournal({
      initial: ['chat/~zod/a'],
      trusted: false,
    });
    journal.observe(['chat/~zod/a']);
    expect(journal.trusted).toBe(true);
    await journal.persist(['chat/~zod/b']);
    expect(values()).toEqual([['chat/~zod/a', 'chat/~zod/b']]);
  });

  it('trusts the snapshot after a changed observation', async () => {
    const { journal, values } = makeJournal({ trusted: false });
    await journal.persist(['chat/~zod/a']);
    expect(values()).toEqual([]);

    journal.observe([]);
    await journal.flush();

    expect(values()).toEqual([['chat/~zod/a']]);
  });

  it('defers again after markUntrusted() until the next fresh load', async () => {
    const { journal, values, log } = makeJournal();
    await journal.persist(['chat/~zod/a']);
    expect(values()).toHaveLength(1);

    // The settings subscription dropped: echoes may have been missed, so the
    // write base is stale until a fresh load re-trusts it.
    journal.markUntrusted();
    await journal.persist(['chat/~zod/b']);
    expect(values()).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(
      '[tlon] groupChannels: deferring 1 nest(s): settings snapshot untrusted'
    );

    journal.markTrusted();
    await journal.flush();
    expect(values().at(-1)).toEqual(['chat/~zod/a', 'chat/~zod/b']);
  });

  it('drops an unconfirmed nest a fresh load omits, but only among the named candidates', async () => {
    const { journal, values } = makeJournal();
    await journal.persist(['chat/~zod/a']);
    const candidates = journal.unconfirmedSnapshot();
    expect([...candidates]).toEqual(['chat/~zod/a']);

    // Put `b` after the scry began: it is not judged by this scry.
    await journal.persist(['chat/~zod/b']);

    // The scry, begun before `a`'s put echoed, shows neither nest: `a` was
    // lost or removed by another writer; `b` is simply newer than the scry.
    expect(journal.pruneUnconfirmed([], candidates)).toEqual(['chat/~zod/a']);
    expect([...journal.unconfirmedSnapshot()]).toEqual(['chat/~zod/b']);

    // The next put carries `b` but no longer resurrects `a`.
    await journal.persist(['chat/~zod/c']);
    expect(values().at(-1)).toEqual(['chat/~zod/b', 'chat/~zod/c']);
  });

  it('never prunes a nest whose put is still in flight', async () => {
    const first = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    const inFlight = journal.persist(['chat/~zod/a']);
    await flush();
    // A refresh scry begun now can overtake the put and omit `a`; the
    // snapshot it judges must not include an in-flight addition.
    const candidates = journal.unconfirmedSnapshot();
    expect([...candidates]).toEqual([]);
    expect(journal.pruneUnconfirmed([], candidates)).toEqual([]);

    // The put then fails for real: the rejection handler still has `a` to
    // requeue, and the next pass writes it.
    first.reject(new Error('transport closed'));
    await inFlight;
    await journal.flush();
    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a']]);
  });

  it('moves a settled put to unconfirmed unless an echo already confirmed it', async () => {
    const first = deferred();
    const second = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue(0);
    const { journal } = makeJournal({ putEntry });

    const a = journal.persist(['chat/~zod/a']);
    await flush();
    first.resolve(0);
    await a;
    // Settled, no echo yet: judged by the next fresh scry.
    expect([...journal.unconfirmedSnapshot()]).toEqual(['chat/~zod/a']);

    const b = journal.persist(['chat/~zod/b']);
    await flush();
    // The echo lands before the HTTP response: `b` is confirmed in flight.
    journal.observe(['chat/~zod/a', 'chat/~zod/b']);
    second.resolve(0);
    await b;
    expect([...journal.unconfirmedSnapshot()]).toEqual([]);
  });

  it('counts gaps so a scry a gap overtook cannot re-trust the journal', () => {
    const { journal } = makeJournal({ trusted: true });
    expect(journal.gapSeq).toBe(0);
    journal.markUntrusted();
    journal.markUntrusted();
    expect(journal.gapSeq).toBe(2);
    expect(journal.trusted).toBe(false);
  });

  it('exposes trust so teardown can reconcile before closing', () => {
    const { journal } = makeJournal({ trusted: true });
    expect(journal.trusted).toBe(true);
    journal.markUntrusted();
    expect(journal.trusted).toBe(false);
    journal.markTrusted();
    expect(journal.trusted).toBe(true);
  });

  it('trusts the snapshot after markTrusted()', async () => {
    const { journal, values, log } = makeJournal({ trusted: false });

    await journal.persist(['chat/~zod/a']);

    expect(values()).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      '[tlon] groupChannels: deferring 1 nest(s): settings snapshot untrusted'
    );

    journal.markTrusted();
    await journal.flush();

    expect(values()).toEqual([['chat/~zod/a']]);
  });
});

describe('createGroupChannelJournal.persist', () => {
  it('does not put when nothing is missing', async () => {
    const { journal, values } = makeJournal({ initial: ['chat/~zod/a'] });

    await journal.persist(['chat/~zod/a']);
    await journal.persist([]);

    expect(values()).toEqual([]);
  });

  it('batches concurrently accepted nests into one sorted put', async () => {
    const { journal, values, log } = makeJournal();

    await Promise.all([
      journal.persist(['chat/~zod/b']),
      journal.persist(['chat/~zod/a']),
    ]);

    expect(values()).toEqual([['chat/~zod/a', 'chat/~zod/b']]);
    expect(log).toHaveBeenCalledWith(
      '[tlon] Persisted 2 channel(s) to groupChannels: chat/~zod/a, chat/~zod/b'
    );
  });

  it('keeps an in-flight addition in the write base of the next put', async () => {
    const first = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    const inFlight = journal.persist(['chat/~zod/a']);
    await flush();
    expect(values()).toEqual([['chat/~zod/a']]);

    // No echo yet: `a` is known only to this process, and the next put must
    // still carry it or the nest is lost.
    const queued = journal.persist(['chat/~zod/b']);
    first.resolve(0);
    await Promise.all([inFlight, queued]);

    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a', 'chat/~zod/b']]);
  });

  it('gives a persist accepted mid-drain its own pass', async () => {
    const first = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    const inFlight = journal.persist(['chat/~zod/a']);
    await flush();
    const queued = journal.persist(['chat/~zod/b']);
    await flush();
    // Serialized: the second put must not start while the first is held.
    expect(putEntry).toHaveBeenCalledTimes(1);
    first.resolve(0);
    await Promise.all([inFlight, queued]);

    // A coalescing enqueue would fold the second persist into the running pass
    // and never write `b`.
    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a', 'chat/~zod/b']]);
  });

  it('keeps rejected nests pending for the next pass', async () => {
    const first = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(0);
    const { journal, values, error } = makeJournal({ putEntry });

    const inFlight = journal.persist(['chat/~zod/a']);
    await flush();
    const queued = journal.persist(['chat/~zod/b']);
    first.reject(new Error('transport closed'));
    await Promise.all([inFlight, queued]);

    expect(error).toHaveBeenCalledWith(
      '[tlon] Failed to persist groupChannels: Error: transport closed'
    );
    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a', 'chat/~zod/b']]);
  });

  it('carries an unechoed nest past a delayed echo', async () => {
    const second = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockResolvedValueOnce(0)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    await journal.persist(['chat/~zod/a']);
    const inFlight = journal.persist(['chat/~zod/b']);
    await flush();
    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a', 'chat/~zod/b']]);

    // The echo of the first put arrives while the second is in flight, so it
    // confirms `a` and says nothing about `b`.
    journal.observe(['chat/~zod/a']);
    const queued = journal.persist(['chat/~zod/c']);
    second.resolve(0);
    await Promise.all([inFlight, queued]);

    expect(values().at(-1)).toEqual([
      'chat/~zod/a',
      'chat/~zod/b',
      'chat/~zod/c',
    ]);
  });

  it('keeps an echo-confirmed nest in the write base when its put rejects', async () => {
    const first = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    const inFlight = journal.persist(['chat/~zod/a']);
    await flush();
    // The ship applied the put and echoed it; only the ack was lost.
    journal.observe(['chat/~zod/a']);
    const queued = journal.persist(['chat/~zod/b']);
    first.reject(new Error('client closed'));
    await Promise.all([inFlight, queued]);

    expect(values().at(-1)).toEqual(['chat/~zod/a', 'chat/~zod/b']);
  });

  it('does not write back a confirmed nest an operator removed before the rejection', async () => {
    const first = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    const inFlight = journal.persist(['chat/~zod/a']);
    await flush();
    // The ship applied the put and echoed it, an operator then removed the
    // nest, and only afterwards the PUT's promise rejected (response cleanup).
    journal.observe(['chat/~zod/a']);
    journal.observe([]);
    first.reject(new Error('release failed'));
    await inFlight;

    // A requeue here would resurrect the operator's removal on the next pass.
    await journal.flush();
    await journal.close();
    expect(values()).toEqual([['chat/~zod/a']]);
  });

  it('drains a held put and a queued addition before close() resolves', async () => {
    const first = deferred();
    const second = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    const inFlight = journal.persist(['chat/~zod/a']);
    await flush();
    const queued = journal.persist(['chat/~zod/b']);
    let settled = false;
    const closing = journal.close().then(() => {
      settled = true;
    });
    await flush();
    expect(values()).toEqual([['chat/~zod/a']]);
    // Teardown awaits this; it must not settle before the queued write lands.
    expect(settled).toBe(false);

    first.resolve(0);
    await inFlight;
    await flush();
    // The queued write is now in flight; close() must still be waiting on it,
    // not just on the put that was running when it was called.
    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a', 'chat/~zod/b']]);
    expect(settled).toBe(false);

    second.resolve(0);
    await queued;
    await closing;
    expect(settled).toBe(true);
  });

  it('does not let an already-observed request linger and resurrect the nest', async () => {
    const { journal, values } = makeJournal({ initial: ['chat/~zod/a'] });

    // A mixed batch: `a` is already observed, only `b` needs writing.
    await journal.persist(['chat/~zod/a', 'chat/~zod/b']);
    expect(values()).toEqual([['chat/~zod/a', 'chat/~zod/b']]);
    journal.observe(['chat/~zod/a', 'chat/~zod/b']);

    // An operator removes `a`; an opportunistic flush must not write it back
    // from a leftover pending entry.
    journal.observe(['chat/~zod/b']);
    await journal.flush();

    expect(values()).toHaveLength(1);
  });

  it('re-writes a re-requested nest whose echo never arrived', async () => {
    const { journal, values } = makeJournal();

    // The put acked but its echo was lost (dead subscription), and a fresh
    // load later shows another writer dropped the nest.
    await journal.persist(['chat/~zod/a']);
    journal.observe([]);

    // An explicit re-request (the host re-sent the group) must write again;
    // an unconfirmed nest is not "already written".
    await journal.persist(['chat/~zod/a']);

    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a']]);
  });

  it('keeps a same-nest request accepted during a put when that put completes', async () => {
    const first = deferred();
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    const inFlight = journal.persist(['chat/~zod/a']);
    await flush();
    // While the put is held: its echo confirms `a`, another writer removes
    // it, and the host re-sends the group.
    journal.observe(['chat/~zod/a']);
    journal.observe([]);
    const queued = journal.persist(['chat/~zod/a']);
    first.resolve(0);
    await Promise.all([inFlight, queued]);

    // The first put's completion must not consume the newer request.
    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a']]);
  });

  it('retries a rejected batch on close()', async () => {
    const putEntry = vi
      .fn<(value: string[]) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('transport closed'))
      .mockResolvedValue(0);
    const { journal, values } = makeJournal({ putEntry });

    await journal.persist(['chat/~zod/a']);
    await journal.close();

    expect(values()).toEqual([['chat/~zod/a'], ['chat/~zod/a']]);
  });

  it('accepts nothing after close()', async () => {
    const { journal, values } = makeJournal();

    await journal.close();
    await journal.persist(['chat/~zod/a']);

    expect(values()).toEqual([]);
  });
});

describe('handleGroupsUiChannelFact readability', () => {
  const fact = (
    readers: string[],
    roles?: { botSects: string[]; bloc: string[] }
  ): GroupsUiChannelFact => ({
    flag: '~zod/test',
    kind: 'create',
    channels: [
      { nest: 'chat/~zod/general', readers: [] },
      { nest: 'chat/~zod/staff', readers },
    ],
    ...(roles ? { roles } : {}),
  });

  it('neither watches, journals, nor scans a channel the bot cannot read', async () => {
    const deps = makeHandlerDeps();
    await handleGroupsUiChannelFact(
      fact(['staff'], { botSects: ['member'], bloc: ['admin'] }),
      deps
    );
    expect([...deps.watched]).toEqual(['chat/~zod/general']);
    expect(deps.persist).toHaveBeenCalledWith(['chat/~zod/general']);
    expect(deps.scan).toHaveBeenCalledTimes(1);
    expect(deps.channelToGroup.has('chat/~zod/staff')).toBe(false);
  });

  it('includes a restricted channel the bot has a reader role or admin role for', async () => {
    for (const roles of [
      { botSects: ['staff'], bloc: ['admin'] },
      { botSects: ['admin'], bloc: ['admin'] },
    ]) {
      const deps = makeHandlerDeps();
      await handleGroupsUiChannelFact(fact(['staff'], roles), deps);
      expect([...deps.watched]).toEqual([
        'chat/~zod/general',
        'chat/~zod/staff',
      ]);
    }
  });

  it('reads every channel of a group the bot hosts, whatever its roles', async () => {
    const deps = makeHandlerDeps({ botShip: '~zod' });
    await handleGroupsUiChannelFact(
      fact(['staff'], { botSects: ['member'], bloc: ['admin'] }),
      deps
    );
    expect([...deps.watched]).toEqual(['chat/~zod/general', 'chat/~zod/staff']);
  });

  it("remembers a group's roles for a later channel add", async () => {
    const deps = makeHandlerDeps();
    await handleGroupsUiChannelFact(
      fact([], { botSects: ['staff'], bloc: ['admin'] }),
      deps
    );
    const add: GroupsUiChannelFact = {
      flag: '~zod/test',
      kind: 'channel-add',
      channels: [{ nest: 'chat/~zod/later', readers: ['staff'] }],
    };
    await handleGroupsUiChannelFact(add, deps);
    expect(deps.watched.has('chat/~zod/later')).toBe(true);

    // The same add for a group whose create this process never saw.
    const cold = makeHandlerDeps();
    await handleGroupsUiChannelFact(add, cold);
    expect(cold.watched.has('chat/~zod/later')).toBe(false);
    expect(cold.persist).toHaveBeenCalledWith([]);
  });
});

describe('handleGroupsUiChannelFact', () => {
  it('journals a nest the firehose already auto-watched', async () => {
    const deps = makeHandlerDeps({ watched: new Set(['chat/~zod/general']) });

    await handleGroupsUiChannelFact(
      parseGroupsUiChannelFact(CREATE_FACT)!,
      deps
    );

    // The firehose watches on first traffic but never journals, so every
    // channel of the fact is persisted; only the new ones are scanned.
    expect(deps.persist).toHaveBeenCalledWith([
      'chat/~zod/general',
      'heap/~zod/pics',
      'diary/~zod/notes',
    ]);
    expect(deps.scan).toHaveBeenCalledTimes(2);
    expect(deps.scan).toHaveBeenCalledWith('heap/~zod/pics');
    expect(deps.scan).toHaveBeenCalledWith('diary/~zod/notes');
    expect(deps.scan).not.toHaveBeenCalledWith('chat/~zod/general');
    expect(deps.log).toHaveBeenCalledWith(
      '[tlon] Auto-detected channel (create): heap/~zod/pics'
    );
  });

  it('populates the group and channel caches', async () => {
    const deps = makeHandlerDeps();

    await handleGroupsUiChannelFact(
      parseGroupsUiChannelFact(CREATE_FACT)!,
      deps
    );

    expect(deps.groupNameCache.get('~zod/test')).toBe('Test');
    expect(deps.channelToGroup.get('chat/~zod/general')).toBe('~zod/test');
    expect(deps.channelNameCache.get('chat/~zod/general')).toBe('General');
    expect(deps.watched.has('diary/~zod/notes')).toBe(true);
  });

  it('persists before the network-bound scans', async () => {
    const order: string[] = [];
    const deps = makeHandlerDeps({
      persist: vi.fn(async () => {
        order.push('persist');
      }),
      scan: vi.fn(async () => {
        order.push('scan');
      }),
    });

    await handleGroupsUiChannelFact(
      parseGroupsUiChannelFact(CHANNEL_ADD_FACT)!,
      deps
    );

    expect(order).toEqual(['persist', 'scan']);
  });

  it('journals a re-fired create fact once after its echo', async () => {
    const { journal, values } = makeJournal();
    const deps = makeHandlerDeps({
      persist: (nests) => journal.persist(nests),
    });
    const fact = parseGroupsUiChannelFact(CREATE_FACT)!;

    // %groups re-sends `create` on admin promotion and host resync, long
    // after the join's echo confirmed the channels.
    await handleGroupsUiChannelFact(fact, deps);
    journal.observe(values()[0]);
    await handleGroupsUiChannelFact(fact, deps);
    await journal.close();

    expect(values()).toEqual([
      ['chat/~zod/general', 'diary/~zod/notes', 'heap/~zod/pics'],
    ]);
  });
});

// The monitor closure is not importable in tests (huge module, heavy setup),
// so the journal's binding to it is asserted at the source level — the
// technique bot-info.test.ts uses for the monitor lifecycle call sites.
describe('wiring', () => {
  const monitorSource = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), './index.ts'),
    'utf8'
  );

  /** The body of a closure-scope arrow function, by its declaration marker. */
  const sliceFrom = (marker: string) => {
    const start = monitorSource.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const end = monitorSource.indexOf('\n      };', start);
    expect(end).toBeGreaterThan(start);
    return monitorSource.slice(start, end);
  };

  it('marks the journal trusted before applying a refreshed snapshot', () => {
    const fn = sliceFrom('refreshSettingsNow = async');

    // A byte-identical refresh short-circuits inside applySettingsSnapshot, so
    // trust recovery after a failed boot load has to happen first.
    expect(fn.indexOf('markTrusted()')).toBeGreaterThan(-1);
    expect(fn.indexOf('markTrusted()')).toBeLessThan(
      fn.indexOf('applySettingsSnapshot(')
    );
    expect(fn.indexOf('groupChannelJournal?.flush()')).toBeGreaterThan(
      fn.indexOf('applySettingsSnapshot(')
    );
    // A superseded scry is reconciled inside load(), before the manager
    // installs it, so the restore is part of the load call itself.
    const loadCall = fn.indexOf('settingsManager.load(');
    const reconcile = fn.indexOf('reconcile:');
    expect(loadCall).toBeGreaterThan(-1);
    expect(reconcile).toBeGreaterThan(loadCall);
    expect(reconcile).toBeLessThan(fn.indexOf('applySettingsSnapshot('));
  });

  it('trusts the journal only from a fresh load taken after the stream is connected', () => {
    const creation = monitorSource.indexOf('createGroupChannelJournal({');
    expect(creation).toBeGreaterThan(-1);
    expect(monitorSource.indexOf('trusted: false,', creation)).toBeLessThan(
      monitorSource.indexOf('log: runtime.log,', creation)
    );

    const subscribe = monitorSource.indexOf(
      'settingsManager.startSubscription({'
    );
    const gap = monitorSource.indexOf('onGap: (kind) => {');
    expect(subscribe).toBeGreaterThan(-1);
    expect(gap).toBeGreaterThan(subscribe);

    // subscribe() only queues until connect(): the first refresh after the
    // subscription must follow the connect, and precede the invite catch-up
    // whose joins are the first facts the journal persists.
    const connect = monitorSource.indexOf('await api.connect();');
    const firstRefresh = monitorSource.indexOf(
      'await refreshSettingsNow();',
      subscribe
    );
    expect(connect).toBeGreaterThan(subscribe);
    expect(firstRefresh).toBeGreaterThan(connect);
    expect(firstRefresh).toBeLessThan(
      monitorSource.indexOf('await groupInviteRunner.catchUp();')
    );
  });

  it('tells the journal which settings key a subscription event changed', () => {
    expect(monitorSource).toContain(
      'settingsManager.onChange((newSettings, changedKey) => {'
    );
    const fn = sliceFrom('const applySettingsSnapshot = (');
    const observe = fn.indexOf('groupChannelJournal.observe(');
    const keyFact = fn.indexOf("snapshotOpts.changedKey === 'groupChannels'");
    expect(observe).toBeGreaterThan(-1);
    expect(keyFact).toBeGreaterThan(observe);
  });

  it('applies role facts to the remembered group roles in the /groups/ui handler', () => {
    const handler = monitorSource.indexOf("path: '/groups/ui'");
    const channelFact = monitorSource.indexOf(
      'parseGroupsUiChannelFact(event',
      handler
    );
    const roleFact = monitorSource.indexOf(
      'parseGroupsUiRoleFact(event',
      handler
    );
    const apply = monitorSource.indexOf(
      'applyGroupsUiRoleFact(roleFact',
      handler
    );
    expect(channelFact).toBeGreaterThan(handler);
    expect(roleFact).toBeGreaterThan(channelFact);
    expect(apply).toBeGreaterThan(roleFact);
  });

  it('marks the journal untrusted on a stream reconnect', () => {
    const hook = monitorSource.indexOf('onReconnect: async (client) => {');
    const next = monitorSource.indexOf('onSubscriptionRecovery:', hook);
    const untrust = monitorSource.indexOf(
      'groupChannelJournal?.markUntrusted()',
      hook
    );
    expect(hook).toBeGreaterThan(-1);
    expect(untrust).toBeGreaterThan(hook);
    expect(untrust).toBeLessThan(next);
  });

  it('reconciles an untrusted journal before closing it in teardown, twice if the first refresh was joined', () => {
    const closeJournal = monitorSource.indexOf('groupChannelJournal?.close()');
    const guard = monitorSource.lastIndexOf(
      'if (groupChannelJournal && !groupChannelJournal.trusted) {',
      closeJournal
    );
    expect(guard).toBeGreaterThan(-1);
    const refresh = monitorSource.indexOf('await refreshSettingsNow();', guard);
    expect(refresh).toBeGreaterThan(guard);
    expect(refresh).toBeLessThan(closeJournal);
    // Single-flight can join a refresh that began before the gap and ends
    // untrusted; a second, freshly started one sees the post-gap ship.
    const recheck = monitorSource.indexOf(
      'if (!groupChannelJournal.trusted) {',
      refresh
    );
    const secondRefresh = monitorSource.indexOf(
      'await refreshSettingsNow();',
      recheck
    );
    expect(recheck).toBeGreaterThan(refresh);
    expect(secondRefresh).toBeGreaterThan(recheck);
    expect(secondRefresh).toBeLessThan(closeJournal);
  });

  it('runs refreshes single-flight', () => {
    const fn = sliceFrom('refreshSettingsNow = async');
    const guard = fn.indexOf('if (settingsRefreshInFlight) {');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(fn.indexOf('settingsManager.load('));
    expect(fn).toContain('settingsRefreshInFlight = null;');
  });

  it('does not trust, observe, or prune from a scry that a gap overtook', () => {
    const fn = sliceFrom('refreshSettingsNow = async');
    const gapBefore = fn.indexOf('groupChannelJournal?.gapSeq');
    const load = fn.indexOf('settingsManager.load(');
    const gapped = fn.indexOf('groupChannelJournal.gapSeq !== gapBefore');
    expect(gapBefore).toBeGreaterThan(-1);
    expect(gapBefore).toBeLessThan(load);
    expect(gapped).toBeGreaterThan(load);
    expect(fn).toContain('if (refreshResult.fresh && !gapped) {');
    expect(fn).toContain(
      'journalObserve: refreshResult.fresh && !superseded && !gapped,'
    );
  });

  it('prunes unconfirmed nests from a fresh, non-superseded load before the snapshot applies', () => {
    const fn = sliceFrom('refreshSettingsNow = async');
    const snapshot = fn.indexOf('unconfirmedSnapshot()');
    const load = fn.indexOf('settingsManager.load(');
    const prune = fn.indexOf('pruneUnconfirmed(');
    expect(snapshot).toBeGreaterThan(-1);
    expect(snapshot).toBeLessThan(load);
    expect(prune).toBeGreaterThan(load);
    expect(prune).toBeLessThan(fn.indexOf('applySettingsSnapshot('));
  });

  it('reconciles the journal after the autoDiscoverChannels update', () => {
    const fn = sliceFrom('const applySettingsSnapshot = (');
    const flagUpdate = fn.indexOf(
      'effectiveAutoDiscoverChannels = newSettings.autoDiscoverChannels'
    );
    const reconcile = fn.indexOf('groupChannelJournal.observe(');

    // protectedNests() must see the incoming discovery flag.
    expect(flagUpdate).toBeGreaterThan(-1);
    expect(reconcile).toBeGreaterThan(flagUpdate);
  });

  it('closes the journal with the other persistence flushes, before the api', () => {
    const closeJournal = monitorSource.indexOf('groupChannelJournal?.close()');
    const flushOwnerReplies = monitorSource.indexOf(
      'ownerReplyPersistence.flush()'
    );
    const closeApi = monitorSource.indexOf('api?.close()');

    // api.close() rejects later pokes, so an unwritten nest would be lost.
    expect(closeJournal).toBeGreaterThan(flushOwnerReplies);
    expect(closeApi).toBeGreaterThan(closeJournal);
  });

  it('keeps the journal untrusted while the settings subscription is down', () => {
    const fn = sliceFrom('refreshSettingsNow = async');
    // Read when the scry begins, not after: a feed that comes back during
    // the scry still missed the edits made before it did.
    const captured = fn.indexOf('const feedDownBefore = settingsFeedDown');
    expect(captured).toBeGreaterThan(-1);
    expect(captured).toBeLessThan(fn.indexOf('settingsManager.load('));
    expect(fn.indexOf('|| feedDownBefore')).toBeGreaterThan(
      fn.indexOf('settingsManager.load(')
    );
    expect(fn.indexOf('|| feedDownBefore')).toBeLessThan(
      fn.indexOf('markTrusted()')
    );

    // The gap hook marks the feed down alongside the journal.
    const gap = monitorSource.indexOf('onGap: (kind) => {');
    expect(gap).toBeGreaterThan(-1);
    const gapBody = monitorSource.slice(gap, monitorSource.indexOf('},', gap));
    // Only a quit marks the feed down: an error is stream-level and can be
    // fanned out after the reconnect, with no recovery event to clear it.
    const quitGuard = gapBody.indexOf("kind === 'quit'");
    expect(quitGuard).toBeGreaterThan(-1);
    expect(gapBody.indexOf('settingsFeedDown = true')).toBeGreaterThan(
      quitGuard
    );
    expect(gapBody).toContain('markUntrusted()');

    // Recovery of the settings subscription clears it, then takes a fresh
    // load so the journal is re-trusted from a post-recovery base.
    const recovery = monitorSource.indexOf(
      'onSubscriptionRecovery: (event) => {'
    );
    expect(recovery).toBeGreaterThan(-1);
    const recoveryBody = monitorSource.slice(
      recovery,
      monitorSource.indexOf('onStreamRecovery:', recovery)
    );
    const settingsBranch = recoveryBody.indexOf("event.app === 'settings'");
    expect(settingsBranch).toBeGreaterThan(-1);
    const cleared = recoveryBody.indexOf(
      'settingsFeedDown = false',
      settingsBranch
    );
    expect(cleared).toBeGreaterThan(-1);
    expect(
      recoveryBody.indexOf('refreshSettingsNow()', settingsBranch)
    ).toBeGreaterThan(cleared);
  });

  it('lets the teardown refreshes re-trust with the feed gone', () => {
    const teardown = monitorSource.indexOf(
      'await pendingNudgePersistence.flush()'
    );
    const closeJournal = monitorSource.indexOf('groupChannelJournal?.close()');
    expect(teardown).toBeGreaterThan(-1);
    expect(teardown).toBeLessThan(closeJournal);
    const cleared = monitorSource.indexOf('settingsFeedDown = false', teardown);
    const firstRefresh = monitorSource.indexOf(
      'await refreshSettingsNow()',
      teardown
    );
    // The final scry is the last word: the clear precedes the refreshes
    // that give close() its base.
    expect(cleared).toBeGreaterThan(-1);
    expect(cleared).toBeLessThan(firstRefresh);
    expect(firstRefresh).toBeLessThan(closeJournal);
  });

  it('seeds the role cache from the startup snapshot before the handler deps are built', () => {
    const fetchWithShip = monitorSource.indexOf('botShip: botShipName');
    const seed = monitorSource.indexOf('initData.groupRoles');
    const deps = monitorSource.indexOf('const groupsUiChannelDeps');
    expect(fetchWithShip).toBeGreaterThan(-1);
    expect(seed).toBeGreaterThan(fetchWithShip);
    expect(seed).toBeLessThan(deps);
    // The deps share the seeded map rather than starting an empty one.
    const depsBody = monitorSource.slice(
      deps,
      monitorSource.indexOf('};', deps)
    );
    expect(depsBody).toMatch(/\n\s+groupRoles,\n/);

    // The fetch is unconditional: a bot in any group needs its roles, and
    // the snapshot is the only way to know it is in one.
    const rationale = monitorSource.indexOf('no config gates the fetch');
    expect(rationale).toBeGreaterThan(-1);
    const fetchCall = monitorSource.indexOf(
      'const initData = await fetchInitData(',
      rationale
    );
    expect(fetchCall).toBeGreaterThan(rationale);
    expect(monitorSource.slice(rationale, fetchCall)).not.toMatch(/\bif\s*\(/);
  });

  it('skips onboarding scans for a group nest that is no longer watched', () => {
    const start = monitorSource.indexOf(
      'const scanAgentOnboardingNest = async'
    );
    expect(start).toBeGreaterThan(-1);
    const fn = monitorSource.slice(
      start,
      monitorSource.indexOf('\n    };', start)
    );
    const guard = fn.indexOf('!nestIsDm && !watchedChannels.has(nest)');
    expect(guard).toBeGreaterThan(-1);
    // Before any await: a pending catch-up or retry for a removed channel
    // must not reach its history read.
    expect(guard).toBeLessThan(fn.indexOf('await '));
  });
});
