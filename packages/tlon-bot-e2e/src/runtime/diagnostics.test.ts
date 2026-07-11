import { afterEach, describe, expect, test, vi } from 'vitest';

import type { ComposeHandle, RuntimeContext } from '../drivers/types.js';
import { collectRuntimeDiagnostics } from './diagnostics.js';

describe('collectRuntimeDiagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('includes logs, fake-model received calls, and ship readiness', async () => {
    const logs = vi.fn(async (services: string[]) => `${services[0]} log line`);
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

    const diagnostics = await collectRuntimeDiagnostics(
      runtimeContext(),
      { ps, logs } as unknown as ComposeHandle,
      { tail: 7 }
    );

    expect(diagnostics).toContain('== compose services ==');
    expect(diagnostics).toContain('bot running Up 10 seconds (project-bot-1)');
    expect(diagnostics).toContain('== fake-model received calls ==');
    expect(diagnostics).toContain('"key": "diag-key"');
    expect(diagnostics).toContain('== openclaw logs ==');
    expect(diagnostics).toContain('openclaw log line');
    expect(diagnostics).toContain('== fake-model logs ==');
    expect(diagnostics).toContain('fake-model log line');
    expect(diagnostics).toContain('== ship readiness snapshot ==');
    expect(diagnostics).toContain('zod ~zod http://localhost:8080/~/login');
    expect(diagnostics).toContain('urbauth=true');
    expect(diagnostics).toContain('== ships logs ==');
    expect(diagnostics).toContain('ships log line');
    expect(ps).toHaveBeenCalledWith({ timeoutMs: 10_000 });
    expect(logs).toHaveBeenCalledWith(['openclaw'], {
      tail: 7,
      timeoutMs: 10_000,
    });
    expect(logs).toHaveBeenCalledWith(['fake-model'], {
      tail: 7,
      timeoutMs: 10_000,
    });
    expect(logs).toHaveBeenCalledWith(['ships'], {
      tail: 7,
      timeoutMs: 10_000,
    });
  });

  test('bounds hanging HTTP diagnostics with probe timeouts', async () => {
    const logs = vi.fn(async (services: string[]) => `${services[0]} log line`);
    const ps = vi.fn(async () => []);
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
      { probeTimeoutMs: 1 }
    );

    expect(diagnostics).toContain('== fake-model received calls ==');
    expect(diagnostics).toContain('<failed to collect: probe aborted>');
    expect(diagnostics).toContain('zod ~zod http://localhost:8080/~/login');
    expect(diagnostics).toContain('error=probe aborted');
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
