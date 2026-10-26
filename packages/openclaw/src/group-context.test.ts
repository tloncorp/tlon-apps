import { afterEach, describe, expect, it } from 'vitest';

import {
  _testing,
  createGroupContextRuntime,
  handleGroupContextBeforePromptBuild,
  parseGroupChannels,
  publishGroupContextRuntime,
  unpublishGroupContextRuntime,
} from './group-context.js';

const flag = '~host/club';
const general = 'chat/~host/general';
const sessionKey = `agent:main:tlon:group:${general}`;
const HOUR = 60 * 60 * 1000;

function channelFact(nest: string, diff: Record<string, unknown>) {
  return { flag, update: { time: '1', diff: { channel: { nest, diff } } } };
}

function setup(start = 100 * HOUR) {
  let clock = start;
  const runtime = createGroupContextRuntime({ now: () => clock });
  runtime.applySnapshot(
    new Map([
      [
        flag,
        {
          title: 'Book Club',
          channels: parseGroupChannels({
            [general]: { meta: { title: 'General' }, readers: [] },
            'chat/~host/Random': { meta: { title: 'Random' }, readers: [] },
            'chat/~host/mods': { meta: { title: 'Mods' }, readers: ['admin'] },
            'notes/~host/reading': { meta: { title: 'Reading' }, readers: [] },
          }),
        },
      ],
    ]),
    runtime.beginSnapshot()
  );
  const context = (key = sessionKey) =>
    runtime.handleBeforePromptBuild({ sessionKey: key })?.prependContext;
  return {
    runtime,
    context,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

afterEach(() => {
  _testing.clearRuntimeSlot();
});

describe('group context', () => {
  it('puts the location in cached system context, identifiers only', () => {
    const { runtime } = setup();
    const result = (key: string) =>
      runtime.handleBeforePromptBuild({ sessionKey: key });
    const first = result(sessionKey)!;
    expect(first.appendSystemContext).toContain(
      `the channel ${general} in the Tlon workspace (group) ${flag}`
    );
    expect(first.appendSystemContext).toContain(`"here" mean ${flag}`);
    expect(first.appendSystemContext).not.toContain('Book Club');
    expect(first.prependContext).toContain(
      `Workspace "Book Club" (${flag}), channel "General" (${general}).`
    );
    // Stable across activity and threads, so the provider's cache holds.
    runtime.recordMessage({
      id: 'm1',
      nest: general,
      sender: '~nec',
      text: 'hi',
    });
    const later = result(`${sessionKey}:thread:170.141`)!;
    expect(later.appendSystemContext).toBe(first.appendSystemContext);
    expect(later.prependContext).not.toBe(first.prependContext);
  });

  it('matches lowercased session keys against canonical nests', () => {
    const { runtime } = setup();
    expect(
      runtime.handleBeforePromptBuild({
        sessionKey: 'agent:main:tlon:group:chat/~host/random',
      })?.appendSystemContext
    ).toContain('the channel chat/~host/Random in');
  });

  it('adds nothing for a channel listed in more than one group', () => {
    const { runtime, context } = setup();
    runtime.applySnapshot(
      new Map([
        [
          '~nec/other',
          {
            title: 'Other',
            channels: parseGroupChannels({ [general]: { readers: [] } }),
          },
        ],
      ]),
      runtime.beginSnapshot()
    );
    expect(context()).toBeUndefined();
  });

  it('adds nothing for DMs or channels in no known group', () => {
    const { context } = setup();
    expect(context('agent:main:tlon:direct:~nec')).toBeUndefined();
    expect(context('agent:main:tlon:group:chat/~other/lobby')).toBeUndefined();
  });

  it('digests open siblings and never names a restricted one', () => {
    const { runtime, context } = setup();
    runtime.recordMessage({
      id: 'm2',
      nest: general,
      sender: '~nec',
      text: 'hi',
    });
    runtime.recordMessage({
      id: 'm3',
      nest: 'chat/~host/Random',
      sender: '~bud',
      text: 'meeting  moved\nto friday',
    });
    runtime.recordMessage({
      id: 'm4',
      nest: 'chat/~host/mods',
      sender: '~nec',
      text: 'ban ~bud?',
    });
    const text = context()!;
    expect(text).toContain(
      `- "General" (${general}) — this channel: 1 message from 1 ship`
    );
    expect(text).toContain(
      '- "Random" (chat/~host/Random): 1 message from 1 ship; latest: "meeting moved to friday"'
    );
    expect(text).toContain(
      'Other channels in this workspace: "Reading" (notes/~host/reading)'
    );
    expect(text).not.toContain('mods');
    expect(text).not.toContain('ban ~bud');
  });

  it('keeps no activity for channels outside known groups', () => {
    const { runtime, context } = setup();
    runtime.recordMessage({
      id: 'm5',
      nest: 'chat/~other/lobby',
      sender: '~nec',
    });
    runtime.recordMessage({ id: 'm6', nest: '~nec', sender: '~nec' });
    expect(context('agent:main:tlon:group:chat/~other/lobby')).toBeUndefined();
    expect(context()).not.toContain('Activity you have seen');
  });

  it('drops a snippet when its message is edited or deleted', () => {
    const { runtime, context } = setup();
    const random = 'chat/~host/Random';
    runtime.recordMessage({
      nest: random,
      id: 'a',
      sender: '~bud',
      text: 'oops',
    });
    runtime.forgetMessage({ nest: random, id: 'other' });
    expect(context()).toContain('latest: "oops"');
    runtime.forgetMessage({ nest: random, id: 'a' });
    const text = context()!;
    expect(text).not.toContain('oops');
    expect(text).toContain(`"Random" (${random}): 1 message from 1 ship\n`);
  });

  it('never shows a snippet older than the window', () => {
    const { runtime, context, advance } = setup();
    const random = 'chat/~host/Random';
    runtime.recordMessage({
      nest: random,
      id: 'a',
      sender: '~bud',
      text: 'old news',
    });
    advance(23 * HOUR);
    runtime.recordMessage({ nest: random, id: 'b', sender: '~bud' });
    advance(2 * HOUR);
    const text = context()!;
    expect(text).toContain(`"Random" (${random}): 1 message`);
    expect(text).not.toContain('old news');
  });

  it('describes a restricted channel to itself', () => {
    const { runtime, context } = setup();
    runtime.recordMessage({
      id: 'm7',
      nest: 'chat/~host/mods',
      sender: '~nec',
    });
    expect(context('agent:main:tlon:group:chat/~host/mods')).toContain(
      '"Mods" (chat/~host/mods) — this channel: 1 message'
    );
  });

  it('tracks reader changes from /groups/ui facts', () => {
    const { runtime, context } = setup();
    runtime.handleGroupsUiEvent(
      channelFact('chat/~host/Random', { 'add-sects': ['admin'] })
    );
    expect(context()).not.toContain('Random');
    runtime.handleGroupsUiEvent(
      channelFact('chat/~host/Random', { 'del-sects': ['admin'] })
    );
    expect(context()).toContain('"Random" (chat/~host/Random)');
    runtime.handleGroupsUiEvent(
      channelFact('chat/~host/mods', {
        edit: { meta: { title: 'Mods' }, readers: [] },
      })
    );
    expect(context()).toContain('"Mods" (chat/~host/mods)');
  });

  it('keeps a reader change that lands while a snapshot is in flight', () => {
    const { runtime, context } = setup();
    const since = runtime.beginSnapshot();
    runtime.handleGroupsUiEvent(
      channelFact('chat/~host/Random', { 'add-sects': ['admin'] })
    );
    // The snapshot was fetched before the change and still shows it open.
    runtime.applySnapshot(
      new Map([
        [
          flag,
          {
            title: 'Book Club',
            channels: parseGroupChannels({
              [general]: { meta: { title: 'General' }, readers: [] },
              'chat/~host/Random': { meta: { title: 'Random' }, readers: [] },
            }),
          },
        ],
      ]),
      since
    );
    expect(context()).not.toContain('Random');
    runtime.applySnapshot(
      new Map([
        [
          flag,
          {
            title: 'Book Club',
            channels: parseGroupChannels({
              [general]: { meta: { title: 'General' }, readers: [] },
              'chat/~host/Random': { meta: { title: 'Random' }, readers: [] },
            }),
          },
        ],
      ]),
      runtime.beginSnapshot()
    );
    expect(context()).toContain('Random');
  });

  it('applies overlapping snapshots in the order they were taken', () => {
    const { runtime, context } = setup();
    const snapshot = (readers: string[]) =>
      new Map([
        [
          flag,
          {
            title: 'Book Club',
            channels: parseGroupChannels({
              [general]: { meta: { title: 'General' }, readers: [] },
              'chat/~host/Random': { meta: { title: 'Random' }, readers },
            }),
          },
        ],
      ]);
    const older = runtime.beginSnapshot();
    const newer = runtime.beginSnapshot();
    // The newer one, taken after Random was restricted, lands first.
    runtime.applySnapshot(snapshot(['admin']), newer);
    runtime.applySnapshot(snapshot([]), older);
    expect(context()).not.toContain('Random');
  });

  it('tracks channels and groups from /groups/ui facts', () => {
    const { runtime, context } = setup();
    runtime.handleGroupsUiEvent(
      channelFact('heap/~host/pics', {
        add: { meta: { title: 'Pics' }, readers: [] },
      })
    );
    runtime.handleGroupsUiEvent(
      channelFact('notes/~host/reading', { del: null })
    );
    runtime.handleGroupsUiEvent({
      flag,
      update: { time: '2', diff: { meta: { title: 'Readers' } } },
    });
    const text = context()!;
    expect(text).toContain('"Pics" (heap/~host/pics)');
    expect(text).not.toContain('Reading');
    expect(text).toContain(`"Readers" (${flag})`);

    runtime.handleGroupsUiEvent({
      flag,
      update: { time: '3', diff: { del: null } },
    });
    expect(context()).toBeUndefined();

    runtime.handleGroupsUiEvent({
      flag,
      update: {
        time: '4',
        diff: {
          create: {
            meta: { title: 'Fresh' },
            channels: {
              [general]: { meta: { title: 'General' }, readers: [] },
            },
          },
        },
      },
    });
    expect(context()).toContain(`"Fresh" (${flag})`);
  });

  it('counts only the last 24h and says when it started seeing', () => {
    const { runtime, context, advance } = setup();
    runtime.recordMessage({
      id: 'm8',
      nest: 'chat/~host/Random',
      sender: '~bud',
      text: 'old',
    });
    expect(context()).toMatch(/Activity you have seen since \d{4}-/);
    advance(25 * HOUR);
    const text = context()!;
    expect(text).not.toContain('Activity you have seen');
    expect(text).toContain('"Random" (chat/~host/Random)');
    runtime.recordMessage({ id: 'm9', nest: general, sender: '~nec' });
    expect(context()).toContain('Activity you have seen in the last 24h');
  });
});

describe('group context publication', () => {
  it('reaches the published runtime and stops after unpublish', () => {
    const { runtime } = setup();
    expect(handleGroupContextBeforePromptBuild({ sessionKey })).toBeUndefined();
    publishGroupContextRuntime(runtime);
    expect(
      handleGroupContextBeforePromptBuild({ sessionKey })?.prependContext
    ).toContain(flag);
    unpublishGroupContextRuntime(createGroupContextRuntime());
    expect(handleGroupContextBeforePromptBuild({ sessionKey })).toBeDefined();
    unpublishGroupContextRuntime(runtime);
    expect(handleGroupContextBeforePromptBuild({ sessionKey })).toBeUndefined();
  });
});
