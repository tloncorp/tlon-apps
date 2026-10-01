import { createStorageItem } from '@tloncorp/shared/db';
import { Platform, TurboModuleRegistry } from 'react-native';

import type { BackgroundCacheSpec } from './backgroundCache';

export type NativeCacheGeneration = {
  version: number;
  getVersion: () => Promise<number>;
  setVersion: (version: number) => Promise<void>;
  clearNativeCache: () => Promise<void>;
};

// Bump when existing iOS and Android SQLite caches need rebuilding independently
// of the schema. Generation 1 also repairs data missed by the iOS delta-merge bug.
export const NATIVE_CACHE_GENERATION = 1;

export function getNativeCacheGeneration(): NativeCacheGeneration | undefined {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  let clearNativeCache = async (): Promise<void> => {};
  if (Platform.OS === 'ios') {
    const cache = TurboModuleRegistry.get(
      'BackgroundCache'
    ) as BackgroundCacheSpec | null;
    // An OTA on the old iOS binary must not consume the repair before the native
    // merge/handoff fixes are installed. The acknowledgement API marks that build.
    if (!cache?.acknowledgeBackgroundData) return;
    // Zero clears both the extension cursor and its shared cache file. Await
    // the bridge directly: the storage listener isn't mounted during DB init.
    clearNativeCache = () => cache.setLastSyncTimestamp(0);
  }

  const generation = createStorageItem<number>({
    key: 'nativeLocalCacheGeneration',
    defaultValue: 0,
    persistAfterLogout: true,
  });
  return {
    version: NATIVE_CACHE_GENERATION,
    getVersion: () => generation.getValue(),
    setVersion: (version) => generation.setValue(version),
    clearNativeCache,
  };
}
