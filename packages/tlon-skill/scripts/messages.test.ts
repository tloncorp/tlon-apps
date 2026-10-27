import { afterEach, beforeEach, expect, it } from 'bun:test';

import { __resetApiClientForTests } from './api-client';
import { mockedGetChannelPosts } from './tloncorp-api-mock';

const ENV_KEYS = [
  'TLON_CONFIG_FILE',
  'URBIT_URL',
  'TLON_URL',
  'URBIT_SHIP',
  'TLON_SHIP',
  'URBIT_COOKIE',
  'TLON_COOKIE',
  'URBIT_CODE',
  'TLON_CODE',
  'TLON_SKILL_DIR',
  'TLON_CACHE_DIR',
  'OPENCLAW_CONFIG',
];

let savedEnv: Record<string, string | undefined> = {};
const originalGetChannelPosts = mockedGetChannelPosts.impl;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.TLON_URL = 'https://zod.tlon.network';
  process.env.TLON_SHIP = '~zod';
  process.env.TLON_CODE = 'sampel-ticlyt-migfun-falmel';
  __resetApiClientForTests();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  mockedGetChannelPosts.impl = originalGetChannelPosts;
  __resetApiClientForTests();
});

let runCount = 0;

// messages.ts runs its CLI main() on import, reading process.argv and ending
// with process.exit, so each run imports a fresh module instance.
async function runMessages(args: string[]): Promise<{
  exitCode: number | undefined;
  stdout: string[];
  stderr: string[];
}> {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalLog = console.log;
  const originalError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];
  let finish: (code: number | undefined) => void = () => {};
  const exited = new Promise<number | undefined>((resolve) => {
    finish = resolve;
  });
  process.argv = ['tlon', 'messages', ...args];
  process.exit = ((code?: number) => {
    finish(code);
    return undefined as never;
  }) as typeof process.exit;
  console.log = (...parts: unknown[]) => {
    stdout.push(parts.map(String).join(' '));
  };
  console.error = (...parts: unknown[]) => {
    stderr.push(parts.map(String).join(' '));
  };
  try {
    runCount += 1;
    await import(`./messages?run=${runCount}`);
    const exitCode = await exited;
    return { exitCode, stdout, stderr };
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.log = originalLog;
    console.error = originalError;
  }
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
