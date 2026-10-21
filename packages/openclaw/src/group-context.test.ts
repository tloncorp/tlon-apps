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
    ])
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
  it('names the workspace and channel for group channel turns, threads included', () => {
    const { context } = setup();
    const text = context();
    expect(text).toContain(
      `the channel "General" (${general}) in the workspace (group) "Book Club" (${flag})`
    );
    expect(text).toContain(`"here" mean ${flag}`);
    expect(context(`${sessionKey}:thread:170.141`)).toBe(text);
  });

  it('matches lowercased session keys against canonical nests', () => {
    const { context } = setup();
    expect(context('agent:main:tlon:group:chat/~host/random')).toContain(
      'the channel "Random" (chat/~host/Random)'
    );
  });

  it('adds nothing for DMs or channels in no known group', () => {
    const { context } = setup();
    expect(context('agent:main:tlon:direct:~nec')).toBeUndefined();
    expect(context('agent:main:tlon:group:chat/~other/lobby')).toBeUndefined();
  });

  it('digests open siblings and never names a restricted one', () => {
    const { runtime, context } = setup();
    runtime.recordMessage({ nest: general, sender: '~nec', text: 'hi' });
    runtime.recordMessage({
      nest: 'chat/~host/Random',
      sender: '~bud',
      text: 'meeting  moved\nto friday',
    });
    runtime.recordMessage({
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
    runtime.recordMessage({ nest: 'chat/~other/lobby', sender: '~nec' });
    runtime.recordMessage({ nest: '~nec', sender: '~nec' });
    expect(context('agent:main:tlon:group:chat/~other/lobby')).toBeUndefined();
    expect(context()).not.toContain('Activity you have seen');
  });

  it('describes a restricted channel to itself', () => {
    const { runtime, context } = setup();
    runtime.recordMessage({ nest: 'chat/~host/mods', sender: '~nec' });
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
      nest: 'chat/~host/Random',
      sender: '~bud',
      text: 'old',
    });
    expect(context()).toMatch(/Activity you have seen since \d{4}-/);
    advance(25 * HOUR);
    const text = context()!;
    expect(text).not.toContain('Activity you have seen');
    expect(text).toContain('"Random" (chat/~host/Random)');
    runtime.recordMessage({ nest: general, sender: '~nec' });
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
