import { describe, expect, test, vi } from 'vitest';

import type { ExecResult, RuntimeContext } from '../drivers/types.js';
import { createComposeHandle, runCommand } from './compose.js';

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

describe('createComposeHandle down', () => {
  test('default strict teardown runs `down -v` bounded and rejects on nonzero', async () => {
    const run = commandRunner([{ exitCode: 1, stderr: 'network gone' }]);
    const compose = createComposeHandle(context(), run);

    const error = await captureError(compose.down());

    expect(error.message).toContain('tlon-bot-e2e-unit');
    expect(error.message).toContain('exit 1');
    expect(error.message).toContain('network gone');
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      'docker',
      [
        'compose',
        '-f',
        '/repo/packages/tlon-bot-e2e/docker-compose.yml',
        'down',
        '-v',
      ],
      expect.objectContaining({ timeoutMs: 60_000 })
    );
  });

  test('allowFailure resolves bounded without verification', async () => {
    const run = commandRunner([{ exitCode: 1, stderr: 'nothing to remove' }]);
    const compose = createComposeHandle(context(), run);

    await expect(compose.down({ allowFailure: true })).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['down', '-v']),
      expect.objectContaining({ timeoutMs: 60_000 })
    );
  });

  test('verify issues label-filtered listing commands and resolves when empty', async () => {
    const run = commandRunner([{}, { stdout: '' }, { stdout: '' }]);
    const compose = createComposeHandle(context(), run);

    await expect(compose.down({ verify: true })).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(3);
    expect(run).toHaveBeenNthCalledWith(
      2,
      'docker',
      [
        'ps',
        '-a',
        '--filter',
        'label=com.docker.compose.project=tlon-bot-e2e-unit',
        '--format',
        '{{.ID}}\\t{{.Names}}',
      ],
      expect.objectContaining({
        timeoutMs: 60_000,
        env: expect.objectContaining({
          COMPOSE_PROJECT_NAME: 'tlon-bot-e2e-unit',
        }),
      })
    );
    expect(run).toHaveBeenNthCalledWith(
      3,
      'docker',
      [
        'volume',
        'ls',
        '--filter',
        'label=com.docker.compose.project=tlon-bot-e2e-unit',
        '--format',
        '{{.Name}}',
      ],
      expect.objectContaining({ timeoutMs: 60_000 })
    );
  });

  test('verify reports leaks and a failed down, attempting both listings', async () => {
    const run = commandRunner([
      { exitCode: 1, stderr: 'down broke' },
      { stdout: 'abc123\tbot-1\n' },
      { stdout: 'tlon-bot-e2e-unit_data\n' },
    ]);
    const compose = createComposeHandle(context(), run);

    const error = await captureError(compose.down({ verify: true }));

    expect(error.message).toContain('tlon-bot-e2e-unit');
    expect(error.message).toContain('exit 1');
    expect(error.message).toContain('down broke');
    expect(error.message).toContain('abc123');
    expect(error.message).toContain('bot-1');
    expect(error.message).toContain('tlon-bot-e2e-unit_data');
    expect(run).toHaveBeenCalledTimes(3);
  });

  test('verify rejects on a nonzero listing even without leak output', async () => {
    const run = commandRunner([
      {},
      { exitCode: 1, stderr: 'docker ps failed' },
      { stdout: '' },
    ]);
    const compose = createComposeHandle(context(), run);

    const error = await captureError(compose.down({ verify: true }));

    expect(error.message).toContain('tlon-bot-e2e-unit');
    expect(error.message).toContain('docker ps failed');
    expect(run).toHaveBeenCalledTimes(3);
  });
});

function commandRunner(results: Array<Partial<ExecResult>>): typeof runCommand {
  return vi.fn(async () => {
    const next = results.shift();
    if (!next) {
      throw new Error('Unexpected command.');
    }
    return { stdout: '', stderr: '', exitCode: 0, ...next };
  });
}

function context(): RuntimeContext {
  return {
    packageDir: '/repo/packages/tlon-bot-e2e',
    composeProjectName: 'tlon-bot-e2e-unit',
    composeFiles: ['/repo/packages/tlon-bot-e2e/docker-compose.yml'],
    composeEnv: {},
  } as RuntimeContext;
}

async function captureError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
  throw new Error('Expected the promise to reject.');
}

function stringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => {
      return typeof entry[1] === 'string';
    })
  );
}
