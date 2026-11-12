import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { botService, createRuntimeContext } from '../runtime/context.js';
import { allocateRuntimeEndpoints } from '../runtime/ports.js';
import { harnessDriver, harnessTlonAction } from './harness.js';
import type { RuntimeSeed } from './types.js';

describe('Harness driver runtime spec', () => {
  test('runs on the bot ship without a bot service', async () => {
    const repoRoot = path.resolve('/repo');
    const seed: RuntimeSeed = {
      driverName: 'harness',
      repoRoot,
      runId: 'unit',
      endpoints: await allocateRuntimeEndpoints({
        fakeModel: 4100,
        zod: 4101,
        ten: 4102,
        mug: 4103,
      }),
    };

    const ctx = createRuntimeContext(seed, harnessDriver.resolveRuntime(seed));

    expect(ctx.composeProjectName).toBe('tlon-bot-e2e-harness-unit');
    expect(ctx.packageDir).toBe(path.join(repoRoot, 'packages/harness'));
    expect(ctx.composeFiles).toEqual([
      path.join(
        repoRoot,
        'packages/tlon-bot-e2e/docker/docker-compose.base.yml'
      ),
    ]);
    expect(ctx.services.bot).toBeUndefined();
    expect(() => botService(ctx)).toThrow(
      'The harness driver has no bot service.'
    );
    expect(ctx.testEnv).toMatchObject({
      TLON_BOT_E2E_DRIVER: 'harness',
      TLON_URL: 'http://127.0.0.1:4101',
      TEST_USER_SHIP: '~ten',
      TEST_THIRD_PARTY_SHIP: '~mug',
      FAKE_MODEL_BASE_URL: 'http://127.0.0.1:4100',
    });
  });

  test('model adapter scripts final text and structured tlon actions', () => {
    expect(harnessDriver.model.replyText('hello')).toMatchObject({
      steps: [{ kind: 'text', content: 'hello' }],
      expectations: {
        advertisedTools: { include: ['tlon'] },
        expectedCallCount: 1,
      },
    });

    expect(
      harnessDriver.model.readOrAdmin(
        'contacts update-profile --nickname "bot name"',
        'done'
      ).steps
    ).toEqual([
      {
        kind: 'tool_call',
        name: 'tlon',
        args: { action: 'update_profile', nickname: 'bot name' },
      },
      { kind: 'text', content: 'done' },
    ]);
  });

  test('refuses what it cannot script instead of faking it', () => {
    expect(() => harnessTlonAction('version')).toThrow(
      'The tlon command "version" is not supported by the harness driver.'
    );
    expect(() => harnessDriver.model.imageSearch('cats')).toThrow(
      'imageSearch is not supported by the harness driver.'
    );
    expect(() =>
      harnessDriver.model.createCronJob({
        name: 'job',
        firedPrompt: 'prompt',
        finalText: 'done',
      })
    ).toThrow('createCronJob is not supported by the harness driver.');
  });
});
