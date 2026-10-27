import { afterEach, expect, it } from 'bun:test';

import { runScriptCli } from './script-cli-runner';
import { mockedGetChannelPosts } from './tloncorp-api-mock';

const originalGetChannelPosts = mockedGetChannelPosts.impl;

afterEach(() => {
  mockedGetChannelPosts.impl = originalGetChannelPosts;
});

function runMessages(args: string[]) {
  return runScriptCli(
    'messages',
    args,
    (run) => import(`./messages?run=${run}`)
  );
}

it.each([[[]], [['--json']]])(
  'exits non-zero when a channel fetch fails (%j)',
  async (flags) => {
    mockedGetChannelPosts.impl = async () => {
      throw new Error('channel not found');
    };

    const { exitCode, stdout, stderr } = await runMessages([
      'channel',
      'chat/~zod/missing',
      ...flags,
    ]);

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([
      'Error: Failed to fetch messages from chat/~zod/missing: channel not found. Check that the channel path is correct (e.g., chat/~host/slug)',
    ]);
    if (flags.includes('--json')) {
      expect(stdout).toEqual([]);
    }
  }
);
