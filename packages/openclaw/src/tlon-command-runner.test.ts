import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_BUCKETS_CLI_TIMEOUT_MS,
  DEFAULT_TLON_CLI_TIMEOUT_MS,
  defaultTlonCliTimeoutMs,
  runTlonCommand,
} from './tlon-command-runner.js';

const AMBIENT_CREDENTIAL_ENV = {
  TLON_CONFIG_FILE: '/tmp/ambient-tlon-config.json',
  URBIT_COOKIE: 'urbit-cookie',
  TLON_COOKIE: 'tlon-cookie',
  TLON_URL: 'https://ambient-tlon.example',
  TLON_SHIP: '~ambient-tlon',
  TLON_CODE: 'ambient-tlon-code',
  URBIT_URL: 'https://ambient-urbit.example',
  URBIT_SHIP: '~ambient-urbit',
  URBIT_CODE: 'ambient-urbit-code',
  OPENCLAW_RUNNER_TEST_SENTINEL: 'preserved',
} as const;

type CapturedEnv = Record<keyof typeof AMBIENT_CREDENTIAL_ENV, string | null>;

async function captureChildCredentialEnv(credentials?: {
  url: string;
  ship: string;
  code: string;
}): Promise<CapturedEnv> {
  for (const [key, value] of Object.entries(AMBIENT_CREDENTIAL_ENV)) {
    vi.stubEnv(key, value);
  }
  const keys = Object.keys(AMBIENT_CREDENTIAL_ENV);
  const script = [
    `const keys = ${JSON.stringify(keys)};`,
    'const values = keys.map((key) => [key, process.env[key] ?? null]);',
    'process.stdout.write(JSON.stringify(Object.fromEntries(values)));',
  ].join('\n');
  const stdout = await runTlonCommand(
    process.execPath,
    ['-e', script],
    credentials
  );
  return JSON.parse(stdout) as CapturedEnv;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('defaultTlonCliTimeoutMs', () => {
  it('allows Buckets operations enough time for broker retries and uploads', () => {
    expect(defaultTlonCliTimeoutMs(['buckets', 'upload'])).toBe(
      DEFAULT_BUCKETS_CLI_TIMEOUT_MS
    );
  });

  it('keeps the existing deadline for other tlon commands', () => {
    expect(defaultTlonCliTimeoutMs(['messages', 'send'])).toBe(
      DEFAULT_TLON_CLI_TIMEOUT_MS
    );
  });
});

describe('runTlonCommand timeout output capture', () => {
  it('terminates and rejects near the timeout when no deadline callback is supplied', async () => {
    const timeoutMs = 300;
    const script = [
      "process.stdout.write('stdout-before-timeout\\n');",
      "process.stderr.write('stderr-before-timeout\\n');",
      'setTimeout(() => {',
      "  process.stderr.write('late exit failure\\n');",
      '  process.exit(7);',
      '}, 1500);',
    ].join('\n');
    const startedAt = performance.now();

    let failure: unknown;
    try {
      await runTlonCommand(process.execPath, ['-e', script], undefined, {
        timeoutMs,
      });
    } catch (error) {
      failure = error;
    }
    const elapsedMs = performance.now() - startedAt;

    expect(elapsedMs).toBeGreaterThanOrEqual(timeoutMs - 50);
    expect(elapsedMs).toBeLessThan(1_000);
    expect(failure).toMatchObject({
      message: `tlon command timed out after ${timeoutMs}ms`,
      stdout: 'stdout-before-timeout\n',
      stderr: 'stderr-before-timeout\n',
    });
  });

  it('rejects near the timeout when a spawnSync grandchild keeps the pipes open', async () => {
    const timeoutMs = 500;
    const grandchildScript = [
      "process.stdout.write('stdout-before-timeout\\n');",
      "process.stderr.write('stderr-before-timeout\\n');",
      'setTimeout(() => {',
      "  process.stdout.write('grandchild-finished\\n');",
      '  process.exit(0);',
      '}, 2500);',
    ].join('\n');
    const wrapperScript = [
      "const { spawnSync } = require('node:child_process');",
      "const result = spawnSync(process.execPath, ['-e', process.argv[1]], {",
      "  stdio: 'inherit',",
      '  env: process.env,',
      '});',
      'if (result.error) throw result.error;',
      'process.exit(result.status ?? 1);',
    ].join('\n');
    const startedAt = performance.now();

    let failure: unknown;
    try {
      await runTlonCommand(
        process.execPath,
        ['-e', wrapperScript, grandchildScript],
        undefined,
        { timeoutMs }
      );
    } catch (error) {
      failure = error;
    }
    const elapsedMs = performance.now() - startedAt;

    expect(elapsedMs).toBeGreaterThanOrEqual(timeoutMs - 50);
    expect(elapsedMs).toBeLessThan(1_500);
    expect(failure).toMatchObject({
      message: `tlon command timed out after ${timeoutMs}ms`,
      stdout: 'stdout-before-timeout\n',
      stderr: 'stderr-before-timeout\n',
    });
  });

  it('reports a deadline without settling and keeps draining a spawnSync child', async () => {
    const grandchildScript = [
      'process.stdout.write(`grandchild-pid:${process.pid}\\n`);',
      'setTimeout(() => {',
      "  process.stdout.write('grandchild-finished\\n');",
      '  process.exit(0);',
      '}, 500);',
    ].join('\n');
    const wrapperScript = [
      "const { spawnSync } = require('node:child_process');",
      "const result = spawnSync(process.execPath, ['-e', process.argv[1]], {",
      "  stdio: 'inherit',",
      '  env: process.env,',
      '});',
      'if (result.error) throw result.error;',
      'process.exit(result.status ?? 1);',
    ].join('\n');

    const onDeadline = vi.fn();
    let settlement: 'pending' | 'resolved' | 'rejected' = 'pending';
    const command = runTlonCommand(
      process.execPath,
      ['-e', wrapperScript, grandchildScript],
      undefined,
      { timeoutMs: 150, onDeadline }
    );
    void command.then(
      () => {
        settlement = 'resolved';
      },
      () => {
        settlement = 'rejected';
      }
    );

    await vi.waitFor(() => expect(onDeadline).toHaveBeenCalledTimes(1));
    expect(settlement).toBe('pending');
    // Deliberately does not assert that the grandchild's first line has already
    // arrived. That would require a spawn plus two pipe hops to complete inside
    // the deadline, which flakes under full-suite load. The draining property is
    // proven below instead, by the resolved value containing output written
    // after the deadline had already fired.
    expect(onDeadline.mock.calls[0]?.[0].stderr).toBe('');
    expect(onDeadline.mock.calls[0]?.[0].stdout).not.toContain(
      'grandchild-finished'
    );

    await expect(command).resolves.toContain('grandchild-finished');
    expect(settlement).toBe('resolved');
    expect(onDeadline).toHaveBeenCalledTimes(1);
  });

  it('rejects with the real exit failure after reporting the deadline', async () => {
    const script = [
      "process.stdout.write('Target notebook created: notes/~bot/recovered\\n');",
      'setTimeout(() => {',
      "  process.stderr.write('native migration failed\\n');",
      '  process.exit(7);',
      '}, 250);',
    ].join('\n');
    const onDeadline = vi.fn();
    let settlement: 'pending' | 'resolved' | 'rejected' = 'pending';
    const command = runTlonCommand(
      process.execPath,
      ['-e', script],
      undefined,
      { timeoutMs: 75, onDeadline }
    );
    void command.then(
      () => {
        settlement = 'resolved';
      },
      () => {
        settlement = 'rejected';
      }
    );

    await vi.waitFor(() => expect(onDeadline).toHaveBeenCalledTimes(1));
    expect(settlement).toBe('pending');

    let failure: unknown;
    try {
      await command;
    } catch (error) {
      failure = error;
    }
    expect(settlement).toBe('rejected');
    expect(failure).toMatchObject({
      message: 'native migration failed',
      stdout: expect.stringContaining(
        'Target notebook created: notes/~bot/recovered'
      ),
      stderr: expect.stringContaining('native migration failed'),
    });
    expect(failure).not.toHaveProperty('timedOut');
  });
});

describe('runTlonCommand credential environment', () => {
  it('scrubs ambient credential selectors when credentials are supplied', async () => {
    const childEnv = await captureChildCredentialEnv({
      url: 'https://selected.example',
      ship: '~selected',
      code: 'selected-code',
    });

    expect(childEnv).toEqual({
      TLON_CONFIG_FILE: null,
      URBIT_COOKIE: null,
      TLON_COOKIE: null,
      TLON_URL: null,
      TLON_SHIP: null,
      TLON_CODE: null,
      URBIT_URL: 'https://selected.example',
      URBIT_SHIP: '~selected',
      URBIT_CODE: 'selected-code',
      OPENCLAW_RUNNER_TEST_SENTINEL: 'preserved',
    });
  });

  it('preserves ambient credential selectors when credentials are omitted', async () => {
    await expect(captureChildCredentialEnv()).resolves.toEqual(
      AMBIENT_CREDENTIAL_ENV
    );
  });
});
