import { useQuery } from '@tanstack/react-query';

import {
  syncContacts,
  syncInitData,
  syncLatestPosts,
  syncSettings,
  syncVolumeSettings,
} from './sync';
import { QueueClearedError } from './syncQueue';

export const useInitialSync = () => {
  return useQuery({
    queryFn: async () => {
      try {
        await Promise.all([syncLatestPosts(), syncInitData(), syncContacts()]);
        await syncSettings();
        await syncVolumeSettings(); // TODO: move this to the concurrent fetch?
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
