import path from 'node:path';

import { describe, expect, test } from 'vitest';

import type { DriverRuntimeSpec, RuntimeSeed } from '../drivers/types.js';
import { allocateRuntimeEndpoints } from './ports.js';
import {
  createRuntimeContext,
  runtimeContextForJson,
  runtimeContextFromJson,
} from './context.js';

describe('runtime context serialization', () => {
  test('omits compose and test env secrets from JSON by default', async () => {
    const repoRoot = path.resolve('/repo');
    const seed: RuntimeSeed = {
      driverName: 'openclaw',
      repoRoot,
      runId: 'unit',
      endpoints: await allocateRuntimeEndpoints({
        fakeModel: 4100,
        zod: 4101,
        ten: 4102,
        mug: 4103,
        gateway: 4104,
      }),
    };
    const spec: DriverRuntimeSpec = {
      packageDir: path.join(repoRoot, 'packages/openclaw'),
      composeProjectName: 'tlon-bot-e2e-openclaw-unit',
      composeFiles: ['docker-compose.base.yml', 'docker-compose.openclaw.yml'],
      services: {
        bot: 'openclaw',
        ships: 'ships',
        fakeModel: 'fake-model',
        logServices: ['openclaw', 'fake-model', 'ships'],
      },
      composeEnv: {
        BRAVE_API_KEY: 'brave-secret',
        TLONBOT_TOKEN: 'tlonbot-secret',
        TLON_MAX_CONSECUTIVE_BOT_RESPONSES: '3',
      },
      testEnv: {
        TEST_STORAGE_SECRET_KEY: 'storage-secret',
        TEST_STORAGE_ACCESS_KEY: 'storage-access',
        TLON_CODE: 'ship-code',
      },
    };

    const ctx = createRuntimeContext(seed, spec);
    const serialized = runtimeContextForJson(ctx);
    const json = JSON.stringify(serialized);

    expect(json).not.toContain('BRAVE_API_KEY');
    expect(json).not.toContain('brave-secret');
    expect(json).not.toContain('TLONBOT_TOKEN');
    expect(json).not.toContain('tlonbot-secret');
    expect(json).not.toContain('TEST_STORAGE_SECRET_KEY');
    expect(json).not.toContain('storage-secret');
    expect(json).not.toContain('TEST_STORAGE_ACCESS_KEY');
    expect(json).not.toContain('storage-access');
    expect(serialized).toMatchObject({
      driverName: 'openclaw',
      composeProjectName: 'tlon-bot-e2e-openclaw-unit',
      testMetadata: { tlonMaxConsecutiveBotResponses: '3' },
    });

    const hydrated = runtimeContextFromJson(serialized);
    expect(hydrated.composeEnv).toEqual({});
    expect(hydrated.testEnv).toEqual({});
    expect(hydrated.testMetadata?.tlonMaxConsecutiveBotResponses).toBe('3');
    expect(Object.isFrozen(hydrated)).toBe(true);
  });
});
