import * as api from '@tloncorp/api';

import * as db from '../../db';
import { QueryCtx, batchEffects } from '../../db/query';
import * as LocalCache from '../cachedData';
import { getClientGeneration } from '../session';
import { SyncCtx, syncQueue } from '../syncQueue';
import { logger } from './logger';

export const syncContactSuggestions = async (
  contactIds: string[],
  queryCtx?: QueryCtx
) => {
  const generation = getClientGeneration();
  const contacts = await syncQueue.add('contact suggestions', undefined, () =>
    api.getContacts()
  );
  if (getClientGeneration() !== generation) return;
  const suggestions = new Set(
    contacts.filter((c) => c.isContactSuggestion).map((c) => c.id)
  );

  const write = async (ctx: QueryCtx) => {
    for (const id of contactIds) {
      if (getClientGeneration() !== generation) return;
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
  if (getClientGeneration() !== generation) return;
  const cached = await db.getContacts(queryCtx);
  if (getClientGeneration() === generation) LocalCache.cacheContacts(cached);
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
