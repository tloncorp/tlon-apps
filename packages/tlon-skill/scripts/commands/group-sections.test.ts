import { formatUd } from '@tloncorp/api/client/apiUtils';
import { describe, expect, it } from 'bun:test';

import {
  type GroupSectionsDeps,
  addSection,
  deleteSection,
  moveChannel,
  orderSections,
  renameSection,
} from './group-sections';
import type { RawGroupForAdminVerification as RawGroup } from './groups-verification';

const G = '~zod/team';
const GENERAL = 'chat/~zod/general';
const RANDOM = 'chat/~zod/random';
const NEWS = 'chat/~zod/news';
const LOGS = 'chat/~zod/logs';
const MEMES = 'heap/~zod/memes';

// Only the shapes the fake dispatches on.
type SectionMeta = {
  title: string;
  description: string;
  image: string;
  cover: string;
};
type ASection =
  | { add: SectionMeta }
  | { edit: SectionMeta }
  | { del: null }
  | { 'move-nest': { nest: string; idx: string } };
type AGroup =
  | { section: { 'section-id': string; 'a-section': ASection } }
  | { channel: { nest: string; 'a-channel': { section: string } } }
  | { navigation: { sections: Record<string, unknown>; order: string[] } };
type WireAction = { group: { flag: string; 'a-group': AGroup } };

function isSectionPoke(poke: WireAction): boolean {
  return 'section' in poke.group['a-group'];
}
type PokeOutcome = 'apply' | 'drop' | 'apply-then-reject' | 'reject';

function meta(title: string, extra: Partial<Record<string, string>> = {}) {
  return { title, description: '', image: '', cover: '', ...extra };
}

const archiveExtra = {
  description: 'old things',
  image: '#ff0000',
  cover: 'https://example.com/c.png',
};

// default: [general, random]; zarc "Archive": [news, logs, memes]
function baseGroup(): RawGroup {
  return {
    admins: ['admin'],
    channels: {
      [GENERAL]: { section: 'default' },
      [RANDOM]: { section: 'default' },
      [NEWS]: { section: 'zarc' },
      [LOGS]: { section: 'zarc' },
      [MEMES]: { section: 'zarc' },
    },
    sections: {
      default: { meta: meta('Sectionless'), order: [GENERAL, RANDOM] },
      zarc: {
        meta: meta('Archive', archiveExtra),
        order: [NEWS, LOGS, MEMES],
      },
    },
    'section-order': ['default', 'zarc'],
  };
}

