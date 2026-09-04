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
  // Fields the write replaces without being asked to. `readerRoles` and
  // `currentUserIsMember` ride on the channel; `sectionId` does NOT — it is
  // the group nav section that lists this channel, which is where
  // `updateChannelMeta` gets the `section` it writes back.
  readerRoles?: Array<{ channelId: string; roleId: string }>;
  currentUserIsMember?: boolean;
  sectionId?: string;
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

/** The group listing `getGroups()` returns, with this channel in it. */
function groupListing({ sectionId = 'default', ...channel }: ChannelFixture) {
  return [
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
      navSections: [{ sectionId, channels: [{ channelId: NEST }] }],
    },
  ];
}

function setChannel(channel: ChannelFixture) {
  mockedGetGroups.impl = async () => groupListing(channel);
}

/**
 * What each successive read of the group listing sees.
 *
 * `updateChannelMeta` reads the channel twice — once at the unpublish gate,
 * once immediately before the write — so a SEQUENCE of fixtures is the
 * concurrent writer: whatever the second read returns is what landed in
 * between. The last fixture stands for every read after it.
 */
function setChannelSequence(...fixtures: ChannelFixture[]) {
  let call = 0;
  mockedGetGroups.impl = async () => {
    const fixture = fixtures[Math.min(call, fixtures.length - 1)];
    call += 1;
    return groupListing(fixture);
  };
  return { reads: () => call };
}

/** The description cell the last `updateChannel` write carried, if any. */
type Write = { description: string; title: string };

/** The whole channel value the write carried — %groups replaces all of it. */
type WriteChannel = {
  meta: Write;
  section: string;
  readers: string[];
  join: boolean;
};

function captureWrites(): Write[] {
  const writes: Write[] = [];
  mockedUpdateChannel.impl = async (...args: unknown[]) => {
    const input = args[0] as { channel: { meta: Write } };
    writes.push(input.channel.meta);
    return undefined;
  };
  return writes;
}

/**
 * The same capture, keeping the WHOLE channel value rather than its `meta`.
 * The fields this finding is about — `section`, `readers`, `join` — live
 * outside `meta`, so `captureWrites` above cannot see them.
 */
