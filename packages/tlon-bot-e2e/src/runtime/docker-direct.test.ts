import { describe, expect, test, vi } from 'vitest';

import type { RuntimeContext } from '../drivers/types.js';
import {
  type DockerCommandRunner,
  execInComposeService,
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
