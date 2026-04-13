import * as api from '@tloncorp/api';

import * as db from '../../db';
import { QueryCtx, batchEffects } from '../../db/query';
import * as LocalCache from '../cachedData';
import { SyncCtx, syncQueue } from '../syncQueue';
import { logger } from './logger';

export const syncContacts = async (
  ctx?: SyncCtx,
  queryCtx?: QueryCtx,
  yieldWriter?: boolean
) => {
  const contacts = await syncQueue.add('contacts', ctx, () =>
    api.getContacts()
  );
  logger.log('got contacts from api', contacts.length, 'contacts');

  const writer = async () => {
    try {
      await db.insertContacts(contacts, queryCtx);
      LocalCache.cacheContacts(contacts);
    } catch (e) {
      logger.error('error inserting contacts', e);
    }
  };

  if (yieldWriter) {
    return writer;
  } else {
    await writer();
    return () => Promise.resolve();
  }
};
