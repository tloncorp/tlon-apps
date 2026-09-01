import { afterEach, describe, expect, it } from 'bun:test';

// The process-wide '@tloncorp/api' mock (preloaded via bunfig.toml) is what
// importing ./channels resolves against. `mockedGetGroups` is the whole
// fixture surface these tests need — every channel field under test rides on
// the group listing — and `mockedUpdateChannel` is the write they observe.
import { mockedGetGroups, mockedUpdateChannel } from './tloncorp-api-mock';

const NEST = 'chat/~zod/dash-xl78xbbg';

type ChannelFixture = {
  description?: string | null;
  descriptionPayload?: string | null;
  surfaceSpec?: string | null;
};

const SPEC = {
  version: 1,
  surfaceId: 'dash-xl78xbbg',
  specRevision: 4,
  title: 'Beach Trip Ledger',
  bundle: { assetRef: 'surface://x', sha256: 'a'.repeat(64), size: 12 },
  initialState: {},
  actions: {},
};

/** The description cell a published surface channel actually carries. */
function surfacePayload(description?: string): string {
  return JSON.stringify({
    ...(description === undefined ? {} : { description }),
    channelContentConfiguration: {
      draftInput: 'tlon.r0.input.none',
      defaultPostContentRenderer: 'tlon.r0.content.chat',
      defaultPostCollectionRenderer: 'tlon.r0.collection.surface',
    },
    surfaceSpec: SPEC,
  });
}

function setChannel(channel: ChannelFixture) {
  mockedGetGroups.impl = async () => [
    {
      id: '~zod/beach',
      title: 'Beach',
      channels: [
        {
          id: NEST,
          title: 'Ledger',
          addedToGroupAt: 1,
          currentUserIsMember: true,
          readerRoles: [],
          iconImage: '',
          coverImage: '',
          contentConfiguration: undefined,
          ...channel,
        },
      ],
      navSections: [{ sectionId: 'default', channels: [{ channelId: NEST }] }],
    },
  ];
}

/** The description cell the last `updateChannel` write carried, if any. */
type Write = { description: string; title: string };

function captureWrites(): Write[] {
  const writes: Write[] = [];
  mockedUpdateChannel.impl = async (...args: unknown[]) => {
    const input = args[0] as { channel: { meta: Write } };
    writes.push(input.channel.meta);
    return undefined;
  };
  return writes;
}

function captureStdout(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...parts: unknown[]) => {
    lines.push(parts.map((part) => String(part)).join(' '));
  };
  return { lines, restore: () => (console.log = original) };
}

const restores: Array<() => void> = [];

afterEach(() => {
  while (restores.length > 0) restores.pop()?.();
  mockedGetGroups.impl = async () => [];
  mockedUpdateChannel.impl = async () => undefined;
});

async function loadChannels() {
  return import('./channels');
}

/**
 * `channels update` and `channels rename` rebuild the description cell from
 * the two fields they know about, so every key the cell held that they did
 * not write — the `surfaceSpec` above all — is dropped by the write. That is
 * an unpublish: the channel stops being an app, and its folded state becomes
 * unreachable. These tests are the control for that, and the FULCRUM is
 * `channel.surfaceSpec` on the record `getGroups()` returns: set it and the
 * command must refuse, clear it and the same command must proceed. Nothing
 * else in the test's world moves the outcome.
 */