function captureChannelWrites(): WriteChannel[] {
  const writes: WriteChannel[] = [];
  mockedUpdateChannel.impl = async (...args: unknown[]) => {
    const input = args[0] as { channel: WriteChannel };
    writes.push(input.channel);
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

/**
 * The unpublish the gate above could not see.
 *
 * The gate runs on a listing read one round trip before the write, and
 * `updateChannel` sends a COMPLETE channel with no version or CAS token,
 * rebuilt from the two fields this command knows about. So a surface
 * published between the read and the write is destroyed by a command that
 * looked, found an ordinary channel, and had nothing to refuse — the
 * `--allow-unpublish` decision made silently, by nobody (D188).
 *
 * The fulcrum is the SECOND read: the same command, the same fixture at the
 * gate, differing only in what the channel carries by the time the write
 * comes. `reads()` is not asserted on — the behaviour is — but the sequence
 * is the only thing that moves between these arms.
 */
describe('channels update while another client publishes a surface', () => {
  const ORDINARY: ChannelFixture = {
    description: 'Just a chat',
    descriptionPayload: 'Just a chat',
    surfaceSpec: null,
  };
  const PUBLISHED: ChannelFixture = {
    description: undefined,
    descriptionPayload: surfacePayload(),
    surfaceSpec: JSON.stringify(SPEC),
  };

  it('refuses when the app appears between the gate and the write', async () => {
    setChannelSequence(ORDINARY, PUBLISHED);
    const writes = captureWrites();
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    let message = '';
    try {
      await channels.updateChannelMeta(NEST, { description: 'Beach fund' });
      throw new Error('expected a refusal');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(NEST);
    expect(message).toContain('changed while this command was running');
    expect(message).toContain('Nothing was written');
    // Zero writes — on the write log, not on a final value. The refusal is
    // the whole point: pre-fix this command reached `updateChannel` with a
    // description cell rebuilt from the ordinary channel it read at the gate,
    // and the app that had just been published was gone.
    expect(writes).toEqual([]);
    // And it did not congratulate itself on the way past.
    expect(stdout.lines.join('\n')).not.toContain('✅');
  });

  it('refuses a title-only rename for the same reason', async () => {
    setChannelSequence(ORDINARY, PUBLISHED);
    const writes = captureWrites();
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await expect(
      channels.updateChannelMeta(NEST, { title: 'Ledger v2' })
    ).rejects.toThrow('changed while this command was running');
    expect(writes).toEqual([]);
  });

  it('refuses when the channel is gone by the time it writes', async () => {
    // The other shape of the same gap: not a different value, no value.
    let call = 0;
    mockedGetGroups.impl = async () => {
      call += 1;
      return call === 1 ? groupListing(ORDINARY) : [];
    };
    const writes = captureWrites();
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await expect(
      channels.updateChannelMeta(NEST, { description: 'Beach fund' })
    ).rejects.toThrow('changed while this command was running');
    expect(writes).toEqual([]);
  });

  it('writes when the channel did not move — the differential arm', async () => {
    // Two reads of the SAME channel. Without this, the refusals above would
    // pass equally against a build that had started refusing every edit.
    setChannelSequence(ORDINARY, ORDINARY);
    const writes = captureWrites();
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await channels.updateChannelMeta(NEST, { description: 'Still a chat' });

    expect(writes).toHaveLength(1);
    expect(writes[0].description).toContain('Still a chat');
  });
});

/**
 * The three fields the fence did not fence.
 *
 * `updateChannel` sends a COMPLETE channel and %groups replaces the whole
 * thing, so the write puts back `section`, `readers` and `join` as they were
 * at the first read — but the identity the pre-write re-read compared was a
 * hand-maintained list of six description-cell fields, none of them these. An
 * admin who changed only a channel's reader roles, or moved it to another nav
 * section, or whose membership flipped, left all six equal: the guard passed
 * and the write silently reverted them.
 *
 * The FULCRUM in each arm is one field of the second fixture, and only that
 * field. The gate fixture is an ordinary channel in every arm, so nothing the
 * unpublish gate looks at moves — these refusals can only be the concurrency
 * fence. The differential arm at the bottom of the previous describe (two
 * identical reads) is what keeps them from passing against a build that
 * refuses everything.
 */
describe('channels update while another client changes readers, section or join', () => {
  const ORDINARY: ChannelFixture = {
    description: 'Just a chat',
    descriptionPayload: 'Just a chat',
    surfaceSpec: null,
  };

  async function expectRefusal(second: ChannelFixture) {
    setChannelSequence(ORDINARY, second);
    const writes = captureChannelWrites();
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    let message = '';
    try {
      await channels.updateChannelMeta(NEST, { description: 'Beach fund' });
      throw new Error('expected a refusal');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(NEST);
    expect(message).toContain('changed while this command was running');
    expect(message).toContain('Nothing was written');
    expect(writes).toEqual([]);
    expect(stdout.lines.join('\n')).not.toContain('✅');
  }

  it('refuses when only the reader roles changed', async () => {
    await expectRefusal({
      ...ORDINARY,
      readerRoles: [{ channelId: NEST, roleId: 'admin' }],
    });
  });

  it('refuses when only the nav section changed', async () => {
    await expectRefusal({ ...ORDINARY, sectionId: 'events' });
  });

  it('refuses when only the join flag changed', async () => {
    await expectRefusal({ ...ORDINARY, currentUserIsMember: false });
  });

  it('writes back exactly what it read when nothing moved — the differential arm', async () => {
    // Both that the arms above are not a build refusing every edit, and that
    // these three fields really are on the wire: the write carries them, so
    // reverting them is a thing this command can do.
    const restricted: ChannelFixture = {
      ...ORDINARY,
      readerRoles: [{ channelId: NEST, roleId: 'admin' }],
      sectionId: 'events',
      currentUserIsMember: false,
    };
    setChannelSequence(restricted, restricted);
    const writes = captureChannelWrites();
    const stdout = captureStdout();
    restores.push(stdout.restore);
    const channels = await loadChannels();

    await channels.updateChannelMeta(NEST, { description: 'Still a chat' });

    expect(writes).toHaveLength(1);
    expect(writes[0].readers).toEqual(['admin']);
    expect(writes[0].section).toBe('events');
    expect(writes[0].join).toBe(false);
  });
});
