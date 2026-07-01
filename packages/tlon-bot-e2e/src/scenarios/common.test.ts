import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { driverForName } from '../drivers/index.js';
import { runtimeContextFromEnv } from '../runtime/context.js';
import { createScenarioActors, runScenarioTeardowns } from './shared/actors.js';
import { commonScenarios } from './shared/common.js';
import { scenarioTimeoutMs, scenariosForPartition } from './shared/dsl.js';
import { resetBaselineIsolation } from './shared/isolation.js';

const ctx = runtimeContextFromEnv();
const driver = driverForName(ctx.driverName);
const partition = process.env.TLON_BOT_E2E_SCENARIO_PARTITION ?? 'baseline';
const scenarios = scenariosForPartition(
  commonScenarios,
  partition,
  ctx.driverName
);
const DEFAULT_SCENARIO_TIMEOUT_MS = 180_000;
let activeScenario:
  | {
      id: string;
      timeoutMs: number;
      startedAt: number;
    }
  | undefined;

if (scenarios.length === 0) {
  throw new Error(
    `No common scenarios selected for driver=${ctx.driverName} partition=${partition}.`
  );
}

describe(`common ${ctx.driverName} scenarios (${partition})`, () => {
  let actors: ReturnType<typeof createScenarioActors>;

  beforeEach(async () => {
    const testName = expect.getState().currentTestName ?? '<unknown scenario>';
    const scenario = scenarioForTestName(testName);
    activeScenario = {
      id: scenario?.id ?? testName,
      timeoutMs: scenario
        ? scenarioTimeoutMs(scenario, ctx, DEFAULT_SCENARIO_TIMEOUT_MS)
        : DEFAULT_SCENARIO_TIMEOUT_MS,
      startedAt: Date.now(),
    };
    logProgress(
      `start ${activeScenario.id} timeout=${formatDuration(
        activeScenario.timeoutMs
      )}`
    );
    actors = createScenarioActors(ctx);
    await ctx.fakeModel.reset();
    await resetBaselineIsolation(actors);
  });

  afterEach(async () => {
    const scenario = activeScenario;
    try {
      await runScenarioTeardowns(actors);
    } finally {
      if (scenario) {
        logProgress(
          `done ${scenario.id} elapsed=${formatDuration(
            Date.now() - scenario.startedAt
          )}`
        );
      }
      activeScenario = undefined;
    }
  });

  for (const scenario of scenarios) {
    const timeoutMs = scenarioTimeoutMs(
      scenario,
      ctx,
      DEFAULT_SCENARIO_TIMEOUT_MS
    );
    test(
      scenario.name,
      async () => {
        await scenario.run({ ctx, driver, actors });
      },
      timeoutMs
    );
  }
});

logProgress(
  `selected driver=${ctx.driverName} partition=${partition} count=${
    scenarios.length
  } scenarios=${scenarios.map((scenario) => scenario.id).join(',')}`
);

function scenarioForTestName(testName: string) {
  return scenarios.find((scenario) => testName.endsWith(scenario.name));
}

function logProgress(message: string): void {
  process.stdout.write(`[tlon-bot-e2e] ${message}\n`);
}

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  return `${(ms / 1_000).toFixed(1)}s`;
}