// A minimal model of the host's effects: push-front, `into`, the `%del`
// relabel, and the `%add` overwrite. Unknown shapes throw like a nack.
function applyPoke(state: RawGroup, json: WireAction): void {
  const aGroup = json.group['a-group'];
  const sections = state.sections!;
  const channels = state.channels!;
  if ('section' in aGroup) {
    const id = aGroup.section['section-id'];
    const a = aGroup.section['a-section'];
    if ('add' in a) {
      sections[id] = { meta: a.add, order: [] };
      state['section-order'] = [
        id,
        ...state['section-order']!.filter((s) => s !== id),
      ];
    } else if ('edit' in a) {
      if (sections[id]) sections[id].meta = a.edit;
    } else if ('del' in a) {
      if (a.del !== null) throw new Error('nack: del must be null');
      if (id === 'default') return;
      delete sections[id];
      state['section-order'] = state['section-order']!.filter((s) => s !== id);
      for (const ch of Object.values(channels)) {
        if (ch.section === id) ch.section = 'default';
      }
    } else if ('move-nest' in a) {
      const { nest, idx } = a['move-nest'];
      if (typeof idx !== 'string') throw new Error('nack: idx must be a @ud');
      const section = sections[id];
      if (!section?.order?.includes(nest)) return;
      const rest = section.order.filter((n) => n !== nest);
      rest.splice(Number(idx.replace(/\./g, '')), 0, nest);
      section.order = rest;
    } else {
      throw new Error(`nack: unsupported a-section ${JSON.stringify(a)}`);
    }
  } else if ('channel' in aGroup) {
    const { nest } = aGroup.channel;
    const target = aGroup.channel['a-channel'].section;
    if (!sections[target]) return;
    const ch = channels[nest];
    const old = sections[ch.section!];
    if (old) old.order = old.order!.filter((n) => n !== nest);
    ch.section = target;
    sections[target].order = [
      nest,
      ...sections[target].order!.filter((n) => n !== nest),
    ];
  } else if ('navigation' in aGroup) {
    if (Object.keys(aGroup.navigation.sections).length > 0) {
      throw new Error('fake: %set is not modeled');
    }
    state['section-order'] = aGroup.navigation.order.filter(
      (id) => !!sections[id]
    );
  } else {
    throw new Error('nack: unsupported a-group');
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

interface HarnessOptions {
  state?: RawGroup;
  adminError?: Error;
  outcomes?: PokeOutcome[];
  sectionId?: string;
  // Called with the 1-based getRawGroup call number before it reads.
  onRead?: (call: number, state: RawGroup) => void;
  // Called before the verify that follows poke number `pokeIndex` (0-based).
  beforeVerify?: (pokeIndex: number, state: RawGroup) => void;
  verifyGate?: Promise<void>;
}

function harness(options: HarnessOptions = {}) {
  const h = {
    state: options.state ?? baseGroup(),
    pokes: [] as WireAction[],
    events: [] as string[],
    logs: [] as string[],
    adminChecks: [] as string[],
    reads: 0,
  };
  const clone = () => structuredClone(h.state);
  const deps: GroupSectionsDeps = {
    assertCanAdminister: async (groupId, action) => {
      h.adminChecks.push(`${groupId}:${action}`);
      if (options.adminError) throw options.adminError;
    },
    getRawGroup: async () => {
      h.reads += 1;
      options.onRead?.(h.reads, h.state);
      return clone();
    },
    verify: async (_groupId, isSatisfied, describeFailure) => {
      const index = h.pokes.length - 1;
      h.events.push(`verify:${index}`);
      if (options.verifyGate) await options.verifyGate;
      options.beforeVerify?.(index, h.state);
      const snapshot = clone();
      if (isSatisfied(snapshot)) return snapshot;
      throw new Error(describeFailure(snapshot));
    },
    pokeGroupAction: async (json) => {
      const index = h.pokes.length;
      h.pokes.push(structuredClone(json) as WireAction);
      h.events.push(`poke:${index}`);
      const outcome = options.outcomes?.[index] ?? 'apply';
      if (outcome === 'apply' || outcome === 'apply-then-reject') {
        applyPoke(h.state, json as WireAction);
      }
      if (outcome === 'reject' || outcome === 'apply-then-reject') {
        throw new Error('PokeAckTimeoutError');
      }
    },
    createSectionId: () => options.sectionId ?? 'znew1',
    formatUd: (value) => formatUd(value),
    log: (line) => {
      h.logs.push(line);
    },
  };
  return { h, deps };
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected the command to fail');
}

// Every executable recovery command ends its line.
function printedCommands(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.match(/.*(tlon groups \S+(?: \S+)*)\s*$/)?.[1])
    .filter((cmd): cmd is string => !!cmd);
}

async function runPrinted(command: string, deps: GroupSectionsDeps) {
  const [tlon, family, cmd, ...rest] = command.split(' ');
  expect([tlon, family]).toEqual(['tlon', 'groups']);
  switch (cmd) {
    case 'order-sections':
      return orderSections(rest[0], rest.slice(1), deps);
    case 'delete-section':
      return deleteSection(rest[0], rest[1], deps);
    case 'rename-section': {
      // The title is the rest of the line, single-quoted for a shell.
      const quoted = rest.slice(2).join(' ');
      expect(quoted).toMatch(/^'.*'$/);
      const title = quoted.slice(1, -1).replaceAll("'\\''", "'");
      return renameSection(rest[0], rest[1], title, deps);
    }
    case 'move-channel': {
      const index = rest.indexOf('--index');
      return moveChannel(
        rest[0],
        rest[1],
        rest[rest.indexOf('--section') + 1],
        index === -1 ? undefined : Number(rest[index + 1]),
        deps
      );
    }
    default:
      throw new Error(`unexpected printed command: ${command}`);
  }
}

function sectionPoke(id: string, aSection: ASection): WireAction {
  return {
    group: {
      flag: G,
      'a-group': { section: { 'section-id': id, 'a-section': aSection } },
    },
  };
}

function channelPoke(nest: string, section: string): WireAction {
  return {
    group: {
      flag: G,
      'a-group': { channel: { nest, 'a-channel': { section } } },
    },
  };
}

function orderPoke(order: string[]): WireAction {
  return {
    group: { flag: G, 'a-group': { navigation: { sections: {}, order } } },
  };
}

describe('wire payloads', () => {
  it('add sends %add with blank meta, then an empty-map navigation order', async () => {
    const { h, deps } = harness();
    await addSection(G, '  Projects ', deps);
    expect(h.pokes).toEqual([
      sectionPoke('znew1', {
        add: { title: 'Projects', description: '', image: '', cover: '' },
      }),
      orderPoke(['default', 'zarc', 'znew1']),
    ]);
    expect(h.state['section-order']).toEqual(['default', 'zarc', 'znew1']);
    expect(h.logs).toEqual(['✓ Section added at the bottom: Projects (znew1)']);
  });

  it('rename sends %edit carrying description, image and cover verbatim', async () => {
    const { h, deps } = harness();
    await renameSection(G, 'archive', 'Old stuff', deps);
    expect(h.pokes).toEqual([
      sectionPoke('zarc', {
        edit: {
          title: 'Old stuff',
          description: 'old things',
          image: '#ff0000',
          cover: 'https://example.com/c.png',
        },
      }),
    ]);
    expect(h.logs).toEqual(['✓ Section renamed: Archive → Old stuff (zarc)']);
  });

  it('delete sends channel %section moves and `del: null`', async () => {
    const state = baseGroup();
    state.sections!.zarc.order = [NEWS];
    state.channels![LOGS].section = 'default';
    state.channels![MEMES].section = 'default';
    state.sections!.default.order!.push(LOGS, MEMES);
    const { h, deps } = harness({ state });
    await deleteSection(G, 'zarc', deps);
    expect(h.pokes).toEqual([
      channelPoke(NEWS, 'default'),
      sectionPoke('zarc', { del: null }),
    ]);
  });

  it('move-nest sends idx as a @ud string', async () => {
    const state = baseGroup();
    for (let i = 0; i < 1000; i += 1) {
      const nest = `chat/~zod/c${i}`;
      state.channels![nest] = { section: 'zarc' };
      state.sections!.zarc.order!.push(nest);
    }
    const { h, deps } = harness({ state });
    await moveChannel(G, NEWS, 'zarc', 1000, deps);
    expect(h.pokes).toEqual([
      sectionPoke('zarc', { 'move-nest': { nest: NEWS, idx: '1.000' } }),
    ]);
    expect(h.state.sections!.zarc.order![1000]).toBe(NEWS);
  });

  it('order sends one empty-map navigation poke', async () => {
    const { h, deps } = harness();
    await orderSections(G, ['Archive', 'default'], deps);
    expect(h.pokes).toEqual([orderPoke(['zarc', 'default'])]);
    expect(h.logs).toEqual([
      '✓ Sections ordered: Archive (zarc), Sectionless (default)',
    ]);
  });
});

describe('section resolution', () => {
  it('prefers an exact id over a title equal to another id', async () => {
    const state = baseGroup();
    state.sections!.zother = { meta: meta('zarc'), order: [] };
    state['section-order']!.push('zother');
    const { h, deps } = harness({ state });
    await renameSection(G, 'zarc', 'Renamed', deps);
    expect(h.pokes[0]).toEqual(
      sectionPoke('zarc', { edit: { ...meta('Renamed'), ...archiveExtra } })
    );
  });

  it('matches a trimmed title case-insensitively', async () => {
    const { h, deps } = harness();
    await renameSection(G, '  ARCHIVE ', 'Renamed', deps);
    expect(h.state.sections!.zarc.meta!.title).toBe('Renamed');
  });

  it('refuses a title matching two sections, listing both ids', async () => {
    const state = baseGroup();
    state.sections!.ztwo = { meta: meta('archive'), order: [] };
    state['section-order']!.push('ztwo');
    const { h, deps } = harness({ state });
    const message = await failure(moveChannel(G, GENERAL, 'Archive', 0, deps));
    expect(message).toBe(
      `Section "Archive" matches more than one section in ${G}: zarc, ztwo. Use the section id.`
    );
    expect(h.pokes).toEqual([]);
  });

  it('refuses an unknown section', async () => {
    const { h, deps } = harness();
    expect(await failure(deleteSection(G, 'Nope', deps))).toBe(
      `Section "Nope" not found in ${G}.`
    );
    expect(h.pokes).toEqual([]);
  });
});

describe('admin pre-check', () => {
  const refusal = new Error(
    `Can't do it in ${G}: you (~bot) are not an admin of this group.`
  );
  const commands: Array<[string, (deps: GroupSectionsDeps) => Promise<void>]> =
    [
      ['add sections', (deps) => addSection(G, 'New', deps)],
      ['rename sections', (deps) => renameSection(G, 'zarc', 'New', deps)],
      ['delete sections', (deps) => deleteSection(G, 'zarc', deps)],
      ['move channels', (deps) => moveChannel(G, GENERAL, 'zarc', 0, deps)],
      ['order sections', (deps) => orderSections(G, ['zarc', 'default'], deps)],
    ];
  for (const [action, run] of commands) {
    it(`${action}: a non-admin is refused before any read or poke`, async () => {
      const { h, deps } = harness({ adminError: refusal });
      expect(await failure(run(deps))).toBe(refusal.message);
      expect(h.adminChecks).toEqual([`${G}:${action}`]);
      expect(h.reads).toBe(0);
      expect(h.pokes).toEqual([]);
    });
  }
});

describe('add-section', () => {
  it('refuses a generated id that already exists, leaving it untouched', async () => {
    const { h, deps } = harness({ sectionId: 'zarc' });
    expect(await failure(addSection(G, 'Fresh', deps))).toBe(
      `Generated section id zarc already exists in ${G}; nothing was changed. Run the command again.`
    );
    expect(h.pokes).toEqual([]);
    expect(h.state).toEqual(baseGroup());
  });

  it('refuses a duplicate title (trimmed, case-insensitive) and a blank one', async () => {
    const { h, deps } = harness();
    expect(await failure(addSection(G, ' archive ', deps))).toBe(
      `A section titled "Archive" already exists in ${G} (zarc).`
    );
    expect(await failure(addSection(G, '   ', deps))).toBe(
      'Section title cannot be blank.'
    );
    expect(h.pokes).toEqual([]);
  });

  it('keeps every listed section in place and verifies the whole order', async () => {
    const state = baseGroup();
    state.sections!.zthree = { meta: meta('Three'), order: [] };
    state['section-order'] = ['zarc', 'default', 'zthree'];
    const { h, deps } = harness({ state });
    await addSection(G, 'Four', deps);
    expect(h.pokes[1]).toEqual(
      orderPoke(['zarc', 'default', 'zthree', 'znew1'])
    );
    expect(h.state['section-order']).toEqual([
      'zarc',
      'default',
      'zthree',
      'znew1',
    ]);
  });

  it('fails verification when only the new section lands at the end', async () => {
    const { h, deps } = harness({
      beforeVerify: (index, state) => {
        // The reorder lands with the other sections swapped.
        if (index === 1) state['section-order'] = ['zarc', 'default', 'znew1'];
      },
    });
    const message = await failure(addSection(G, 'Four', deps));
    expect(message).toContain(
      'Section Four (znew1) was added (confirmed), but moving it to the bottom was sent and not confirmed'
    );
    expect(h.logs).toEqual([]);
  });

  it('refuses when a section is hidden from the order, and its printed repair works', async () => {
    const state = baseGroup();
    state.sections!.zhid = { meta: meta('Hidden'), order: [] };
    const { h, deps } = harness({ state });
    const message = await failure(addSection(G, 'New', deps));
    expect(message).toContain('Hidden (zhid)');
    expect(h.pokes).toEqual([]);
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups order-sections ${G} default zarc zhid`,
    ]);
    await runPrinted(commands[0], deps);
    expect(h.state['section-order']).toEqual(['default', 'zarc', 'zhid']);
    await addSection(G, 'New', deps);
    expect(h.state['section-order']).toEqual([
      'default',
      'zarc',
      'zhid',
      'znew1',
    ]);
  });

  it('applied-then-rejected %add: never "run again"; the printed repair completes it', async () => {
    const { h, deps } = harness({ outcomes: ['apply-then-reject'] });
    const message = await failure(addSection(G, 'New', deps));
    expect(message).toContain('Do not re-run add-section');
    expect(message).not.toContain('Run the command again');
    expect(h.pokes).toHaveLength(1);
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups order-sections ${G} default zarc znew1`,
    ]);
    await runPrinted(commands[0], deps);
    expect(h.state['section-order']).toEqual(['default', 'zarc', 'znew1']);
  });

  it('dropped %add that lands later: the printed repair completes it', async () => {
    const { h, deps } = harness({ outcomes: ['drop'] });
    const message = await failure(addSection(G, 'New', deps));
    expect(message).toContain('Do not re-run add-section');
    applyPoke(h.state, h.pokes[0]);
    await runPrinted(printedCommands(message)[0], deps);
    expect(h.state['section-order']).toEqual(['default', 'zarc', 'znew1']);
  });

  it('rejected follow-up order: "added (confirmed)" with a full-id repair', async () => {
    const { h, deps } = harness({ outcomes: ['apply', 'reject'] });
    const message = await failure(addSection(G, 'New', deps));
    expect(message).toContain('Section New (znew1) was added (confirmed)');
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups order-sections ${G} default zarc znew1`,
    ]);
    await runPrinted(commands[0], deps);
    expect(h.state['section-order']).toEqual(['default', 'zarc', 'znew1']);
  });

  it('waits for the %add read-back before sending the reorder', async () => {
    const gate = deferred();
    const { h, deps } = harness({ verifyGate: gate.promise });
    const run = addSection(G, 'New', deps);
    await Bun.sleep(5);
    expect(h.events).toEqual(['poke:0', 'verify:0']);
    gate.resolve();
    await run;
    expect(h.events).toEqual(['poke:0', 'verify:0', 'poke:1', 'verify:1']);
    expect(h.logs).toHaveLength(1);
  });
});

describe('rename-section', () => {
  it('refuses another section’s title but allows a case change of its own', async () => {
    const { h, deps } = harness();
    expect(await failure(renameSection(G, 'zarc', 'sectionless', deps))).toBe(
      `A section titled "Sectionless" already exists in ${G} (default).`
    );
    expect(h.pokes).toEqual([]);
    await renameSection(G, 'zarc', 'ARCHIVE', deps);
    expect(h.state.sections!.zarc.meta!.title).toBe('ARCHIVE');
  });

  it('is a no-op for the exact same title and refuses a blank one', async () => {
    const { h, deps } = harness();
    await renameSection(G, 'zarc', 'Archive', deps);
    expect(h.logs).toEqual(['Section zarc is already titled "Archive"']);
    expect(await failure(renameSection(G, 'zarc', ' ', deps))).toBe(
      'Section title cannot be blank.'
    );
    expect(h.pokes).toEqual([]);
  });

  it('applied-then-rejected rename by title: advice names the id, not a re-run by the old title', async () => {
    const { h, deps } = harness({ outcomes: ['apply-then-reject'] });
    const message = await failure(
      renameSection(G, 'Archive', 'Old stuff', deps)
    );
    expect(message).not.toContain('Re-running the command is safe');
    expect(message).toContain(
      `Check tlon groups info ${G}; if section zarc is not titled "Old stuff"`
    );
    expect(await failure(renameSection(G, 'Archive', 'Old stuff', deps))).toBe(
      `Section "Archive" not found in ${G}.`
    );
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups rename-section ${G} zarc 'Old stuff'`,
    ]);
    await runPrinted(commands[0], deps);
    expect(h.logs).toEqual(['Section zarc is already titled "Old stuff"']);
  });

  it('dropped rename: the printed id-based command, quoting an apostrophe, applies it', async () => {
    const { h, deps } = harness({ outcomes: ['drop'] });
    const message = await failure(
      renameSection(G, 'Archive', "Bob's old stuff", deps)
    );
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups rename-section ${G} zarc 'Bob'\\''s old stuff'`,
    ]);
    await runPrinted(commands[0], deps);
    expect(h.state.sections!.zarc.meta).toEqual(
      meta("Bob's old stuff", archiveExtra)
    );
  });
});

