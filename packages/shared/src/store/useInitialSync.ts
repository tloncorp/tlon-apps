import { useQuery } from '@tanstack/react-query';

import {
  initializeStorage,
  setupSubscriptions,
  syncContacts,
  syncInitData,
  syncLatestPosts,
  syncSettings,
  syncStaleChannels,
} from './sync';
import { QueueClearedError } from './syncQueue';

export const useInitialSync = () => {
  return useQuery({
    queryFn: async () => {
      try {
        // First sync the key bits in parallel.
        await Promise.all([syncLatestPosts(), syncInitData(), syncContacts()]);
        // Kick the rest off asynchronously so that it's not triggering the
        // initial sync spinner.
        setupSubscriptions();
        syncStaleChannels();
        Promise.all([initializeStorage(), syncSettings()]);
      } catch (e) {
        if (!(e instanceof QueueClearedError)) {
          console.error('SYNC ERROR', e);
        }
      }
      return true;
    },
    queryKey: ['init'],
  });
};
