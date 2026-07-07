import { describe, expect, test } from 'vitest';

import type { RuntimeContext } from '../drivers/types.js';
import {
  partitionKey,
  partitionScenarios,
  scenarioTimeoutMs,
  scenariosForPartition,
  selectScenarioPartitions,
  testScenario,
} from '../scenarios/shared/dsl.js';

describe('shared scenario DSL partitions', () => {
  const baseline = testScenario('baseline-case', {}, async () => {});
  const image = testScenario(
    'image-case',
    { capabilities: ['image_search'] },
    async () => {}
  );
  const uploadImage = testScenario(
    'upload-image-case',
    { capabilities: ['upload_storage', 'image_search'] },
    async () => {}
  );
  const hermesOnly = testScenario(
    'hermes-only-case',
    { drivers: ['hermes'] },
    async () => {}
  );
  const openclawImageOnly = testScenario(
    'openclaw-image-case',
    { capabilities: ['image_search'], drivers: ['openclaw'] },
    async () => {}
  );

  test('uses baseline as the empty capability partition', () => {
    expect(partitionKey([])).toBe('baseline');
    expect(partitionKey(['upload_storage', 'image_search'])).toBe(
      'image_search+upload_storage'
    );
  });

  test('groups scenarios by sorted capability set', () => {
    const partitions = partitionScenarios([uploadImage, baseline, image]);

    expect(partitions.map((partition) => partition.key)).toEqual([
      'baseline',
      'image_search',
      'image_search+upload_storage',
    ]);
  });

  test('defaults selection to baseline only', () => {
    const selected = selectScenarioPartitions([baseline, image, uploadImage]);

    expect(selected.map((partition) => partition.key)).toEqual(['baseline']);
    expect(selected[0].scenarios.map((scenario) => scenario.id)).toEqual([
      'baseline-case',
    ]);
  });

  test('filters scenarios by active partition and driver', () => {
    expect(
      scenariosForPartition([baseline, hermesOnly], 'baseline', 'openclaw').map(
        (scenario) => scenario.id
      )
    ).toEqual(['baseline-case']);
    expect(
      scenariosForPartition([baseline, hermesOnly], 'baseline', 'hermes').map(
        (scenario) => scenario.id
      )
    ).toEqual(['baseline-case', 'hermes-only-case']);
  });

  test('rejects unknown requested partitions', () => {
    expect(() =>
      selectScenarioPartitions([baseline], { requested: 'image_search' })
    ).toThrow(/Unknown scenario partition/);
  });

  test('filters driver-scoped scenarios before selecting partitions', () => {
    const selected = selectScenarioPartitions(
      [baseline, hermesOnly, openclawImageOnly],
      { requested: 'all', driverName: 'hermes' }
    );

    expect(selected.map((partition) => partition.key)).toEqual(['baseline']);
    expect(selected[0].scenarios.map((scenario) => scenario.id)).toEqual([
      'baseline-case',
      'hermes-only-case',
    ]);
  });

  test('fails fast when a requested partition has no scenarios for the driver', () => {
    expect(() =>
      selectScenarioPartitions([baseline, openclawImageOnly], {
        requested: 'image_search',
        driverName: 'hermes',
      })
    ).toThrow(/No scenarios selected for driver=hermes/);
  });

  test('preserves static and runtime-aware timeout metadata', () => {
    const ctx = {
      composeEnv: { TLON_MAX_CONSECUTIVE_BOT_RESPONSES: '3' },
    } as unknown as RuntimeContext;
    const staticTimeout = testScenario(
      'static-timeout',
      { timeoutMs: 12_000 },
      async () => {}
    );
    const runtimeTimeout = testScenario(
      'runtime-timeout',
      {
        timeoutMs: (runtimeCtx) =>
          Number(runtimeCtx.composeEnv.TLON_MAX_CONSECUTIVE_BOT_RESPONSES) *
          1_000,
      },
      async () => {}
    );

    expect(scenarioTimeoutMs(staticTimeout, ctx, 1_000)).toBe(12_000);
    expect(scenarioTimeoutMs(runtimeTimeout, ctx, 1_000)).toBe(3_000);
    expect(scenarioTimeoutMs(baseline, ctx, 1_000)).toBe(1_000);
  });
});
