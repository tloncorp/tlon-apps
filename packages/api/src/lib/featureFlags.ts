// Feature-flag setup is in app-specific files (e.g. packages/app/lib/featureFlags.ts)
// This code enables mirroring feature flags from the base `shared` package, so
// any code can read feature flags without worrying about dependency graph.
// (The actual mirroring code happens in the same scope as the setup.)

let flags: Record<string, boolean> = {};
const listeners: Record<string, Set<(enabled: boolean) => void>> = {};

export function updateFeatureFlags(
  update: (prev: Record<string, boolean>) => Record<string, boolean>
) {
  flags = update(flags);
  emitChanged();
}

export function subscribeToFeatureFlag(
  name: string,
  callback: (enabled: boolean) => void
) {
  if (!listeners[name]) {
    listeners[name] = new Set();
  }
  listeners[name].add(callback);
  callback(flags[name]);
  return () => {
    listeners[name].delete(callback);
  };
}

function emitChanged() {
  for (const [name, callbacks] of Object.entries(listeners)) {
    for (const callback of callbacks) {
      callback(flags[name]);
    }
  }
}
