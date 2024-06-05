import { useQuery } from '@tanstack/react-query';

import {
  initializeStorage,
  setupSubscriptions,
  syncActivityEvents,
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
    queryFn: async () => {
      try {
        // First sync the key bits in parallel.
        await Promise.all([
          syncLatestPosts(),
          syncInitData(),
          syncContacts(),
          syncActivityEvents(),
        ]);
        // Kick the rest off asynchronously so that it's not triggering the
        // initial sync spinner.
        setupSubscriptions();
        syncStaleChannels();
        Promise.all([
          initializeStorage(),
          syncSettings(),
          syncVolumeSettings(),
        ]);
      } catch (e) {
        if (!(e instanceof QueueClearedError)) {
          console.log('SYNC ERROR', e);
        }
      }
      return true;
    },
    queryKey: ['init'],
  });
};
