import { createStorageItem } from '@tloncorp/shared/db';
import { Platform, TurboModuleRegistry } from 'react-native';

export type NativeCacheGeneration = {
  version: number;
  getVersion: () => Promise<number>;
  setVersion: (version: number) => Promise<void>;
  clearNativeCache: () => Promise<void>;
};

// Bump only when existing iOS SQLite caches need rebuilding independently of
// the schema. Generation 1 repairs data missed by the native delta-merge bug.
export const IOS_CACHE_GENERATION = 1;

export function getIOSCacheGeneration(): NativeCacheGeneration | undefined {
  if (Platform.OS !== 'ios') return;
  const cache = TurboModuleRegistry.get('BackgroundCache') as {
    setLastSyncTimestamp: (timestamp: number) => Promise<void>;
    acknowledgeBackgroundData?: (cacheId: string) => Promise<boolean>;
  } | null;
  // An OTA on the old binary must not consume the repair before the native
  // merge/handoff fixes are installed. The acknowledgement API marks that build.
  if (!cache?.acknowledgeBackgroundData) return;

  const generation = createStorageItem<number>({
    key: 'iosLocalCacheGeneration',
    defaultValue: 0,
    persistAfterLogout: true,
  });
  return {
    version: IOS_CACHE_GENERATION,
    getVersion: () => generation.getValue(),
    setVersion: (version) => generation.setValue(version),
    // Zero clears both the extension cursor and its shared cache file. Await
    // the bridge directly: the storage listener isn't mounted during DB init.
    clearNativeCache: () => cache.setLastSyncTimestamp(0),
  };
}
