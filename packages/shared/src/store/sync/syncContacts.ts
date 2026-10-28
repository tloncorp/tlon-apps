import * as api from '@tloncorp/api';

import * as db from '../../db';
import { QueryCtx, batchEffects } from '../../db/query';
import * as LocalCache from '../cachedData';
import { SyncCtx, syncQueue } from '../syncQueue';
import { logger } from './logger';

export const syncContactSuggestions = async (
  contactIds: string[],
  queryCtx?: QueryCtx
) => {
  const contacts = await syncQueue.add('contact suggestions', undefined, () =>
    api.getContacts()
  );
  const suggestions = new Set(
    contacts.filter((c) => c.isContactSuggestion).map((c) => c.id)
  );

  const write = async (ctx: QueryCtx) => {
    for (const id of contactIds) {
      await db.setContactSuggestion(
        { id, isContactSuggestion: suggestions.has(id) },
        ctx
      );
    }
  };
  if (queryCtx) {
    await write(queryCtx);
  } else {
    await batchEffects('syncContactSuggestions', write);
  }
  LocalCache.cacheContacts(await db.getContacts(queryCtx));
};

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