describe('delete-section', () => {
  it('refuses default before any poke', async () => {
    const { h, deps } = harness();
    expect(await failure(deleteSection(G, 'Sectionless', deps))).toBe(
      `The default section of ${G} can't be deleted.`
    );
    expect(h.pokes).toEqual([]);
  });

  it('refuses a channel assigned to the section but not listed in it; the printed repair works', async () => {
    const state = baseGroup();
    state.sections!.zarc.order = [NEWS, MEMES];
    const { h, deps } = harness({ state });
    const message = await failure(deleteSection(G, 'zarc', deps));
    expect(message).toContain(
      `${LOGS}: assigned to this section but not listed in it`
    );
    expect(h.pokes).toEqual([]);
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups move-channel ${G} ${LOGS} --section zarc`,
      `tlon groups delete-section ${G} zarc`,
    ]);
    for (const command of commands) await runPrinted(command, deps);
    expect(h.state.sections!.zarc).toBeUndefined();
    expect(h.state.sections!.default.order).toEqual([
      NEWS,
      MEMES,
      LOGS,
      GENERAL,
      RANDOM,
    ]);
    expect(
      Object.values(h.state.channels!).every((c) => c.section === 'default')
    ).toBe(true);
  });

  it('names listed-elsewhere and listed-but-not-a-channel separately', async () => {
    const state = baseGroup();
    state.channels![LOGS].section = 'default';
    state.sections!.zarc.order!.push('chat/~zod/ghost');
    const { h, deps } = harness({ state });
    const message = await failure(deleteSection(G, 'zarc', deps));
    expect(message).toContain(`${LOGS}: listed here but assigned to default`);
    expect(message).toContain('chat/~zod/ghost: listed but not a channel');
    expect(message).toContain("The CLI can't repair chat/~zod/ghost");
    expect(h.pokes).toEqual([]);
  });

  it('drains in reverse, verifying each move before the next, then deletes', async () => {
    const { h, deps } = harness();
    await deleteSection(G, 'Archive', deps);
    expect(h.pokes).toEqual([
      channelPoke(MEMES, 'default'),
      channelPoke(LOGS, 'default'),
      channelPoke(NEWS, 'default'),
      sectionPoke('zarc', { del: null }),
    ]);
    expect(h.events).toEqual([
      'poke:0',
      'verify:0',
      'poke:1',
      'verify:1',
      'poke:2',
      'verify:2',
      'poke:3',
      'verify:3',
    ]);
    expect(h.state.sections!.default.order).toEqual([
      NEWS,
      LOGS,
      MEMES,
      GENERAL,
      RANDOM,
    ]);
    expect(h.state['section-order']).toEqual(['default']);
    expect(h.logs).toEqual([
      '✓ Section deleted: Archive (zarc)',
      `Its channels were moved to the top of the default section: ${NEWS}, ${LOGS}, ${MEMES}`,
    ]);
  });

  it('does not send the next move until the previous one is read back', async () => {
    const gate = deferred();
    const { h, deps } = harness({ verifyGate: gate.promise });
    const run = deleteSection(G, 'zarc', deps);
    await Bun.sleep(5);
    expect(h.events).toEqual(['poke:0', 'verify:0']);
    expect(h.logs).toEqual([]);
    gate.resolve();
    await run;
    expect(h.pokes).toHaveLength(4);
  });

  it('stops at an unverified move: confirmed, unverified and not attempted; no del', async () => {
    const { h, deps } = harness({ outcomes: ['apply', 'drop'] });
    const message = await failure(deleteSection(G, 'zarc', deps));
    expect(message).toContain(`Moved to default (confirmed): ${MEMES}`);
    expect(message).toContain(`${LOGS}: applied but unverified`);
    expect(message).toContain(`Not attempted: ${NEWS}`);
    expect(message).toContain('The section was not deleted.');
    expect(h.pokes).toHaveLength(2);
    expect(h.state.sections!.zarc).toBeDefined();
    const commands = printedCommands(message);
    expect(commands).toEqual([`tlon groups delete-section ${G} zarc`]);
    await runPrinted(commands[0], deps);
    expect(h.state.sections!.zarc).toBeUndefined();
  });

  it('treats a move that landed and then rejected as applied but unverified', async () => {
    const { h, deps } = harness({ outcomes: ['apply-then-reject'] });
    const message = await failure(deleteSection(G, 'zarc', deps));
    expect(message).toContain(`${MEMES}: applied but unverified`);
    expect(message).toContain('The section was not deleted.');
    expect(h.pokes).toHaveLength(1);
    await runPrinted(printedCommands(message)[0], deps);
    expect(h.state.sections!.zarc).toBeUndefined();
    expect(h.state.sections!.default.order!.slice(0, 3)).toEqual([
      NEWS,
      LOGS,
      MEMES,
    ]);
  });

  it('refuses on the final re-read when a channel entered the section, with no del', async () => {
    const { h, deps } = harness({
      onRead: (call, state) => {
        // Only the dedicated pre-delete read sees the newcomer.
        if (call === 2) {
          state.channels!['chat/~zod/late'] = { section: 'zarc' };
          state.sections!.zarc.order = ['chat/~zod/late'];
        }
      },
    });
    const message = await failure(deleteSection(G, 'zarc', deps));
    expect(message).toContain(
      'New channels entered Archive during the delete: chat/~zod/late.'
    );
    expect(message).toContain(
      `Their moves to default are confirmed for ${MEMES}, ${LOGS}, ${NEWS}.`
    );
    expect(h.pokes.some(isSectionPoke)).toBe(false);
    expect(h.state.sections!.zarc).toBeDefined();
  });

  it('refuses on the final re-read when only an assignment names the section', async () => {
    const { h, deps } = harness({
      onRead: (call, state) => {
        if (call === 2) state.channels![GENERAL].section = 'zarc';
      },
    });
    const message = await failure(deleteSection(G, 'zarc', deps));
    expect(message).toContain(`during the delete: ${GENERAL}.`);
    expect(h.pokes.some(isSectionPoke)).toBe(false);
  });

  it('a failed final read reports the confirmed moves, sends no del, and the printed re-run finishes', async () => {
    let failRead = true;
    const { h, deps } = harness({
      onRead: (call) => {
        if (call === 2 && failRead) throw new Error('scry 503');
      },
    });
    const message = await failure(deleteSection(G, 'zarc', deps));
    expect(message).toBe(
      [
        `Deleting section Archive (zarc) in ${G} stopped: reading the group before the delete failed: scry 503`,
        `  Moved to default (confirmed): ${MEMES}, ${LOGS}, ${NEWS}`,
        '  The deletion was NOT attempted.',
        `To finish, re-run: tlon groups delete-section ${G} zarc`,
      ].join('\n')
    );
    expect(h.pokes.some(isSectionPoke)).toBe(false);
    expect(h.state.sections!.zarc).toBeDefined();
    failRead = false;
    const commands = printedCommands(message);
    expect(commands).toEqual([`tlon groups delete-section ${G} zarc`]);
    await runPrinted(commands[0], deps);
    expect(h.pokes.at(-1)).toEqual(sectionPoke('zarc', { del: null }));
    expect(h.state.sections!.zarc).toBeUndefined();
    expect(h.state.sections!.default.order).toEqual([
      NEWS,
      LOGS,
      MEMES,
      GENERAL,
      RANDOM,
    ]);
  });

  it('reports an interleaved default order distinctly; the printed repair restores it', async () => {
    const { h, deps } = harness({
      beforeVerify: (index, state) => {
        // Another admin puts a channel at the top of default mid-drain.
        if (index === 1) {
          const order = state.sections!.default.order!;
          state.sections!.default.order = [
            RANDOM,
            ...order.filter((n) => n !== RANDOM),
          ];
        }
      },
    });
    const message = await failure(deleteSection(G, 'zarc', deps));
    expect(message).toContain(
      `All 3 channels moved to the default section, but its order there is [${NEWS}, ${RANDOM}, ${LOGS}, ${MEMES}, ${GENERAL}], not [${NEWS}, ${LOGS}, ${MEMES}, ...]. The section was not deleted.`
    );
    expect(message).not.toContain('applied but unverified');
    expect(h.state.sections!.zarc).toBeDefined();
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups move-channel ${G} ${NEWS} --section default --index 0`,
      `tlon groups move-channel ${G} ${LOGS} --section default --index 1`,
      `tlon groups move-channel ${G} ${MEMES} --section default --index 2`,
      `tlon groups delete-section ${G} zarc`,
      `tlon groups delete-section ${G} zarc`,
    ]);
    for (const command of commands.slice(0, 4)) {
      await runPrinted(command, deps);
    }
    expect(h.state.sections!.zarc).toBeUndefined();
    expect(h.state.sections!.default.order).toEqual([
      NEWS,
      LOGS,
      MEMES,
      RANDOM,
      GENERAL,
    ]);
  });

  it('an empty section sends only del; an unverified del says re-run', async () => {
    const state = baseGroup();
    state.sections!.zempty = { meta: meta('Empty'), order: [] };
    state['section-order']!.push('zempty');
    const { h, deps } = harness({ state, outcomes: ['drop'] });
    const message = await failure(deleteSection(G, 'Empty', deps));
    expect(h.pokes).toEqual([sectionPoke('zempty', { del: null })]);
    expect(message).toContain('was sent but not confirmed');
    expect(message).toContain('"not found" then means it is done');
    expect(message).not.toContain('All channels moved');
    applyPoke(h.state, h.pokes[0]);
    const commands = printedCommands(message);
    expect(commands).toEqual([`tlon groups delete-section ${G} zempty`]);
    expect(await failure(runPrinted(commands[0], deps))).toBe(
      `Section "zempty" not found in ${G}.`
    );
  });
});

