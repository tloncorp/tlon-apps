import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  _testing,
  createWorkspaceInstructionsRuntime,
  handleWorkspaceBeforePromptBuild,
  nestFromSessionKey,
  publishWorkspaceInstructionsRuntime,
  unpublishWorkspaceInstructionsRuntime,
} from './workspace-instructions.js';

const flag = '~host/club';
const nest = 'chat/~host/discussion';
const sessionKey = `agent:main:tlon:group:${nest}`;

function blobFor(config: Record<string, unknown>): string {
  return JSON.stringify({ version: 2, ...config });
}

function setup(
  options: {
    blob?: string | null;
    channelToGroup?: Map<string, string>;
    jobs?: unknown[];
    now?: () => number;
    ownerShip?: string | null;
    fetchBlob?: () => Promise<string | null>;
  } = {}
) {
  const fetchBlob = vi.fn(
    options.fetchBlob ??
      (async () =>
        options.blob === undefined
          ? blobFor({ bot: '~bot', instructions: 'Keep it short.' })
          : options.blob)
  );
  const runtime = createWorkspaceInstructionsRuntime({
    botShip: 'bot',
    ownerShip: () =>
      options.ownerShip === undefined ? '~host' : options.ownerShip,
    channelToGroup: options.channelToGroup ?? new Map([[nest, flag]]),
    fetchBlob,
    getCron: () => ({ list: async () => options.jobs ?? [] }) as never,
    now: options.now,
  });
  return { runtime, fetchBlob };
}

afterEach(() => {
  _testing.clearRuntimeSlot();
});

describe('nestFromSessionKey', () => {
  it.each([
    [sessionKey, nest],
    [`${sessionKey}:thread:170.141`, nest],
    ['tlon:group:heap/~zod/pics', 'heap/~zod/pics'],
    ['agent:main:tlon:direct:~nec', null],
    ['agent:main:cron:job-1', null],
    [undefined, null],
  ])('%s → %s', (key, expected) => {
    expect(nestFromSessionKey(key)).toBe(expected);
  });
});

describe('handleBeforePromptBuild', () => {
  it('prepends the instructions for a turn in the workspace', async () => {
    const { runtime } = setup();
    const result = await runtime.handleBeforePromptBuild({ sessionKey });
    expect(result?.prependSystemContext).toContain(
      `[Workspace instructions for group ${flag}]`
    );
    expect(result?.prependSystemContext).toMatch(/\n\nKeep it short\.$/);
  });

  it('ignores a group neither the bot nor its owner hosts', async () => {
    const { runtime, fetchBlob } = setup({ ownerShip: '~someone-else' });
    expect(
      await runtime.handleBeforePromptBuild({ sessionKey })
    ).toBeUndefined();
    expect(fetchBlob).not.toHaveBeenCalled();
  });

  it('ignores every group when no owner is configured, except its own', async () => {
    const { runtime } = setup({ ownerShip: null });
    expect(
      await runtime.handleBeforePromptBuild({ sessionKey })
    ).toBeUndefined();

    const own = setup({
      ownerShip: null,
      channelToGroup: new Map([['chat/~bot/discussion', '~bot/club']]),
    });
    const result = await own.runtime.handleBeforePromptBuild({
      sessionKey: 'agent:main:tlon:group:chat/~bot/discussion',
    });
    expect(result?.prependSystemContext).toContain('Keep it short.');
  });

  it('applies in thread sessions', async () => {
    const { runtime } = setup();
    const result = await runtime.handleBeforePromptBuild({
      sessionKey: `${sessionKey}:thread:170.141`,
    });
    expect(result?.prependSystemContext).toContain('Keep it short.');
  });

  it('matches the index case-insensitively, since session keys are lowercased', async () => {
    const { runtime } = setup({
      channelToGroup: new Map([['chat/~host/Discussion', flag]]),
    });
    const result = await runtime.handleBeforePromptBuild({
      sessionKey: 'agent:main:tlon:group:chat/~host/discussion',
    });
    expect(result?.prependSystemContext).toContain('Keep it short.');
  });

  it.each([
    ['another bot', blobFor({ bot: '~other', instructions: 'x' })],
    ['no bot', blobFor({ instructions: 'x' })],
    ['no instructions', blobFor({ bot: '~bot' })],
    ['blank instructions', blobFor({ bot: '~bot', instructions: '  ' })],
    ['a foreign blob', '{"k":1}'],
    ['no blob', null],
  ])('does nothing for %s', async (_, blob) => {
    const { runtime } = setup({ blob });
    expect(
      await runtime.handleBeforePromptBuild({ sessionKey })
    ).toBeUndefined();
  });

  it('does nothing outside a known group channel', async () => {
    const { runtime, fetchBlob } = setup({ channelToGroup: new Map() });
    expect(
      await runtime.handleBeforePromptBuild({ sessionKey })
    ).toBeUndefined();
    expect(
      await runtime.handleBeforePromptBuild({
        sessionKey: 'agent:main:tlon:direct:~nec',
      })
    ).toBeUndefined();
    expect(fetchBlob).not.toHaveBeenCalled();
  });

  it("resolves an isolated cron run's group from its job's delivery target", async () => {
    const { runtime } = setup({
      jobs: [{ id: 'job-1', delivery: { to: `tlon:group:${nest}` } }],
    });
    const result = await runtime.handleBeforePromptBuild({
      sessionKey: 'agent:main:cron:job-1:run:1',
      jobId: 'job-1',
    });
    expect(result?.prependSystemContext).toContain('Keep it short.');
  });

  it('ignores a cron job that delivers to a DM', async () => {
    const { runtime } = setup({
      jobs: [{ id: 'job-1', delivery: { to: '~nec' } }],
    });
    expect(
      await runtime.handleBeforePromptBuild({
        sessionKey: 'agent:main:cron:job-1',
        jobId: 'job-1',
      })
    ).toBeUndefined();
  });
});

