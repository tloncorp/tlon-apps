import type { RuntimeContext } from '../drivers/types.js';
import { buildComposeProcessEnv } from '../runtime/env.js';
import type { ScenarioPartition } from '../scenarios/shared/dsl.js';

export function buildHermesSmokeEnv(
  ctx: RuntimeContext
): Record<string, string> {
  return buildComposeProcessEnv({
    projectName: ctx.composeProjectName,
    explicitEnv: {
      ...ctx.testEnv,
    },
  });
}

export function buildCommonScenarioEnv(
  ctx: RuntimeContext,
  contextFile: string,
  partition: ScenarioPartition
): Record<string, string> {
  return buildComposeProcessEnv({
    projectName: ctx.composeProjectName,
    explicitEnv: {
      ...ctx.testEnv,
      TLON_BOT_E2E_RUNTIME_CONTEXT_FILE: contextFile,
      TLON_BOT_E2E_SCENARIO_PARTITION: partition.key,
      TLON_BOT_E2E_SCENARIO_CAPABILITIES: JSON.stringify(
        partition.capabilities
      ),
      ...(ctx.testMetadata?.tlonMaxConsecutiveBotResponses
        ? {
            TLON_MAX_CONSECUTIVE_BOT_RESPONSES:
              ctx.testMetadata.tlonMaxConsecutiveBotResponses,
          }
        : {}),
    },
  });
}

export function buildOpenClawPackageTestEnv(
  ctx: RuntimeContext
): Record<string, string> {
  return buildComposeProcessEnv({
    projectName: ctx.composeProjectName,
    explicitEnv: {
      ...ctx.composeEnv,
      ...ctx.testEnv,
      TEST_COMPOSE_FILE: ctx.composeFiles[0] ?? '',
      TEST_COMPOSE_FILES: JSON.stringify(ctx.composeFiles),
      TEST_COMPOSE_PROJECT_NAME: ctx.composeProjectName,
    },
  });
}
