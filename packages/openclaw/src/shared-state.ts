/**
 * Cross-context shared state for module-level mutables that need to survive
 * the host's plugin module isolation.
 *
 * OpenClaw (>=2026.4.27) loads the extension entry and lazy-imported runtime
 * modules through separate module-loader contexts. Plain module-level
 * singletons (`const X = new Map()`, `let X = null`) therefore live twice —
 * once per context — so writes from the runtime side aren't visible from the
 * extension side and vice versa.
 *
 * These helpers route state through a `globalThis` registry keyed by
 * `Symbol.for(...)`, which is shared across every module instance in the
 * process. Pattern mirrors `openclaw/plugin-sdk/runtime-store`.
 */

const REGISTRY_KEY = Symbol.for("@tloncorp/openclaw.shared-state");

type Registry = Map<string, unknown>;

function getRegistry(): Registry {
  const host = globalThis as { [key: symbol]: unknown };
  let registry = host[REGISTRY_KEY] as Registry | undefined;
  if (!registry) {
    registry = new Map<string, unknown>();
    host[REGISTRY_KEY] = registry;
  }
  return registry;
}

/** A Map shared across plugin module contexts under the given slot id. */
export function sharedMap<K, V>(slot: string): Map<K, V> {
  const registry = getRegistry();
  let m = registry.get(slot) as Map<K, V> | undefined;
  if (!m) {
    m = new Map<K, V>();
    registry.set(slot, m);
  }
  return m;
}

/** A single-value slot shared across plugin module contexts. */
export function sharedSlot<T>(slot: string): {
  get(): T | null;
  set(value: T | null): void;
} {
  const registry = getRegistry();
  if (!registry.has(slot)) {
    registry.set(slot, null);
  }
  return {
    get: () => registry.get(slot) as T | null,
    set: (value) => registry.set(slot, value),
  };
}
