import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { createRuntimeContext } from '../runtime/context.js';
import { allocateRuntimeEndpoints } from '../runtime/ports.js';
import { openclawDriver } from './openclaw.js';
import type { RuntimeSeed } from './types.js';

const OPTIONAL_ENV_KEYS = [
  'BRAVE_API_KEY',
  'TLONBOT_TOKEN',
  'TEST_STORAGE_ENDPOINT',
  'TEST_STORAGE_BUCKET',
  'TEST_STORAGE_ACCESS_KEY',
  'TEST_STORAGE_SECRET_KEY',
  'TEST_STORAGE_REGION',
  'TEST_LIVE_TOOL_TRACE',
  'TEST_LIVE_TOOL_TRACE_CONTENTS',
  'CI_LIVE_TOOL_TRACE',
  'CI_LIVE_TOOL_TRACE_CONTENTS',
  'FAKE_SHIP_CACHE_DIR',
  'TLONBOT_DIR',
  'VERBOSE',
] as const;

const savedEnv = new Map<string, string | undefined>();

describe('OpenClaw driver runtime spec', () => {
  afterEach(() => {
    restoreEnv();
  });

  test('resolves shared compose runtime without ambient optional inputs', async () => {
    clearOptionalEnv();
    const repoRoot = path.resolve('/repo');
    const seed = await createSeed(repoRoot);
    const ctx = createRuntimeContext(seed, openclawDriver.resolveRuntime(seed));

    expect(Object.isFrozen(ctx)).toBe(true);
    expect(ctx.composeProjectName).toBe('tlon-bot-e2e-openclaw-unit');
    expect(ctx.composeFiles).toEqual([
      path.join(repoRoot, 'packages/tlon-bot-e2e/docker/docker-compose.base.yml'),
      path.join(
        repoRoot,
        'packages/tlon-bot-e2e/docker/docker-compose.openclaw.yml'
      ),
    ]);
    expect(ctx.services).toMatchObject({
      bot: 'openclaw',
      ships: 'ships',
      fakeModel: 'fake-model',
    });
    expect(ctx.composeEnv).toMatchObject({
      OPENCLAW_DIR: path.join(repoRoot, 'packages/openclaw'),
      OPENCLAW_GATEWAY_PORT: '4104',
      TLON_URL: 'http://ships:8080',
      TLON_SHIP: '~zod',
      TLON_CODE: 'lidlut-tabwed-pillex-ridrup',
      TLON_OWNER_SHIP: '~ten',
      TLON_DM_ALLOWLIST: '~ten',
      FAKE_MODEL_BASE_URL: 'http://fake-model:4000/v1',
      MODEL: 'custom-proxy/tlon-test-scripted',
      OPENCLAW_TEST_TOOLS_ALLOW_JSON: JSON.stringify([
        'web_fetch',
        'web_search',
        'image_search',
        'read',
        'cron',
        'tlon',
        'message',
      ]),
      TLON_NUDGE_TICK_INTERVAL_MS: '5000',
    });
    expect(ctx.composeEnv.BRAVE_API_KEY).toBeUndefined();
    expect(ctx.composeEnv.TLONBOT_TOKEN).toBeUndefined();
    expect(ctx.testEnv).toMatchObject({
      TLON_URL: 'http://127.0.0.1:4101',
      TEST_USER_SHIP: '~ten',
      TEST_THIRD_PARTY_SHIP: '~mug',
      TEST_GATEWAY_URL: 'http://127.0.0.1:4104',
      FAKE_MODEL_BASE_URL: 'http://127.0.0.1:4100',
    });
    expect(ctx.testEnv.TEST_STORAGE_BUCKET).toBeUndefined();
  });

  test('passes only explicit optional OpenClaw coverage inputs', async () => {
    clearOptionalEnv();
    setEnv('BRAVE_API_KEY', 'brave-test');
    setEnv('TLONBOT_TOKEN', 'github-test');
    setEnv('TEST_STORAGE_BUCKET', 'bucket-test');
    setEnv('TEST_STORAGE_ENDPOINT', 'https://storage.example');
    setEnv('TEST_STORAGE_ACCESS_KEY', 'access-test');
    setEnv('TEST_STORAGE_SECRET_KEY', 'secret-test');
    setEnv('TEST_STORAGE_REGION', 'auto');
    setEnv('TEST_LIVE_TOOL_TRACE', '1');
    setEnv('TEST_LIVE_TOOL_TRACE_CONTENTS', '1');

    const seed = await createSeed(path.resolve('/repo'));
    const ctx = createRuntimeContext(seed, openclawDriver.resolveRuntime(seed));

    expect(ctx.composeEnv).toMatchObject({
      BRAVE_API_KEY: 'brave-test',
      TLONBOT_TOKEN: 'github-test',
      TEST_LIVE_TOOL_TRACE: '1',
      TEST_LIVE_TOOL_TRACE_CONTENTS: '1',
    });
    expect(ctx.testEnv).toMatchObject({
      BRAVE_API_KEY: 'brave-test',
      TLONBOT_TOKEN: 'github-test',
      TEST_STORAGE_BUCKET: 'bucket-test',
      TEST_STORAGE_ENDPOINT: 'https://storage.example',
      TEST_STORAGE_ACCESS_KEY: 'access-test',
      TEST_STORAGE_SECRET_KEY: 'secret-test',
      TEST_STORAGE_REGION: 'auto',
      TEST_LIVE_TOOL_TRACE: '1',
      TEST_LIVE_TOOL_TRACE_CONTENTS: '1',
    });
  });

  test('suppresses optional external inputs for baseline common partitions', async () => {
    clearOptionalEnv();
    setEnv('BRAVE_API_KEY', 'brave-test');
    setEnv('TLONBOT_TOKEN', 'github-test');
    setEnv('TEST_STORAGE_BUCKET', 'bucket-test');
    setEnv('TEST_STORAGE_ENDPOINT', 'https://storage.example');

    const seed = await createSeed(path.resolve('/repo'));
    seed.capabilityPartition = { key: 'baseline', capabilities: [] };
    const ctx = createRuntimeContext(seed, openclawDriver.resolveRuntime(seed));

    expect(JSON.parse(ctx.composeEnv.OPENCLAW_TEST_TOOLS_ALLOW_JSON)).toEqual([
      'tlon',
      'message',
    ]);
    expect(ctx.composeEnv.BRAVE_API_KEY).toBeUndefined();
    expect(ctx.composeEnv.TLONBOT_TOKEN).toBeUndefined();
    expect(ctx.testEnv.TEST_STORAGE_BUCKET).toBeUndefined();
    expect(ctx.testEnv.TEST_STORAGE_ENDPOINT).toBeUndefined();
  });

  test('adds capability tools only for matching common partitions', async () => {
    clearOptionalEnv();
    setEnv('BRAVE_API_KEY', 'brave-test');

    const seed = await createSeed(path.resolve('/repo'));
    seed.capabilityPartition = {
      key: 'image_search',
      capabilities: ['image_search'],
    };
    const ctx = createRuntimeContext(seed, openclawDriver.resolveRuntime(seed));

    expect(JSON.parse(ctx.composeEnv.OPENCLAW_TEST_TOOLS_ALLOW_JSON)).toEqual([
      'tlon',
      'message',
      'image_search',
    ]);
    expect(ctx.composeEnv.BRAVE_API_KEY).toBe('brave-test');
  });

  test('model adapter returns script objects with options and expectations', () => {
    expect(
      openclawDriver.model.sendMessage({
        target: '~ten',
        message: 'hello',
      })
    ).toMatchObject({
      steps: [
        {
          kind: 'tool_call',
          name: 'message',
          args: { action: 'send', target: '~ten', message: 'hello' },
        },
        { kind: 'text', content: 'Done' },
      ],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['message', 'tlon'] },
        expectedCallCount: 2,
      },
    });

    expect(openclawDriver.model.readOrAdmin('version', 'done')).toMatchObject({
      steps: [
        { kind: 'tool_call', name: 'tlon', args: { command: 'version' } },
        { kind: 'text', content: 'done' },
      ],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['message', 'tlon'] },
        expectedCallCount: 2,
      },
    });

    expect(openclawDriver.model.imageSearch('cats')).toMatchObject({
      expectations: {
        advertisedTools: { include: ['image_search'] },
        expectedCallCount: 1,
      },
    });
  });
});

async function createSeed(repoRoot: string): Promise<RuntimeSeed> {
  return {
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
}

function clearOptionalEnv(): void {
  for (const key of OPTIONAL_ENV_KEYS) {
    setEnv(key, undefined);
  }
}

function setEnv(key: string, value: string | undefined): void {
  if (!savedEnv.has(key)) {
    savedEnv.set(key, process.env[key]);
  }
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function restoreEnv(): void {
  for (const [key, value] of savedEnv) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  savedEnv.clear();
}
