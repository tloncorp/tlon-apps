import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type RecentContextGroup,
  createRecentContextRuntime,
} from './recent-context.js';

const bot = '~bot';
const club = '~host/club';
const general = 'chat/~host/general';
const solo = '~bot/solo';
const soloChat = 'chat/~bot/solo-chat';
const MINUTE = 60 * 1000;

const dmKey = (ship: string) => `agent:main:tlon:direct:${ship}`;
const channelKey = (nest: string) => `agent:main:tlon:group:${nest}`;

function setup(
  groups: Record<string, RecentContextGroup | Error>,
  complete?: (params: { prompt: string }) => Promise<string>
) {
  let clock = 1_000 * MINUTE;
  const fetchGroup = vi.fn(async (flag: string) => {
    const group = groups[flag];
    if (!group || group instanceof Error) throw group ?? new Error('unknown');
    return group;
  });
  const runtime = createRecentContextRuntime({
    botShip: bot,
    channelToGroup: new Map([
      [general, club],
      [soloChat, solo],
    ]),
    fetchGroup,
    complete,
    now: () => clock,
  });
  const context = async (sessionKey: string) =>
    (await runtime.handleBeforePromptBuild({ sessionKey }))?.appendContext;
  return {
    runtime,
    context,
    fetchGroup,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const members = (...ships: string[]) => ({
  privacy: 'private',
  members: [bot, ...ships].map((contactId) => ({ contactId })),
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recent context audience', () => {
  it('shows a DM the groups its peer belongs to, and only those', async () => {
    const { runtime, context } = setup({
      [club]: members('~zod', '~nec'),
      [solo]: members('~bus'),
    });
    runtime.recordInbound({
      sessionKey: channelKey(general),
      sender: '~nec',
      text: 'rogue combo points',
    });
    runtime.recordInbound({
      sessionKey: channelKey(soloChat),
      sender: '~bus',
      text: 'bus only',
    });

    const zod = await context(dmKey('~zod'));
    expect(zod).toContain('rogue combo points');
    expect(zod).not.toContain('bus only');
    expect(await context(dmKey('~wet'))).toBeUndefined();
  });

  it("shows a peer's DM in a group whose only other member is the bot", async () => {
    const { runtime, context } = setup({
      [solo]: members('~zod'),
      [club]: members('~zod', '~nec'),
    });
    runtime.recordInbound({
      sessionKey: dmKey('~zod'),
      sender: '~zod',
      text: 'private plans',
    });
    runtime.recordReply({ sessionKey: dmKey('~zod'), text: 'noted' });

    const here = await context(channelKey(soloChat));
    expect(here).toContain('DM with ~zod');
    expect(here).toContain('~zod: private plans');
    expect(here).toContain('you: noted');
    expect(await context(channelKey(general))).toBeUndefined();
  });

  it('pushes nothing into a public group or one whose roster fails', async () => {
    const { runtime, context } = setup({
      [club]: { privacy: 'public', members: [{ contactId: '~zod' }] },
      [solo]: new Error('scry failed'),
    });
    runtime.recordInbound({
      sessionKey: dmKey('~zod'),
      sender: '~zod',
      text: 'private plans',
    });

    expect(await context(channelKey(general))).toBeUndefined();
    expect(await context(channelKey(soloChat))).toBeUndefined();
  });

  it('falls back to posters when a source roster fails', async () => {
    const { runtime, context } = setup({ [club]: new Error('scry failed') });
    runtime.recordInbound({
      sessionKey: channelKey(general),
      sender: '~zod',
      text: 'zod said this',
    });

    expect(await context(dmKey('~zod'))).toContain('zod said this');
    expect(await context(dmKey('~nec'))).toBeUndefined();
  });

  it('counts invitees and leaves out the current conversation', async () => {
    const { runtime, context } = setup({
      [solo]: members('~zod', '~nec'),
    });
    runtime.recordInbound({
      sessionKey: dmKey('~zod'),
      sender: '~zod',
      text: 'private plans',
    });

    expect(await context(channelKey(soloChat))).toBeUndefined();
    expect(await context(dmKey('~zod'))).toBeUndefined();
  });

  it('drops activity older than the window', async () => {
    const { runtime, context, advance } = setup({ [club]: members('~zod') });
    runtime.recordInbound({
      sessionKey: channelKey(general),
      sender: '~zod',
      text: 'old news',
    });
    advance(25 * 60 * MINUTE);

    expect(await context(dmKey('~zod'))).toBeUndefined();
  });
});

describe('recent context notes', () => {
  it("summarizes a session from its own lines and renders what's newer", async () => {
    vi.useFakeTimers();
    const complete = vi.fn(async () => 'Planning a trip.');
    const { runtime, context, advance } = setup(
      { [club]: members('~zod') },
      complete
    );
    runtime.recordInbound({
      sessionKey: channelKey(general),
      sender: '~zod',
      text: 'where should we go',
    });
    runtime.recordInbound({
      sessionKey: dmKey('~nec'),
      sender: '~nec',
      text: 'unrelated secret',
    });
    advance(20_000);
    await vi.advanceTimersByTimeAsync(20_000);

    const prompts = complete.mock.calls.map(([params]) => params.prompt);
    const clubPrompt = prompts.find((p) => p.includes(general));
    expect(clubPrompt).toContain('where should we go');
    expect(clubPrompt).not.toContain('unrelated secret');

    runtime.recordReply({
      sessionKey: channelKey(general),
      text: 'the coast',
    });
    const rendered = await context(dmKey('~zod'));
    expect(rendered).toContain('status: Planning a trip.');
    expect(rendered).toContain('you: the coast');
    expect(rendered).not.toContain('where should we go');
  });
});
