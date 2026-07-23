import { describe, expect, test, vi } from 'vitest';

import type { RuntimeContext } from '../drivers/types.js';
import {
  type DockerCommandRunner,
  execInComposeService,
  execInContainer,
  resolveComposeContainer,
  restartComposeService,
  startComposeService,
} from './docker-direct.js';

describe('direct Docker compose-service helpers', () => {
  test('resolves a service by compose labels', async () => {
    const run = commandRunner([{ stdout: 'container-id\n' }]);

    await expect(resolveComposeContainer(context(), 'bot', run)).resolves.toBe(
      'container-id'
    );
    expect(run).toHaveBeenCalledWith(
      'docker',
      [
        'container',
        'ls',
        '--all',
        '--quiet',
        '--filter',
        'label=com.docker.compose.project=tlon-bot-e2e-unit',
        '--filter',
        'label=com.docker.compose.service=bot',
      ],
      expect.objectContaining({ timeoutMs: 60_000 })
    );
  });

  test('rejects zero and multiple service matches', async () => {
    await expect(
      resolveComposeContainer(context(), 'bot', commandRunner([{ stdout: '' }]))
    ).rejects.toThrow(/No Docker container found/);
    await expect(
      resolveComposeContainer(
        context(),
        'bot',
        commandRunner([{ stdout: 'one\ntwo\n' }])
      )
    ).rejects.toThrow(/Expected one Docker container/);
  });

  test('stops then starts a service with a fresh running state', async () => {
    const run = commandRunner([
      { stdout: 'container-id\n' },
      {},
      { stdout: '{"Running":false,"StartedAt":"old"}' },
      { stdout: 'container-id\n' },
      { stdout: '{"Running":false,"StartedAt":"old"}' },
      {},
      { stdout: '{"Running":true,"StartedAt":"new"}' },
    ]);

    await expect(
      restartComposeService(context(), 'bot', run)
    ).resolves.toBeUndefined();
  });

  test('does not start a service that is already running', async () => {
    const run = commandRunner([
      { stdout: 'container-id\n' },
      { stdout: '{"Running":true,"StartedAt":"already-running"}' },
    ]);

    await expect(
      startComposeService(context(), 'bot', run)
    ).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('returns nonzero docker exec results to callers', async () => {
    const run = commandRunner([
      { stdout: 'container-id\n' },
      { stdout: '', stderr: 'cron failed', exitCode: 17 },
    ]);

    await expect(
      execInComposeService(
        context(),
        'bot',
        ['hermes', 'cron', 'create'],
        {},
        run
      )
    ).resolves.toMatchObject({ exitCode: 17, stderr: 'cron failed' });
  });

  test('uses one timeout budget for container resolution and exec', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const run: DockerCommandRunner = vi.fn(async (_command, args, opts) => {
      if (args[0] === 'container') {
        expect(opts.timeoutMs).toBe(50);
        vi.setSystemTime(40);
        return { stdout: 'container-id\n', stderr: '', exitCode: 0 };
      }
      expect(opts.timeoutMs).toBe(10);
      vi.setSystemTime(50);
      throw new Error('docker exec timed out after its remaining 10ms budget');
    });

    await expect(
      execInComposeService(
        context(),
        'bot',
        ['echo', 'cron'],
        { timeoutMs: 50 },
        run
      )
    ).rejects.toThrow(/remaining 10ms budget/);
    expect(run).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  test('executes in a pre-resolved container without another lookup', async () => {
    const run = commandRunner([{ stdout: 'ok' }]);

    await expect(
      execInContainer(context(), 'known-container', ['echo', 'cron'], {}, run)
    ).resolves.toMatchObject({ stdout: 'ok' });
    expect(run).toHaveBeenCalledWith(
      'docker',
      ['exec', 'known-container', 'echo', 'cron'],
      expect.objectContaining({ timeoutMs: 60_000 })
    );
    expect(run).toHaveBeenCalledTimes(1);
  });
});

function commandRunner(
  results: Array<Partial<{ stdout: string; stderr: string; exitCode: number }>>
): DockerCommandRunner {
  return vi.fn(async () => {
    const next = results.shift();
    if (!next) {
      throw new Error('Unexpected Docker command.');
    }
    return { stdout: '', stderr: '', exitCode: 0, ...next };
  });
}

function context(): RuntimeContext {
  return {
    packageDir: '/repo/packages/tlon-bot-e2e',
    composeProjectName: 'tlon-bot-e2e-unit',
    composeEnv: {},
  } as RuntimeContext;
}
