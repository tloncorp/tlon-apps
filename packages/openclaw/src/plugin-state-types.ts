import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';

// 9.33 publishes plugin-state-runtime without declarations. Derive the store
// from the typed public runtime instead of importing internal dist chunks.
declare const openKeyedStore: OpenClawPluginApi['runtime']['state']['openKeyedStore'];
export type PluginStateKeyedStore<T> = ReturnType<typeof openKeyedStore<T>>;
