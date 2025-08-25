import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import {
  CHANGES_SYNCED_AT_KEY,
  registerStorageItemListener,
} from '@tloncorp/shared/db';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

const BackgroundDataLoader = NativeModules.BackgroundDataLoader;
const ENABLED = Platform.OS === 'ios' && BackgroundDataLoader;

const logger = createDevLogger('cachedChanges', true);

export function useCachedChanges() {
  // scaffold a listener to propagate changes to our synced at stamp
  useEffect(() => {
    if (ENABLED) {
      registerStorageItemListener<number | null>(
        CHANGES_SYNCED_AT_KEY,
        async (newStamp) => {
          try {
            logger.log('changes sync stamp updated, sending to native module');
            await BackgroundDataLoader.setLastSyncTimestamp(newStamp);
          } catch (e) {
            logger.trackError(
              `Failed to send last sync timetamp to native module`,
              e
            );
          }
        }
      );
    }
  }, []);

  const checkForCachedChanges = useCallback(async () => {
    if (!ENABLED) return;
    const execStart = Date.now();

    let cacheResult = null;
    try {
      cacheResult = await BackgroundDataLoader.retrieveBackgroundData();
    } catch (e) {
      logger.trackError(`Failed to retrieve background data`, e);
    }
    if (!cacheResult) return;

    let changes: db.ChangesResult | null = null;
    let begin, end;
    try {
      const deserialized = JSON.parse(cacheResult);
      changes = api.parseChanges(deserialized.changes);
      begin = Number(deserialized.beginTimestamp);
      end = Number(deserialized.endTimestamp);
    } catch (e) {
      logger.trackEvent('Failed to parse cached changes');
    }

    if (changes && begin && end) {
      try {
        logger.log(`Retrieved cached changes ${begin} - ${end}, syncing...`);
        await store.syncCachedChanges({ changes, begin, end });
        logger.log(`Synced cache changes: ${Date.now() - execStart}ms`);
      } catch (e) {
        logger.trackError(`Failed to sync cached changes`, e);
      }
    }
  }, []);

  return checkForCachedChanges;
}
