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
    api.getContactsByProvenance()
  );
  logger.log(
    'got contacts from api',
    contacts.v0Peers.length + contacts.v1Contacts.length,
    'contacts'
  );

  const writer = async () => {
    try {
      await db.insertContacts(contacts, queryCtx);
      LocalCache.cacheContacts([...contacts.v0Peers, ...contacts.v1Contacts]);
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
