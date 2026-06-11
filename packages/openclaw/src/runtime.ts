import type { PluginRuntime } from 'openclaw/plugin-sdk/core';
import { createPluginRuntimeStore } from 'openclaw/plugin-sdk/runtime-store';

// Keyed on globalThis via the SDK so the slot survives the host's
// plugin-module isolation — module-level singletons here would otherwise
// be empty when read from lazy-loaded runtime modules.
const tlonRuntimeStore = createPluginRuntimeStore<PluginRuntime>({
  pluginId: 'tlon',
  errorMessage: 'Tlon runtime not initialized',
});

export function setTlonRuntime(next: PluginRuntime) {
  tlonRuntimeStore.setRuntime(next);
}

export function getTlonRuntime(): PluginRuntime {
  return tlonRuntimeStore.getRuntime();
}
