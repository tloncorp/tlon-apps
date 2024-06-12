import { useQuery } from '@tanstack/react-query';

import * as db from '../db';
import {
  initializeStorage, // syncActivityEvents,
  resetActivity,
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
      // Promise.all([
      //   setupSubscriptions(),
      //   initializeStorage(),
      //   syncSettings(),
      //   syncVolumeSettings(),
      //   resetActivity(),
      //   // syncActivityEvents(),
      // ]).catch((e) => {
      //   handleSyncError(e);
      // });

      try {
        await setupSubscriptions();
        console.log(`bl: sub done`);
        await initializeStorage();
        console.log(`bl: storage done`);
        await syncSettings();
        console.log(`bl: settings done`);
        await syncVolumeSettings();
        console.log(`bl: volume done`);
        await resetActivity();
        console.log(`bl: actifvity done`);
      } catch (e) {
        handleSyncError(e);
      }

      return true;
    },
  });
};

function handleSyncError(e: Error) {
  if (!(e instanceof QueueClearedError)) {
    console.error('SYNC ERROR', e);
  }
}
