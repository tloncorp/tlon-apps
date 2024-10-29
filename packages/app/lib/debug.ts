import { useDebugStore } from '@tloncorp/shared';

import storage from './storage';

const DEBUG_STORAGE_KEY = 'debug';

storage
  .load({
    key: DEBUG_STORAGE_KEY,
  })
  .then((enabled) => {
    useDebugStore.getState().toggle(enabled);
  })
  .catch(() => {
    useDebugStore.getState().toggle(false);
  });

export const setDebug = async (enabled: boolean) => {
  console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  useDebugStore.getState().toggle(enabled);

  await storage.save({
    key: DEBUG_STORAGE_KEY,
    data: enabled,
  });
};
