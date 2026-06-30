import { FakeModelClient } from '../fake-model/index.js';
import type {
  DriverRuntimeSpec,
  RuntimeContext,
  RuntimeSeed,
} from '../drivers/types.js';
import { readFileSync } from 'node:fs';

export function createRuntimeContext(
  seed: RuntimeSeed,
  spec: DriverRuntimeSpec
): RuntimeContext {
  const ctx: RuntimeContext = {
    ...seed,
    ...spec,
    fakeModel: new FakeModelClient(seed.endpoints.fakeModel.hostBaseUrl),
  };
  return deepFreeze(ctx);
}

export function runtimeContextForJson(ctx: RuntimeContext): unknown {
  const { fakeModel: _fakeModel, ...serializable } = ctx;
  return serializable;
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
    fakeModel: new FakeModelClient(raw.endpoints.fakeModel.hostBaseUrl),
  });
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
