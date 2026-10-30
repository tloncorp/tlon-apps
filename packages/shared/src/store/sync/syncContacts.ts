import * as api from '@tloncorp/api';

import * as db from '../../db';
import { deskVersionSupportsContactDecisions } from '../../logic/contactDecisionSupport';
import { QueryCtx, batchEffects, withTransactionCtx } from '../../db/query';
import * as LocalCache from '../cachedData';
import { getClientGeneration } from '../session';
import { captureContactSnapshot } from '../contactIntent';
import { SyncCtx, syncQueue } from '../syncQueue';
import { logger } from './logger';

export const syncContactSuggestions = async (
  contactIds: string[],
  queryCtx?: QueryCtx,
  isCurrent: (id: string) => boolean = captureContactSnapshot()
) => {
  const generation = getClientGeneration();
  const contacts = await syncQueue.add('contact suggestions', undefined, () =>
    api.getContacts()
  );
  if (getClientGeneration() !== generation) return;
  const suggestions = new Set(
    contacts.filter((c) => c.isContactSuggestion).map((c) => c.id)
  );

  const write = async (ctx: QueryCtx) =>
    withTransactionCtx(ctx, async (txCtx) => {
      for (const id of contactIds) {
        if (!isCurrent(id)) continue;
        await db.setContactSuggestion(
          { id, isContactSuggestion: suggestions.has(id) },
          txCtx
        );
      }
    });
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
  const isCurrent = captureContactSnapshot();
  const generation = getClientGeneration();
  const contacts = await syncQueue.add('contacts', ctx, () =>
    api.getContacts()
  );
  logger.log('got contacts from api', contacts.length, 'contacts');

  const writer = async () => {
    try {
      const write = (ctx: QueryCtx) =>
        withTransactionCtx(ctx, async (txCtx) => {
          if (generation !== getClientGeneration()) return;
          const snapshot: db.Contact[] = [];
          for (const contact of contacts) {
            const current = isCurrent(contact.id)
              ? contact
              : await db.getContact({ id: contact.id }, txCtx);
            if (current) snapshot.push(current);
          }
          if (generation !== getClientGeneration()) return;
          await db.insertContacts(snapshot, txCtx);
        });
      if (queryCtx) await write(queryCtx);
      else await batchEffects('syncContacts', write);
      if (generation !== getClientGeneration()) return;
      LocalCache.cacheContacts(await db.getContacts(queryCtx));
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

// 12.5 was unreleased when the complete contract was added; the removal-only
// development desk has the same version, so its version alone is insufficient.
export async function syncContactDecisionSupport(
  groupsVersion?: string | null
) {
  const generation = getClientGeneration();
  if (!deskVersionSupportsContactDecisions(groupsVersion)) {
    api.setDeskSupportsContactDecisions(false);
    return;
  }
  if (api.getDeskSupportsContactDecisionsState() !== true) {
    api.setDeskSupportsContactDecisions(null);
  }
  try {
    await api.probeContactDecisions();
    if (getClientGeneration() === generation)
      api.setDeskSupportsContactDecisions(true);
  } catch (error) {
    if (getClientGeneration() !== generation) return;
    if (error instanceof api.BadResponseError && error.status === 404) {
      api.setDeskSupportsContactDecisions(false);
      return;
    }
    throw error;
  }
}
