import { useQuery } from '@tanstack/react-query';

import {
  syncContacts,
  syncInitData,
  syncLatestPosts,
  syncSettings,
} from './sync';
import { QueueClearedError } from './syncQueue';

export const useInitialSync = (currentUserId: string) => {
  return useQuery({
    queryFn: async () => {
      try {
        await Promise.all([
          syncLatestPosts(),
          syncInitData(currentUserId),
          syncContacts(),
        ]);
        await syncSettings();
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
