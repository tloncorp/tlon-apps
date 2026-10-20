import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { __resetApiClientForTests } from './api-client';
import {
  mockedCreateChannel,
  mockedGetGroup,
  mockedNotesV1,
} from './tloncorp-api-mock';

const GROUP = '~zod/test-group';

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
const originalCreateGroupNotebook = mockedNotesV1.createGroupNotebook;
const originalGetGroup = mockedGetGroup.impl;
const originalCreateChannel = mockedCreateChannel.impl;

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
  mockedNotesV1.createGroupNotebook = originalCreateGroupNotebook;
  mockedGetGroup.impl = originalGetGroup;
  mockedCreateChannel.impl = originalCreateChannel;
  __resetApiClientForTests();
});

let runCount = 0;

// channels.ts runs its CLI main() on import, reading process.argv and ending
// with process.exit, so each run imports a fresh module instance.
async function runChannels(
  args: string[]
): Promise<{ exitCode: number | undefined; stdout: string[] }> {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalLog = console.log;
  const originalError = console.error;
  const stdout: string[] = [];
  let finish: (code: number | undefined) => void = () => {};
  const exited = new Promise<number | undefined>((resolve) => {
    finish = resolve;
  });
  process.argv = ['tlon', 'channels', ...args];
  process.exit = ((code?: number) => {
    finish(code);
    return undefined as never;
  }) as typeof process.exit;
  console.log = (...parts: unknown[]) => {
    stdout.push(parts.map(String).join(' '));
  };
  console.error = () => {};
  try {
    runCount += 1;
    const specifier = `./channels?run=${runCount}`;
    await import(specifier);
    const exitCode = await exited;
    return { exitCode, stdout };
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.log = originalLog;
    console.error = originalError;
  }
}

describe('channels create output', () => {
  it('prints the group Ref and share guidance for a chat channel', async () => {
    const created: unknown[] = [];
    mockedCreateChannel.impl = async (input: unknown) => {
      created.push(input);
    };

    const { exitCode, stdout } = await runChannels([
      'create',
      GROUP,
      'General',
    ]);

    expect(exitCode).toBe(0);
    expect(created).toHaveLength(1);
    const nest = (created[0] as { id: string }).id;
    expect(nest).toMatch(/^chat\/~zod\/[a-z0-9]{8}$/);
    expect(stdout).toEqual([
      `Adding channel "General" to group ${GROUP}...`,
      '✅ Channel created!',
      `   Nest: ${nest}`,
      '   Title: General',
      `   Group: ${GROUP}`,
      `   Ref: /1/group/${GROUP}`,
      '   Share: channels have no card yet; name the channel and its Nest, and include the group Ref path in a chat message to post a tappable group card.',
    ]);
  });

  it('prints the group Ref and share guidance for a notes channel', async () => {
    const nest = 'notes/~zod/v1abc';
    mockedNotesV1.createGroupNotebook = async () => ({
      host: '~zod',
      flagName: 'v1abc',
    });
    mockedGetGroup.impl = async () => ({
      channels: [{ id: nest, readerRoles: [] }],
    });

    const { exitCode, stdout } = await runChannels([
      'create',
      GROUP,
      'Docs',
      '--kind',
      'notes',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      `Creating %notes channel "Docs" in ${GROUP}...`,
      '✅ Notes channel created!',
      `   Nest: ${nest}`,
      '   Title: Docs',
      `   Group: ${GROUP}`,
      `   Ref: /1/group/${GROUP}`,
      '   Share: channels have no card yet; name the channel and its Nest, and include the group Ref path in a chat message to post a tappable group card.',
    ]);
  });
});
