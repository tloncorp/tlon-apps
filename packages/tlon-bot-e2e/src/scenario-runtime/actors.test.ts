import { describe, expect, test } from 'vitest';

import type { RuntimeContext, ShipEndpoint } from '../drivers/types.js';
import {
  createScenarioActors,
  runScenarioTeardowns,
} from '../scenarios/shared/actors.js';

describe('scenario actor teardowns', () => {
  test('suppresses known transient timeout only for idempotent group deletion', async () => {
    const actors = createScenarioActors(runtimeContext());
    actors.owner.teardown(
      async () => {
        throw new Error('TimeoutError: active');
      },
      { kind: 'idempotent-group-delete', label: 'delete test group' }
    );

    await expect(runScenarioTeardowns(actors)).resolves.toBeUndefined();
  });

  test('does not suppress benign-looking timeout from settings rollback', async () => {
    const actors = createScenarioActors(runtimeContext());
    actors.bot.teardown(
      async () => {
        throw new Error('TimeoutError: reconnected');
      },
      { kind: 'settings-rollback', label: 'restore setting ownerListenEnabled' }
    );

    await expect(runScenarioTeardowns(actors)).rejects.toThrow(
      /restore setting ownerListenEnabled: TimeoutError: reconnected/
    );
  });

  test('does not suppress non-benign group deletion failures', async () => {
    const actors = createScenarioActors(runtimeContext());
    actors.owner.teardown(
      async () => {
        throw new Error('permission denied');
      },
      { kind: 'idempotent-group-delete', label: 'delete test group' }
    );

    await expect(runScenarioTeardowns(actors)).rejects.toThrow(
      /delete test group: permission denied/
    );
  });
});

function runtimeContext(): RuntimeContext {
  return {
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
    },
  } as unknown as RuntimeContext;
}

function shipEndpoint(ship: string, port: number): ShipEndpoint {
  return {
    ship,
    code: 'code',
    containerUrl: 'http://ships:8080',
    hostUrl: `http://127.0.0.1:${port}`,
    hostPort: port,
  };
}
