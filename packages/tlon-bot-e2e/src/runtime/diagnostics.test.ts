import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { ComposeHandle, RuntimeContext } from '../drivers/types.js';
import {
  collectRuntimeDiagnostics,
  filterUploadLogLines,
  writeDiagnosticsArtifacts,
} from './diagnostics.js';
import type { DockerCommandRunner } from './docker-direct.js';

describe('collectRuntimeDiagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('includes logs, fake-model received calls, and ship readiness', async () => {
    const logs = vi.fn(async (services: string[]) =>
      services[0] === 'openclaw'
        ? 'openclaw log line\n[tlon] upload: started\nnoise\n[tlon] upload: done'
        : `${services[0]} log line`
    );
    const ps = vi.fn(async () => [
      {
        name: 'project-bot-1',
        service: 'bot',
        state: 'running',
        status: 'Up 10 seconds',
      },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        if (String(url).includes('/v1/_received')) {
          return Response.json({
            calls: [
              {
                key: 'diag-key',
                at: 1,
                model: 'tlon-test-scripted',
                stream: false,
                messageCount: 1,
                userText: '[tlon-test:diag-key] hello',
                epoch: 2,
                registeredEpoch: 2,
                stale: false,
                provenance: 'latest-user',
              },
            ],
            count: 1,
            epoch: 2,
          });
        }
        return new Response('', {
          status: 302,
          headers: { 'set-cookie': 'urbauth=test' },
        });
      })
    );

    const dockerTimeouts: number[] = [];
    const dockerRunner = vi.fn(
      async (
        _command: string,
        args: string[],
        opts: { timeoutMs?: number }
      ) => {
        dockerTimeouts.push(opts.timeoutMs ?? Number.NaN);
        if (args[0] === 'container' && args[1] === 'ls') {
          const service = args[args.length - 1].split('=').pop() ?? '';
          return {
            stdout: `${service}-container-id\n`,
            stderr: '',
            exitCode: 0,
          };
        }
        if (args[0] === 'container' && args[1] === 'inspect') {
          return {
            stdout: JSON.stringify({
              Status: 'exited',
              Running: false,
              OOMKilled: true,
              ExitCode: 137,
              StartedAt: '2026-01-01T00:00:00Z',
              FinishedAt: '2026-01-01T00:01:00Z',
            }),
            stderr: '',
            exitCode: 0,
          };
        }
        if (args[0] === 'top') {
          return {
            stdout: [
              'PID PPID COMMAND ARGS',
              '1 0 bash bash -c ./vere -t --loom 31 --http-port 8080 zod',
              '7 1 vere ./vere -t --loom 31 --http-port 8080 zod',
              '8 1 vere ./vere -t --loom 31 --http-port 8081 ten',
              '9 1 vere ./vere -t --loom 31 --http-port 8082 mug',
            ].join('\n'),
            stderr: '',
            exitCode: 0,
          };
        }
        throw new Error(`unexpected docker call: ${args.join(' ')}`);
      }
    );

    const diagnostics = await collectRuntimeDiagnostics(
      runtimeContext(),
      { ps, logs } as unknown as ComposeHandle,
      { tail: 7, dockerRunner }
    );

    expect(diagnostics).toContain('== compose services ==');
    expect(diagnostics).toContain('bot running Up 10 seconds (project-bot-1)');
    expect(diagnostics).toContain('== fake-model received calls ==');
    expect(diagnostics).toContain('"key": "diag-key"');
    expect(diagnostics).toContain('== openclaw logs ==');
    expect(diagnostics).toContain('openclaw log line');
    expect(diagnostics).toContain('== openclaw upload log lines ==');
    expect(diagnostics).toContain('[tlon] upload: started');
    expect(diagnostics).toContain('[tlon] upload: done');
    expect(diagnostics).toContain('== fake-model logs ==');
    expect(diagnostics).toContain('fake-model log line');
    expect(diagnostics).toContain('== ship readiness snapshot ==');
    expect(diagnostics).toContain('zod ~zod http://localhost:8080/~/login');
    expect(diagnostics).toContain('urbauth=true');
    expect(diagnostics).toContain('== ships logs ==');
    expect(diagnostics).toContain('ships log line');
    expect(diagnostics).toContain('== container states ==');
    expect(diagnostics).toContain('openclaw:');
    expect(diagnostics).toContain('fake-model:');
    expect(diagnostics).toContain('ships:');
    expect(diagnostics).toContain('"ExitCode": 137');
    expect(diagnostics).toContain('"OOMKilled": true');
    expect(diagnostics).toContain('== ships process table ==');
    expect(diagnostics).toContain('./vere -t --loom 31 --http-port 8080 zod');
    expect(diagnostics).toContain('./vere -t --loom 31 --http-port 8081 ten');
    expect(diagnostics).toContain('./vere -t --loom 31 --http-port 8082 mug');
    expect(ps).toHaveBeenCalledWith({ timeoutMs: 10_000 });
    expect(logs).toHaveBeenCalledWith(['openclaw'], {
      tail: 7,
      timeoutMs: 10_000,
    });
    expect(logs).toHaveBeenCalledWith(['openclaw'], {
      timeoutMs: 10_000,
      allowFailure: false,
    });
    expect(logs).toHaveBeenCalledWith(['fake-model'], {
      tail: 7,
      timeoutMs: 10_000,
    });
    expect(logs).toHaveBeenCalledWith(['ships'], {
      tail: 7,
      timeoutMs: 10_000,
    });
    expect(dockerRunner).toHaveBeenCalledWith(
      'docker',
      [
        'container',
        'ls',
        '--all',
        '--quiet',
        '--filter',
        'label=com.docker.compose.project=tlon-bot-e2e-openclaw-test',
        '--filter',
        'label=com.docker.compose.service=ships',
      ],
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(dockerRunner).toHaveBeenCalledWith(
      'docker',
      ['top', 'ships-container-id', '-eo', 'pid,ppid,comm,args'],
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(dockerTimeouts.length).toBeGreaterThan(0);
    for (const timeoutMs of dockerTimeouts) {
      expect(timeoutMs).toBeGreaterThan(0);
      expect(timeoutMs).toBeLessThanOrEqual(10_000);
    }
  });

  test('renders failed-to-collect when upload log lines call rejects', async () => {
    const logs = vi.fn(async (services: string[], opts?: { tail?: number }) => {
      if (services[0] === 'openclaw' && opts?.tail === undefined) {
        throw new Error('docker compose logs failed with exit 1');
      }
      return `${services[0]} log line`;
    });
    const ps = vi.fn(async () => []);
    // Keep the docker-direct sections off the real docker CLI.
    const dockerRunner: DockerCommandRunner = vi.fn(async () => {
      throw new Error('docker unavailable in unit tests');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        if (String(url).includes('/v1/_received')) {
          return Response.json({ calls: [], count: 0, epoch: 0 });
        }
        return new Response('', {
          status: 302,
          headers: { 'set-cookie': 'urbauth=test' },
        });
      })
    );

    const diagnostics = await collectRuntimeDiagnostics(
      runtimeContext(),
      { ps, logs } as unknown as ComposeHandle,
      { tail: 7, dockerRunner }
    );

    expect(diagnostics).toContain('== openclaw upload log lines ==');
    expect(diagnostics).toContain(
      '<failed to collect: docker compose logs failed with exit 1>'
    );
    expect(diagnostics).toContain('== openclaw logs ==');
    expect(diagnostics).toContain('openclaw log line');
    expect(diagnostics).toContain('== fake-model logs ==');
    expect(diagnostics).toContain('fake-model log line');
  });

  test('bounds hanging HTTP diagnostics with probe timeouts', async () => {
    const logs = vi.fn(async (services: string[]) => `${services[0]} log line`);
    const ps = vi.fn(async () => []);
    // Keep the docker-direct sections off the real docker CLI.
    const dockerRunner: DockerCommandRunner = vi.fn(async () => {
      throw new Error('docker unavailable in unit tests');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('probe aborted'));
            });
          })
      )
    );

    const diagnostics = await collectRuntimeDiagnostics(
      runtimeContext(),
      { ps, logs } as unknown as ComposeHandle,
      { probeTimeoutMs: 1, dockerRunner }
    );

    expect(diagnostics).toContain('== fake-model received calls ==');
    expect(diagnostics).toContain('<failed to collect: probe aborted>');
    expect(diagnostics).toContain('zod ~zod http://localhost:8080/~/login');
    expect(diagnostics).toContain('error=probe aborted');
  });

  test('container states survive one service failing to resolve', async () => {
    const logs = vi.fn(async (services: string[]) => `${services[0]} log line`);
    const ps = vi.fn(async () => []);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ calls: [], count: 0, epoch: 0 }))
    );
    const dockerRunner = vi.fn(async (_command: string, args: string[]) => {
      if (args[0] === 'container' && args[1] === 'ls') {
        const service = args[args.length - 1].split('=').pop() ?? '';
        if (service === 'fake-model') {
          return { stdout: '', stderr: 'no such container', exitCode: 1 };
        }
        return { stdout: `${service}-container-id\n`, stderr: '', exitCode: 0 };
      }
      if (args[0] === 'container' && args[1] === 'inspect') {
        return {
          stdout: JSON.stringify({
            Status: 'running',
            Running: true,
            OOMKilled: false,
            ExitCode: 0,
          }),
          stderr: '',
          exitCode: 0,
        };
      }
      if (args[0] === 'top') {
        return { stdout: 'PID PPID COMMAND\n', stderr: '', exitCode: 0 };
      }
      throw new Error(`unexpected docker call: ${args.join(' ')}`);
    });

    const diagnostics = await collectRuntimeDiagnostics(
      runtimeContext(),
      { ps, logs } as unknown as ComposeHandle,
      { dockerRunner }
    );

    expect(diagnostics).toContain('== container states ==');
    expect(diagnostics).toContain('openclaw:');
    expect(diagnostics).toContain('"Status": "running"');
    expect(diagnostics).toContain('ships:');
    expect(diagnostics).toContain(
      'fake-model: <failed to collect: docker resolve service fake-model ' +
        'failed with exit 1: no such container>'
    );
    expect(diagnostics).toContain('== ships process table ==');
    expect(diagnostics).toContain('PID PPID COMMAND');
    expect(diagnostics).toContain('== openclaw logs ==');
    expect(diagnostics).toContain('openclaw log line');
  });

  test('docker diagnostics degrade when the runner throws everywhere', async () => {
    const logs = vi.fn(async (services: string[]) => `${services[0]} log line`);
    const ps = vi.fn(async () => []);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ calls: [], count: 0, epoch: 0 }))
    );
    const dockerRunner: DockerCommandRunner = vi.fn(async () => {
      throw new Error('docker daemon unavailable');
    });

    const diagnostics = await collectRuntimeDiagnostics(
      runtimeContext(),
      { ps, logs } as unknown as ComposeHandle,
      { dockerRunner }
    );

    expect(diagnostics).toContain('== container states ==');
    expect(diagnostics).toContain(
      'openclaw: <failed to collect: docker daemon unavailable>'
    );
    expect(diagnostics).toContain(
      'fake-model: <failed to collect: docker daemon unavailable>'
    );
    expect(diagnostics).toContain(
      'ships: <failed to collect: docker daemon unavailable>'
    );
    expect(diagnostics).toContain('== ships process table ==');
    expect(diagnostics).toContain(
      '== ships process table ==\n<failed to collect: docker daemon unavailable>'
    );
    expect(diagnostics).toContain('== compose services ==');
    expect(diagnostics).toContain('== openclaw logs ==');
    expect(diagnostics).toContain('openclaw log line');
    expect(diagnostics).toContain('== ships logs ==');
    expect(diagnostics).toContain('ships log line');
  });
});

