import { describe, expect, test, vi } from 'vitest';

import type { RuntimeContext } from '../drivers/types.js';
import {
  type DockerCommandRunner,
  connectComposeNetwork,
  disconnectComposeNetwork,
  execInComposeService,
  readComposeServiceLogs,
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

  test('disconnects a service from the compose network', async () => {
    const run = commandRunner([{ stdout: 'container-id\n' }, {}]);

    await expect(
      disconnectComposeNetwork(context(), 'bot', run)
    ).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledWith(
      'docker',
      ['network', 'disconnect', 'tlon-bot-e2e-unit_default', 'container-id'],
      expect.objectContaining({ timeoutMs: 60_000 })
    );
  });

  test('connects a service to the compose network', async () => {
    const run = commandRunner([{ stdout: 'container-id\n' }, {}]);

    await expect(
      connectComposeNetwork(context(), 'bot', run)
    ).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledWith(
      'docker',
      ['network', 'connect', 'tlon-bot-e2e-unit_default', 'container-id'],
      expect.objectContaining({ timeoutMs: 60_000 })
    );
  });

  test('reads service logs combining stdout and stderr with --since', async () => {
    const run = commandRunner([
      { stdout: 'container-id\n' },
      { stdout: 'line1\n', stderr: 'line2\n' },
    ]);

    const logs = await readComposeServiceLogs(
      context(),
      'bot',
      { since: '2026-07-21T00:00:00.000Z' },
      run
    );
    expect(logs).toBe('line1\n\nline2\n');
    expect(run).toHaveBeenCalledWith(
      'docker',
      ['logs', '--since', '2026-07-21T00:00:00.000Z', 'container-id'],
      expect.objectContaining({ timeoutMs: 60_000 })
    );
  });

  test('readComposeServiceLogs fails loudly on nonzero exit', async () => {
    const run = commandRunner([
      { stdout: 'container-id\n' },
      { stdout: '', stderr: 'no such container', exitCode: 1 },
    ]);

    await expect(
      readComposeServiceLogs(
        context(),
        'bot',
        { since: '2026-07-21T00:00:00.000Z' },
        run
      )
    ).rejects.toThrow(/read logs for service bot failed/);
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
