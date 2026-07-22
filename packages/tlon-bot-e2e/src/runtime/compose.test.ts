import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';

import type { RuntimeContext } from '../drivers/types.js';
import { createComposeHandle, runCommand } from './compose.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: vi.fn((command: string, ...rest: unknown[]) => {
      if (command === 'docker') {
        const child = new EventEmitter() as EventEmitter & {
          stdout: PassThrough;
          stderr: PassThrough;
          kill: () => void;
        };
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
        child.kill = () => {};
        process.nextTick(() => {
          child.stderr.write('no configuration file provided');
          child.stderr.end();
          child.stdout.end();
          child.emit('close', 14, null);
        });
        return child;
      }
      return actual.spawn(command, ...(rest as [string[], object]));
    }),
  };
});

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

describe('createComposeHandle logs', () => {
  test('allowFailure defaults to true and can be set to false', async () => {
    const handle = createComposeHandle({
      composeProjectName: 'nonexistent-project',
      composeFiles: ['/tmp/invalid-compose-test.yml'],
      packageDir: '/tmp',
      composeEnv: {},
    } as unknown as RuntimeContext);

    const result = await handle.logs([]);
    expect(result).toContain('no configuration file provided');

    await expect(handle.logs([], { allowFailure: false })).rejects.toThrow(
      /failed with exit/
    );
  });
});

function stringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => {
      return typeof entry[1] === 'string';
    })
  );
}