describe('channels update on a channel that publishes a surface app', () => {
  it('refuses, names the app, and writes nothing', async () => {
    setChannel({
      description: undefined,
      descriptionPayload: surfacePayload(),
      surfaceSpec: JSON.stringify(SPEC),
    });
    const writes = captureWrites();
    const channels = await loadChannels();

    let message = '';
    try {
      await channels.updateChannelMeta(NEST, { description: 'Beach fund' });
      throw new Error('expected a refusal');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('dash-xl78xbbg');
    expect(message).toContain('Beach Trip Ledger');
    expect(message).toContain('spec revision 4');
    expect(message).toContain('--allow-unpublish');
    expect(message).toContain('tlon surface show');
    // The refusal is the whole point: nothing reached the ship.
    expect(writes).toEqual([]);
  });

  it('refuses a title-only rename for the same reason', async () => {
    setChannel({
      description: undefined,
      descriptionPayload: surfacePayload(),
      surfaceSpec: JSON.stringify(SPEC),
    });
    const writes = captureWrites();
    const channels = await loadChannels();

    await expect(
      channels.updateChannelMeta(NEST, { title: 'Ledger v2' })
    ).rejects.toThrow('dash-xl78xbbg');
    expect(writes).toEqual([]);
  });

  it('unpublishes under --allow-unpublish, and says what it destroyed', async () => {
    setChannel({
      description: undefined,
      descriptionPayload: surfacePayload(),
      surfaceSpec: JSON.stringify(SPEC),
    });
    const writes = captureWrites();
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await channels.updateChannelMeta(NEST, {
      description: 'Beach fund',
      allowUnpublish: true,
    });

    expect(writes).toHaveLength(1);
    // The escape hatch really does destroy the definition — asserted, not
    // assumed, so the audit line below is describing something real.
    expect(writes[0].description).not.toContain('surfaceSpec');
    const output = stdout.lines.join('\n');
    expect(output).toContain('Unpublished');
    expect(output).toContain('dash-xl78xbbg');
    expect(output).toContain('Beach Trip Ledger');
    expect(output).toContain('spec revision 4');
  });

  it('leaves an ordinary channel alone — the differential arm', async () => {
    setChannel({
      description: 'Just a chat',
      descriptionPayload: 'Just a chat',
      surfaceSpec: null,
    });
    const writes = captureWrites();
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await channels.updateChannelMeta(NEST, { description: 'Still a chat' });

    expect(writes).toHaveLength(1);
    expect(writes[0].description).toContain('Still a chat');
    expect(stdout.lines.join('\n')).not.toContain('Unpublished');
  });
});

/**
 * `channels info` printed `Description: (none)` over a cell holding the whole
 * app definition — the read a revising bot actually performs, answering "there
 * is nothing here" about the one thing it was looking for. The fulcrum is the
 * same field; these assert what the operator is told on each side of it.
 */
describe('channels info over a structured description cell', () => {
  it('names the app and points at the command that prints it', async () => {
    setChannel({
      description: undefined,
      descriptionPayload: surfacePayload(),
      surfaceSpec: JSON.stringify(SPEC),
    });
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    const info = await channels.getChannelInfo(NEST);
    const output = stdout.lines.join('\n');

    expect(output).toContain('dash-xl78xbbg');
    expect(output).toContain('Beach Trip Ledger');
    expect(output).toContain('spec revision 4');
    expect(output).toContain(`tlon surface show ${NEST}`);
    // "(none)" may still appear — there is no human description — but never
    // as the whole story.
    expect(output).not.toMatch(/^Description: \(none\)$/m);
    expect(info.surface?.surfaceId).toBe('dash-xl78xbbg');
  });

  it('distinguishes a payload with no human description from an empty cell', async () => {
    setChannel({
      description: undefined,
      descriptionPayload: JSON.stringify({
        channelContentConfiguration: { draftInput: 'tlon.r0.input.chat' },
      }),
      surfaceSpec: null,
    });
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await channels.getChannelInfo(NEST);
    const output = stdout.lines.join('\n');

    expect(output).toContain('structured payload');
    expect(output).not.toMatch(/^Description: \(none\)$/m);
  });

  it('still says (none) when the cell really is empty', async () => {
    setChannel({
      description: undefined,
      descriptionPayload: null,
      surfaceSpec: null,
    });
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await channels.getChannelInfo(NEST);
    const output = stdout.lines.join('\n');

    expect(output).toMatch(/^Description: \(none\)$/m);
    expect(output).not.toContain('structured payload');
    expect(output).not.toContain('Surface app');
  });

  it('prints a plain description unchanged', async () => {
    setChannel({
      description: 'Weekly standup',
      descriptionPayload: 'Weekly standup',
      surfaceSpec: null,
    });
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await channels.getChannelInfo(NEST);
    expect(stdout.lines.join('\n')).toContain('Description: Weekly standup');
  });
});
