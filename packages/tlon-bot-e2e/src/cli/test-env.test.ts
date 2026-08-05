import { describe, expect, test } from 'vitest';

import type { RuntimeContext } from '../drivers/types.js';
import {
  buildCommonScenarioEnv,
  buildHermesSmokeEnv,
  buildOpenClawPackageTestEnv,
} from './test-env.js';

describe('CLI test process env builders', () => {
  test('does not pass runtime context files to package-specific runs', () => {
    const ctx = runtimeContext();

    const hermesEnv = buildHermesSmokeEnv(ctx);
    const openclawEnv = buildOpenClawPackageTestEnv(ctx);

    expect(hermesEnv.TLON_BOT_E2E_RUNTIME_CONTEXT_FILE).toBeUndefined();
    expect(openclawEnv.TLON_BOT_E2E_RUNTIME_CONTEXT_FILE).toBeUndefined();
    expect(openclawEnv.TEST_COMPOSE_FILE).toBe('compose.base.yml');
    expect(JSON.parse(openclawEnv.TEST_COMPOSE_FILES)).toEqual([
      'compose.base.yml',
      'compose.openclaw.yml',
    ]);
    expect(openclawEnv.TEST_COMPOSE_PROJECT_NAME).toBe(
      'tlon-bot-e2e-openclaw-unit'
    );
  });

  test('passes sanitized context file and non-secret metadata to common runs', () => {
    const ctx = runtimeContext();
    const env = buildCommonScenarioEnv(ctx, '/tmp/runtime-context.json', {
      key: 'baseline',
      capabilities: [],
      scenarios: [],
    });

    expect(env.TLON_BOT_E2E_RUNTIME_CONTEXT_FILE).toBe(
      '/tmp/runtime-context.json'
    );
    expect(env.TLON_MAX_CONSECUTIVE_BOT_RESPONSES).toBe('3');
    expect(env.TLON_BOT_E2E_SCENARIO_PARTITION).toBe('baseline');
  });
});

function runtimeContext(): RuntimeContext {
  return {
    driverName: 'openclaw',
    repoRoot: '/repo',
    packageDir: '/repo/packages/openclaw',
    runId: 'unit',
    composeProjectName: 'tlon-bot-e2e-openclaw-unit',
    composeFiles: ['compose.base.yml', 'compose.openclaw.yml'],
    services: {
      bot: 'openclaw',
      ships: 'ships',
      fakeModel: 'fake-model',
      logServices: ['openclaw', 'fake-model', 'ships'],
    },
    composeEnv: {
      BRAVE_API_KEY: 'brave-secret',
    },
    testEnv: {
      TLON_URL: 'http://127.0.0.1:4101',
      TEST_STORAGE_SECRET_KEY: 'storage-secret',
    },
    testMetadata: {
      tlonMaxConsecutiveBotResponses: '3',
    },
    endpoints: {
      fakeModel: {
        containerBaseUrl: 'http://fake-model:4000',
        containerOpenAiBaseUrl: 'http://fake-model:4000/v1',
        hostBaseUrl: 'http://127.0.0.1:4100',
        hostOpenAiBaseUrl: 'http://127.0.0.1:4100/v1',
        hostPort: 4100,
      },
      ships: {
        zod: shipEndpoint('~zod', 4101),
        ten: shipEndpoint('~ten', 4102),
        mug: shipEndpoint('~mug', 4103),
      },
      gateway: {
        hostBaseUrl: 'http://127.0.0.1:4104',
        hostPort: 4104,
      },
    },
    fakeModel: null,
  } as unknown as RuntimeContext;
}

function shipEndpoint(ship: string, port: number) {
  return {
    ship,
    code: 'code',
    containerUrl: 'http://ships:8080',
    hostUrl: `http://127.0.0.1:${port}`,
    hostPort: port,
  };
}