describe('filterUploadLogLines', () => {
  test('keeps only [tlon] upload lines', () => {
    const logs = [
      'booting ship',
      '[tlon] upload: started',
      'random noise',
      '[tlon] upload: done',
      'shutdown',
    ].join('\n');

    expect(filterUploadLogLines(logs)).toBe(
      '[tlon] upload: started\n[tlon] upload: done'
    );
  });

  test('truncates to the last 400 matching lines', () => {
    const matching = Array.from(
      { length: 450 },
      (_, i) => `[tlon] upload: line ${i}`
    );
    const logs = ['noise', ...matching, 'more noise'].join('\n');

    const result = filterUploadLogLines(logs);
    const lines = result.split('\n');

    expect(lines[0]).toBe(
      '<truncated: showing last 400 of 450 matching lines>'
    );
    expect(lines).toHaveLength(401);
    expect(lines[1]).toBe('[tlon] upload: line 50');
    expect(lines[400]).toBe('[tlon] upload: line 449');
  });

  test('returns empty string when no lines match', () => {
    expect(filterUploadLogLines('foo\nbar\nbaz')).toBe('');
  });
});

describe('writeDiagnosticsArtifacts', () => {
  test('writes diagnostics.txt and the full untailed ships.log', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tlon-bot-e2e-diag-'));
    try {
      const logs = vi.fn(async () => 'ships boot line\nships crash line');
      const compose = { logs } as unknown as ComposeHandle;

      const outDir = await writeDiagnosticsArtifacts(
        runtimeContext(),
        compose,
        dir,
        'the assembled dump'
      );

      expect(outDir).toBe(path.join(dir, 'test'));
      expect(await readFile(path.join(outDir, 'diagnostics.txt'), 'utf8')).toBe(
        'the assembled dump'
      );
      expect(await readFile(path.join(outDir, 'ships.log'), 'utf8')).toBe(
        'ships boot line\nships crash line'
      );
      expect(logs).toHaveBeenCalledTimes(1);
      expect(logs).toHaveBeenCalledWith(['ships'], {
        timeoutMs: 30_000,
        allowFailure: false,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('writes an error placeholder when ships logs fail', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tlon-bot-e2e-diag-'));
    try {
      const logs = vi.fn(async () => {
        throw new Error('docker compose logs ships failed with exit 1');
      });
      const compose = { logs } as unknown as ComposeHandle;

      await expect(
        writeDiagnosticsArtifacts(runtimeContext(), compose, dir, 'dump')
      ).resolves.toBe(path.join(dir, 'test'));
      expect(
        await readFile(path.join(dir, 'test', 'ships.log'), 'utf8')
      ).toContain('docker compose logs ships failed with exit 1');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function runtimeContext(): RuntimeContext {
  const ship = (label: 'zod' | 'ten' | 'mug', port: number) => ({
    ship: `~${label}`,
    code: `${label}-code`,
    containerUrl: `http://ships:${port}`,
    hostUrl: `http://localhost:${port}`,
    hostPort: port,
  });

  return {
    driverName: 'openclaw',
    repoRoot: '/repo',
    runId: 'test',
    packageDir: '/repo/packages/openclaw',
    composeProjectName: 'tlon-bot-e2e-openclaw-test',
    composeFiles: [],
    services: {
      bot: 'openclaw',
      fakeModel: 'fake-model',
      ships: 'ships',
      logServices: ['openclaw', 'fake-model', 'ships'],
    },
    composeEnv: {},
    testEnv: {},
    endpoints: {
      fakeModel: {
        containerBaseUrl: 'http://fake-model:4000',
        containerOpenAiBaseUrl: 'http://fake-model:4000/v1',
        hostBaseUrl: 'http://localhost:4000',
        hostOpenAiBaseUrl: 'http://localhost:4000/v1',
        hostPort: 4000,
      },
      ships: {
        zod: ship('zod', 8080),
        ten: ship('ten', 8081),
        mug: ship('mug', 8082),
      },
    },
    fakeModel: {},
  } as unknown as RuntimeContext;
}
