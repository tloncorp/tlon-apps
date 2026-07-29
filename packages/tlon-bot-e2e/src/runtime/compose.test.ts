import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';

import type { ExecResult, RuntimeContext } from '../drivers/types.js';
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
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expectTimeoutInBudget(run, 0, 60_000);
  });

  test('allowFailure resolves bounded without verification', async () => {
    const run = commandRunner([{ exitCode: 1, stderr: 'nothing to remove' }]);
    const compose = createComposeHandle(context(), run);

    await expect(compose.down({ allowFailure: true })).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['down', '-v']),
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expectTimeoutInBudget(run, 0, 60_000);
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
        timeoutMs: expect.any(Number),
        env: expect.objectContaining({
          COMPOSE_PROJECT_NAME: 'tlon-bot-e2e-unit',
        }),
      })
    );
    expectTimeoutInBudget(run, 1, 60_000);
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
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expectTimeoutInBudget(run, 2, 60_000);
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

  test('verify passes strictly decreasing timeouts from a single shared deadline', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    const T0 = 1_000_000;
    const step = 10_000;
    nowSpy
      .mockReturnValueOnce(T0)
      .mockReturnValueOnce(T0 + step)
      .mockReturnValueOnce(T0 + 2 * step)
      .mockReturnValueOnce(T0 + 3 * step);
    try {
      const run = commandRunner([{}, { stdout: '' }, { stdout: '' }]);
      const compose = createComposeHandle(context(), run);

      await expect(compose.down({ verify: true })).resolves.toBeUndefined();

      expect(run).toHaveBeenCalledTimes(3);
      const timeouts = callTimeouts(run);
      expect(timeouts).toEqual([50_000, 40_000, 30_000]);
      expect(timeouts[0]).toBeGreaterThan(timeouts[1]);
      expect(timeouts[1]).toBeGreaterThan(timeouts[2]);
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('verify clamps remaining budget to 0 once the shared deadline is exceeded', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    const T0 = 1_000_000;
    nowSpy
      .mockReturnValueOnce(T0)
      .mockReturnValueOnce(T0 + 10_000)
      .mockReturnValueOnce(T0 + 30_000)
      .mockReturnValueOnce(T0 + 70_000);
    try {
      const run = commandRunner([{}, { stdout: '' }, { stdout: '' }]);
      const compose = createComposeHandle(context(), run);

      await expect(compose.down({ verify: true })).resolves.toBeUndefined();

      expect(run).toHaveBeenCalledTimes(3);
      const timeouts = callTimeouts(run);
      expect(timeouts[0]).toBe(50_000);
      expect(timeouts[1]).toBe(30_000);
      expect(timeouts[2]).toBe(0);
    } finally {
      nowSpy.mockRestore();
    }
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

function expectTimeoutInBudget(
  run: typeof runCommand,
  callIndex: number,
  max: number
): void {
  const calls = (run as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  const opts = calls[callIndex][2] as { timeoutMs: number };
  expect(opts.timeoutMs).toBeGreaterThan(0);
  expect(opts.timeoutMs).toBeLessThanOrEqual(max);
}

function callTimeouts(run: typeof runCommand): number[] {
  return (run as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
    (call) => (call[2] as { timeoutMs: number }).timeoutMs
  );
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
