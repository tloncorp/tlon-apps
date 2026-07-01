import { readFileSync } from 'node:fs';

import { FakeModelClient } from '../fake-model/index.js';
import type {
  DriverRuntimeSpec,
  RuntimeContext,
  RuntimeSeed,
  RuntimeTestMetadata,
} from '../drivers/types.js';

export interface RuntimeContextJsonOptions {
  includeRuntimeEnv?: boolean;
}

export function createRuntimeContext(
  seed: RuntimeSeed,
  spec: DriverRuntimeSpec
): RuntimeContext {
  const ctx: RuntimeContext = {
    ...seed,
    ...spec,
    testMetadata: runtimeTestMetadata(spec.composeEnv),
    fakeModel: new FakeModelClient(seed.endpoints.fakeModel.hostBaseUrl),
  };
  return deepFreeze(ctx);
}

export function runtimeContextForJson(
  ctx: RuntimeContext,
  options: RuntimeContextJsonOptions = {}
): unknown {
  const {
    fakeModel: _fakeModel,
    composeEnv,
    testEnv,
    ...serializable
  } = ctx;
  const output: Record<string, unknown> = {
    ...serializable,
    testMetadata: ctx.testMetadata ?? runtimeTestMetadata(composeEnv),
  };

  if (options.includeRuntimeEnv) {
    output.composeEnv = composeEnv;
    output.testEnv = testEnv;
  }

  return output;
}

export function runtimeContextFromJson(value: unknown): RuntimeContext {
  if (!value || typeof value !== 'object') {
    throw new Error('Runtime context JSON must be an object.');
  }
  const raw = value as Omit<RuntimeContext, 'fakeModel'>;
  if (!raw.endpoints?.fakeModel?.hostBaseUrl) {
    throw new Error('Runtime context JSON is missing fake-model endpoint data.');
  }
  return deepFreeze({
    ...raw,
    composeEnv: raw.composeEnv ?? {},
    testEnv: raw.testEnv ?? {},
    testMetadata:
      raw.testMetadata ?? runtimeTestMetadata(raw.composeEnv ?? {}),
    fakeModel: new FakeModelClient(raw.endpoints.fakeModel.hostBaseUrl),
  } as RuntimeContext);
}

export function runtimeContextFromFile(filePath: string): RuntimeContext {
  return runtimeContextFromJson(JSON.parse(readFileSync(filePath, 'utf8')));
}

export function runtimeContextFromEnv(): RuntimeContext {
  const filePath = process.env.TLON_BOT_E2E_RUNTIME_CONTEXT_FILE;
  if (!filePath) {
    throw new Error('Missing TLON_BOT_E2E_RUNTIME_CONTEXT_FILE.');
  }
  return runtimeContextFromFile(filePath);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}

function runtimeTestMetadata(
  composeEnv: Record<string, string>
): RuntimeTestMetadata {
  return {
    ...(composeEnv.TLON_MAX_CONSECUTIVE_BOT_RESPONSES
      ? {
          tlonMaxConsecutiveBotResponses:
            composeEnv.TLON_MAX_CONSECUTIVE_BOT_RESPONSES,
        }
      : {}),
  };
}
