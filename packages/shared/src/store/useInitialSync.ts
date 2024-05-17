import { useQuery } from '@tanstack/react-query';

import {
  syncContacts,
  syncInitData,
  syncSettings,
  syncStaleChannels,
} from './sync';

export const useInitialSync = (currentUserId: string) => {
  return useQuery({
    queryFn: async () => {
      try {
        await Promise.all([
          syncInitData(currentUserId),
          syncContacts(),
          syncSettings(),
        ]);
        await syncStaleChannels();
      } catch (e) {
        console.log('SYNC ERROR', e);
      }
      return true;
    },
    queryKey: ['init'],
  });
};