describe('blob cache', () => {
  it('reads the blob once within the TTL, then again after it', async () => {
    let time = 0;
    const { runtime, fetchBlob } = setup({ now: () => time });
    await runtime.handleBeforePromptBuild({ sessionKey });
    await runtime.handleBeforePromptBuild({ sessionKey });
    expect(fetchBlob).toHaveBeenCalledTimes(1);
    time = 60_000;
    await runtime.handleBeforePromptBuild({ sessionKey });
    expect(fetchBlob).toHaveBeenCalledTimes(2);
  });

  it('takes a /v3/groups blob fact in place', async () => {
    const { runtime, fetchBlob } = setup();
    await runtime.handleBeforePromptBuild({ sessionKey });
    runtime.handleGroupsResponse({
      flag,
      'r-group': { blob: blobFor({ bot: '~bot', instructions: 'Be formal.' }) },
    });
    const result = await runtime.handleBeforePromptBuild({ sessionKey });
    expect(result?.prependSystemContext).toContain('Be formal.');
    expect(fetchBlob).toHaveBeenCalledTimes(1);
  });

  it('keeps a fact that lands while a fetch is in flight', async () => {
    let resolveFetch!: (blob: string) => void;
    const { runtime, fetchBlob } = setup({
      fetchBlob: () => new Promise((resolve) => (resolveFetch = resolve)),
    });
    const first = runtime.handleBeforePromptBuild({ sessionKey });
    await vi.waitFor(() => expect(fetchBlob).toHaveBeenCalled());
    runtime.handleGroupsResponse({
      flag,
      'r-group': { blob: blobFor({ bot: '~bot', instructions: 'Be formal.' }) },
    });
    resolveFetch(blobFor({ bot: '~bot', instructions: 'Keep it short.' }));
    await first;
    const result = await runtime.handleBeforePromptBuild({ sessionKey });
    expect(result?.prependSystemContext).toContain('Be formal.');
  });

  it('takes a cleared blob', async () => {
    const { runtime } = setup();
    runtime.handleGroupsResponse({ flag, 'r-group': { blob: null } });
    expect(
      await runtime.handleBeforePromptBuild({ sessionKey })
    ).toBeUndefined();
  });

  it('ignores facts that are not blob changes', async () => {
    const { runtime, fetchBlob } = setup();
    runtime.handleGroupsResponse({ flag, 'r-group': { meta: {} } });
    runtime.handleGroupsResponse(null);
    await runtime.handleBeforePromptBuild({ sessionKey });
    expect(fetchBlob).toHaveBeenCalledTimes(1);
  });
});

describe('publication', () => {
  it('is a no-op until a runtime is published', async () => {
    expect(
      await handleWorkspaceBeforePromptBuild({ sessionKey })
    ).toBeUndefined();
  });

  it('routes through the published runtime and leaves a replacement alone', async () => {
    const first = setup().runtime;
    const second = setup({
      blob: blobFor({ bot: '~bot', instructions: 'second' }),
    }).runtime;
    publishWorkspaceInstructionsRuntime(first);
    publishWorkspaceInstructionsRuntime(second);
    unpublishWorkspaceInstructionsRuntime(first);
    const result = await handleWorkspaceBeforePromptBuild({ sessionKey });
    expect(result?.prependSystemContext).toContain('second');
  });
});