describe('move-channel', () => {
  it('cross-section without --index appends: %section then move-nest "2"', async () => {
    const state = baseGroup();
    state.sections!.zarc.order = [NEWS, LOGS];
    state.channels![MEMES].section = 'default';
    state.sections!.default.order!.push(MEMES);
    const { h, deps } = harness({ state });
    await moveChannel(G, GENERAL, 'Archive', undefined, deps);
    expect(h.pokes).toEqual([
      channelPoke(GENERAL, 'zarc'),
      sectionPoke('zarc', { 'move-nest': { nest: GENERAL, idx: '2' } }),
    ]);
    expect(h.state.sections!.zarc.order).toEqual([NEWS, LOGS, GENERAL]);
    expect(h.logs).toEqual([
      `✓ Moved ${GENERAL} to Archive (zarc) at position 2`,
    ]);
  });

  it('cross-section --index 0 sends only %section', async () => {
    const { h, deps } = harness();
    await moveChannel(G, GENERAL, 'zarc', 0, deps);
    expect(h.pokes).toEqual([channelPoke(GENERAL, 'zarc')]);
  });

  it('same section --index 2 sends only move-nest; no index is a no-op', async () => {
    const { h, deps } = harness();
    await moveChannel(G, NEWS, 'zarc', 2, deps);
    expect(h.pokes).toEqual([
      sectionPoke('zarc', { 'move-nest': { nest: NEWS, idx: '2' } }),
    ]);
    expect(h.state.sections!.zarc.order).toEqual([LOGS, MEMES, NEWS]);
    await moveChannel(G, NEWS, 'zarc', undefined, deps);
    expect(h.pokes).toHaveLength(1);
    expect(h.logs[1]).toBe(`${NEWS} is already in Archive at position 2`);
  });

  it('checks bounds after removing the channel, before any poke', async () => {
    const { h, deps } = harness();
    expect(await failure(moveChannel(G, NEWS, 'zarc', 3, deps))).toBe(
      'Index 3 is out of range for Archive: valid positions after the move are 0..2.'
    );
    expect(await failure(moveChannel(G, GENERAL, 'zarc', 4, deps))).toBe(
      'Index 4 is out of range for Archive: valid positions after the move are 0..3.'
    );
    expect(h.pokes).toEqual([]);
    await moveChannel(G, GENERAL, 'zarc', 3, deps);
    expect(h.state.sections!.zarc.order).toEqual([NEWS, LOGS, MEMES, GENERAL]);
  });

  it('sends %section for an orphan and for a listed-elsewhere channel', async () => {
    const state = baseGroup();
    state.sections!.default.order = [RANDOM];
    state.channels![LOGS].section = 'default';
    const { h, deps } = harness({ state });
    await moveChannel(G, GENERAL, 'default', undefined, deps);
    expect(h.pokes[0]).toEqual(channelPoke(GENERAL, 'default'));
    await moveChannel(G, LOGS, 'zarc', undefined, deps);
    expect(h.pokes[2]).toEqual(channelPoke(LOGS, 'zarc'));
    expect(h.state.channels![LOGS].section).toBe('zarc');
  });

  it('a %section that landed and then rejected prints an explicit --index; it completes', async () => {
    const { h, deps } = harness({ outcomes: ['apply-then-reject'] });
    const message = await failure(
      moveChannel(G, GENERAL, 'zarc', undefined, deps)
    );
    expect(message).toContain('was sent but not confirmed');
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups move-channel ${G} ${GENERAL} --section zarc --index 3`,
    ]);
    await runPrinted(commands[0], deps);
    expect(h.state.sections!.zarc.order).toEqual([NEWS, LOGS, MEMES, GENERAL]);
  });

  it('an unverified move-nest prints an explicit --index; it completes', async () => {
    const { h, deps } = harness({ outcomes: ['apply', 'drop'] });
    const message = await failure(
      moveChannel(G, GENERAL, 'zarc', undefined, deps)
    );
    expect(message).toContain(
      `${GENERAL} was moved to Archive (zarc) (confirmed), but positioning it at 3`
    );
    const commands = printedCommands(message);
    expect(commands).toEqual([
      `tlon groups move-channel ${G} ${GENERAL} --section zarc --index 3`,
    ]);
    await runPrinted(commands[0], deps);
    expect(h.state.sections!.zarc.order).toEqual([NEWS, LOGS, MEMES, GENERAL]);
  });

  it('waits for the %section read-back before sending move-nest', async () => {
    const gate = deferred();
    const { h, deps } = harness({ verifyGate: gate.promise });
    const run = moveChannel(G, GENERAL, 'zarc', undefined, deps);
    await Bun.sleep(5);
    expect(h.events).toEqual(['poke:0', 'verify:0']);
    gate.resolve();
    await run;
    expect(h.events).toEqual(['poke:0', 'verify:0', 'poke:1', 'verify:1']);
  });

  it('refuses a channel that is not in the group', async () => {
    const { h, deps } = harness();
    expect(
      await failure(moveChannel(G, 'chat/~zod/nope', 'zarc', 0, deps))
    ).toBe(`Channel chat/~zod/nope is not in ${G}.`);
    expect(h.pokes).toEqual([]);
  });
});

describe('order-sections', () => {
  it('names missing, duplicated and unknown sections, without poking', async () => {
    const state = baseGroup();
    state.sections!.zthree = { meta: meta('Three'), order: [] };
    state['section-order']!.push('zthree');
    const { h, deps } = harness({ state });
    const message = await failure(
      orderSections(G, ['zarc', 'Archive', 'Bogus'], deps)
    );
    expect(message).toContain('Missing: Sectionless (default), Three (zthree)');
    expect(message).toContain('Duplicated: Archive (zarc)');
    expect(message).toContain('Unknown: "Bogus"');
    expect(h.pokes).toEqual([]);
  });

  it('is a no-op when already ordered', async () => {
    const { h, deps } = harness();
    await orderSections(G, ['default', 'zarc'], deps);
    expect(h.pokes).toEqual([]);
    expect(h.logs).toEqual([`Sections in ${G} are already in that order.`]);
  });

  it('requires and restores a section missing from section-order', async () => {
    const state = baseGroup();
    state.sections!.zhid = { meta: meta('Hidden'), order: [] };
    const { h, deps } = harness({ state });
    expect(
      await failure(orderSections(G, ['zarc', 'default'], deps))
    ).toContain('Missing: Hidden (zhid)');
    await orderSections(G, ['zhid', 'zarc', 'default'], deps);
    expect(h.pokes).toEqual([orderPoke(['zhid', 'zarc', 'default'])]);
    expect(h.state['section-order']).toEqual(['zhid', 'zarc', 'default']);
  });
});
