import { useQuery } from '@tanstack/react-query';

import {
  initializeStorage,
  setupSubscriptions,
  syncContacts,
  syncInitData,
  syncLatestPosts,
  syncSettings,
} from './sync';
import { QueueClearedError } from './syncQueue';

export const useInitialSync = () => {
  return useQuery({
    queryFn: async () => {
      try {
        await Promise.all([
          syncLatestPosts(),
          syncInitData(),
          syncContacts(),
          setupSubscriptions(),
        ]);
        await Promise.all([initializeStorage(), syncSettings()]);
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
