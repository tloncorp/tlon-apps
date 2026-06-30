import { FakeModelClient } from '../fake-model/index.js';
import type {
  DriverRuntimeSpec,
  RuntimeContext,
  RuntimeSeed,
} from '../drivers/types.js';

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
