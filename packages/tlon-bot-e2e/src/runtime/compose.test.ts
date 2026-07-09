import { describe, expect, test } from 'vitest';

import { runCommand } from './compose.js';

describe('runCommand', () => {
  test('terminates long-running commands after the configured timeout', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      {
        cwd: process.cwd(),
        env: stringEnv(process.env),
        stream: false,
        timeoutMs: 10,
      }
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('timed out after 10ms');
  });

  test('reports signal kills as 128 + signal number', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      {
        cwd: process.cwd(),
        env: stringEnv(process.env),
        stream: false,
        timeoutMs: 10,
      }
    );

    // SIGTERM from the timeout must surface as a signal exit (>= 128), not a
    // generic failure, so per-file runners can stop the suite on kills.
    expect(result.exitCode).toBe(143);
  });

  test('preserves ordinary nonzero exit codes', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', 'process.exit(7)'],
      {
        cwd: process.cwd(),
        env: stringEnv(process.env),
        stream: false,
      }
    );

    expect(result.exitCode).toBe(7);
  });
});

function stringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => {
      return typeof entry[1] === 'string';
    })
  );
}
