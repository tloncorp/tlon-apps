import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  type GroupChannelJournalDeps,
  type GroupsUiChannelHandlerDeps,
  createGroupChannelJournal,
  handleGroupsUiChannelFact,
  parseGroupsUiChannelFact,
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
      groupTitle: 'Test',
      channels: [
        { nest: 'chat/~zod/general', title: 'General' },
        { nest: 'heap/~zod/pics', title: 'Pics' },
        { nest: 'diary/~zod/notes', title: 'Notes' },
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
      channels: [{ nest: 'chat/~zod/general' }],
    });
  });

  it('reads a channel add', () => {
    expect(parseGroupsUiChannelFact(CHANNEL_ADD_FACT)).toEqual({
      flag: '~zod/test',
      kind: 'channel-add',
      channels: [{ nest: 'chat/~zod/new', title: 'New' }],
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
      channels: [{ nest: 'heap/~zod/pics' }],
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
        update: { time: '1', diff: { channel: { nest: 'chat/~zod/new' } } },
      })
    ).toBeNull();
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

  it('changes nothing on a deep-equal observation and keeps unconfirmed nests', async () => {
    const { journal, values } = makeJournal({ initial: ['chat/~zod/a'] });
    await journal.persist(['chat/~zod/b']);
    expect(values()).toEqual([['chat/~zod/a', 'chat/~zod/b']]);

    // An unrelated settings fact carries the same array; `b` has not echoed
    // yet and must survive the no-op.
    expect(journal.observe(['chat/~zod/a'])).toEqual({
      added: [],
      removed: [],
    });
    expect(journal.observationSeq).toBe(0);

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

  it('counts observations only when the value changed', () => {
    const { journal } = makeJournal({ initial: ['chat/~zod/a'] });

    expect(journal.observationSeq).toBe(0);
    journal.observe(['chat/~zod/a']);
    expect(journal.observationSeq).toBe(0);
    journal.observe(['chat/~zod/a', 'chat/~zod/b']);
    expect(journal.observationSeq).toBe(1);
    journal.observe(['chat/~zod/a', 'chat/~zod/b']);
    expect(journal.observationSeq).toBe(1);
    journal.observe(undefined);
    expect(journal.observationSeq).toBe(2);
  });

  it('trusts the snapshot after a changed observation', async () => {
    const { journal, values } = makeJournal({ trusted: false });
    await journal.persist(['chat/~zod/a']);
    expect(values()).toEqual([]);

    journal.observe([]);
    await journal.flush();

    expect(values()).toEqual([['chat/~zod/a']]);
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
    const fn = sliceFrom('const refreshSettingsNow = async');

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
});
