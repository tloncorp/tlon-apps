import { useQuery } from '@tanstack/react-query';

import { syncContacts, syncInitData, syncStaleChannels } from './sync';

export const useInitialSync = () => {
  return useQuery({
    queryFn: async () => {
      try {
        await Promise.all([
          syncInitData(),
          syncContacts(),
          syncStaleChannels(),
        ]);
      } catch (e) {
        console.log('SYNC ERROR', e);
      }
      return true;
    },
    queryKey: ['init'],
  });
};
