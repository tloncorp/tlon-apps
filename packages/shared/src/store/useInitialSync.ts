import { useQuery } from '@tanstack/react-query';

import {
  initializeStorage,
  setupSubscriptions,
  syncContacts,
  syncInitData,
  syncLatestPosts,
  syncSettings,
  syncStaleChannels,
  syncVolumeSettings,
} from './sync';
import { QueueClearedError } from './syncQueue';

export const useInitialSync = () => {
  return useQuery({
    queryKey: ['init'],
    queryFn: async () => {
      try {
        // First sync the key bits in parallel.
        await Promise.all([syncLatestPosts(), syncInitData(), syncContacts()]);
      } catch (e) {
        handleSyncError(e);
      }
      // Kick the rest off asynchronously so that it's not triggering the
      // initial sync spinner.
      Promise.all([
        setupSubscriptions(),
        syncStaleChannels(),
        initializeStorage(),
        syncSettings(),
        syncVolumeSettings(),
      ]).catch((e) => {
        handleSyncError(e);
      });
      return true;
    },
  });
};

function handleSyncError(e: Error) {
  if (!(e instanceof QueueClearedError)) {
    console.error('SYNC ERROR', e);
  }
}
