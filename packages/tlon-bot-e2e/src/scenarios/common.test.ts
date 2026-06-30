import { afterEach, beforeEach, describe, test } from 'vitest';

import { driverForName } from '../drivers/index.js';
import { runtimeContextFromEnv } from '../runtime/context.js';
import {
  createScenarioActors,
  runScenarioTeardowns,
} from './shared/actors.js';
import { commonScenarios } from './shared/common.js';
import { scenariosForPartition } from './shared/dsl.js';
import { resetBaselineIsolation } from './shared/isolation.js';

const ctx = runtimeContextFromEnv();
const driver = driverForName(ctx.driverName);
const partition = process.env.TLON_BOT_E2E_SCENARIO_PARTITION ?? 'baseline';
const scenarios = scenariosForPartition(commonScenarios, partition, ctx.driverName);

if (scenarios.length === 0) {
  throw new Error(
    `No common scenarios selected for driver=${ctx.driverName} partition=${partition}.`
  );
}

describe(`common ${ctx.driverName} scenarios (${partition})`, () => {
  let actors: ReturnType<typeof createScenarioActors>;

  beforeEach(async () => {
    actors = createScenarioActors(ctx);
    await ctx.fakeModel.reset();
    await resetBaselineIsolation(actors);
  });

  afterEach(async () => {
    await runScenarioTeardowns(actors);
  });

  for (const scenario of scenarios) {
    test(
      scenario.name,
      async () => {
        await scenario.run({ ctx, driver, actors });
      },
      180_000
    );
  }
});
