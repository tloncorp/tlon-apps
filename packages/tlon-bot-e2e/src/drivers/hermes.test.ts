import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { createRuntimeContext } from '../runtime/context.js';
import { allocateRuntimeEndpoints } from '../runtime/ports.js';
import { hermesDriver } from './hermes.js';
import type { RuntimeSeed } from './types.js';

describe('Hermes driver runtime spec', () => {
  test('resolves M2 compose/env contract from an immutable seed', async () => {
    const repoRoot = path.resolve('/repo');
    const seed: RuntimeSeed = {
      driverName: 'hermes',
      repoRoot,
      runId: 'unit',
      endpoints: await allocateRuntimeEndpoints({
        fakeModel: 4100,
        zod: 4101,
        ten: 4102,
        mug: 4103,
      }),
    };

    const ctx = createRuntimeContext(seed, hermesDriver.resolveRuntime(seed));

    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.endpoints.ships.zod)).toBe(true);
    expect(ctx.composeProjectName).toBe('tlon-bot-e2e-hermes-unit');
    expect(ctx.composeFiles).toEqual([
      path.join(
        repoRoot,
        'packages/tlon-bot-e2e/docker/docker-compose.base.yml'
      ),
      path.join(
        repoRoot,
        'packages/tlon-bot-e2e/docker/docker-compose.hermes.yml'
      ),
    ]);
    expect(ctx.services).toMatchObject({
      bot: 'hermes-tlon',
      ships: 'ships',
      fakeModel: 'fake-model',
    });
    expect(ctx.composeEnv).toMatchObject({
      TLON_NODE_URL: 'http://ships:8080',
      TLON_NODE_ID: '~zod',
      TLON_ACCESS_CODE: 'lidlut-tabwed-pillex-ridrup',
      TLON_OWNER_SHIP: '~ten',
      HERMES_MODEL_BASE_URL: 'http://fake-model:4000/v1',
      HERMES_MODEL_API_MODE: 'chat_completions',
      TLON_GATEWAY_STATUS: 'false',
      TLON_TELEMETRY: 'false',
      TLON_SSE_READ_TIMEOUT_SECONDS: '60',
      TLON_KNOWN_BOT_USERS: '~mug',
      TLON_MAX_CONSECUTIVE_BOT_RESPONSES: '3',
    });
    expect(ctx.testEnv).toMatchObject({
      TLON_URL: 'http://127.0.0.1:4101',
      TEST_USER_SHIP: '~ten',
      TEST_THIRD_PARTY_SHIP: '~mug',
      FAKE_MODEL_BASE_URL: 'http://127.0.0.1:4100',
    });
  });

  test('model adapter returns script objects with baseline tool expectations', () => {
    expect(hermesDriver.model.replyText('hello')).toMatchObject({
      steps: [{ kind: 'text', content: 'hello' }],
      options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 1,
      },
    });

    expect(hermesDriver.model.readOrAdmin('version', 'done')).toMatchObject({
      steps: [
        { kind: 'tool_call', name: 'tlon', args: { command: 'version' } },
        { kind: 'text', content: 'done' },
      ],
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 2,
        expectedCallSequence: [
          { kind: 'model_request' },
          { kind: 'tool_call', toolName: 'tlon' },
          { kind: 'model_request' },
          { kind: 'final_model_text' },
        ],
        streamedToolLoop: true,
      },
    });

    expect(
      hermesDriver.model.sendMessage({ target: '~ten', message: 'hello' })
    ).toMatchObject({
      options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 1,
      },
    });

    expect(hermesDriver.model.replyTexts(['one', 'two'])).toMatchObject({
      steps: [
        { kind: 'text', content: 'one' },
        { kind: 'text', content: 'two' },
      ],
      options: { allowedAuxiliaryCalls: ['hermes_title_generation'] },
      expectations: { expectedCallCount: 2 },
    });

    expect(
      hermesDriver.model.createCronJob({
        name: 'scheduled-job',
        firedPrompt: '[tlon-test:fired] Reply with the marker.',
        finalText: 'Scheduled.',
      })
    ).toMatchObject({
      steps: [
        {
          kind: 'tool_call',
          name: 'cronjob',
          args: {
            action: 'create',
            name: 'scheduled-job',
            schedule: '1m',
            prompt: '[tlon-test:fired] Reply with the marker.',
            deliver: 'origin',
          },
        },
        { kind: 'text', content: 'Scheduled.' },
      ],
      expectations: {
        advertisedTools: { include: ['cronjob', 'tlon'] },
        expectedCallCount: 2,
      },
    });
    expect(hermesDriver.model.looseReplyText('loose')).toMatchObject({
      steps: [{ kind: 'text', content: 'loose' }],
      expectations: { expectedCallCount: 1 },
    });
  });

  test('enables cronjob only for the cron capability partition', async () => {
    const endpoints = await allocateRuntimeEndpoints({
      fakeModel: 4200,
      zod: 4201,
      ten: 4202,
      mug: 4203,
    });
    const base = {
      driverName: 'hermes' as const,
      repoRoot: path.resolve('/repo'),
      runId: 'cron-unit',
      endpoints,
    };

    expect(
      hermesDriver.resolveRuntime({
        ...base,
        capabilityPartition: { key: 'cron', capabilities: ['cron'] },
      }).composeEnv.HERMES_E2E_ENABLE_CRONJOB
    ).toBe('1');
    expect(
      hermesDriver.resolveRuntime({
        ...base,
        capabilityPartition: { key: 'baseline', capabilities: [] },
      }).composeEnv.HERMES_E2E_ENABLE_CRONJOB
    ).toBe('0');
    expect(
      hermesDriver.resolveRuntime(base).composeEnv.HERMES_E2E_ENABLE_CRONJOB
    ).toBe('0');
  });
});
