import * as api from '@tloncorp/api';

import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('lensActions', false);

/**
 * Scry one exact lens run from the owner ship's %steward agent and cache the
 * result, even when a local snapshot already exists. This is intentionally a
 * targeted refresh rather than a recent-runs poll so callers can recover a
 * terminal snapshot that is still propagating through ship sync.
 */
export async function refreshContextLensRun({
  botShip,
  lensId,
}: {
  botShip: string;
  lensId: string;
}): Promise<db.ContextLensRun | null> {
  try {
    const run = await api.getLensRun(botShip, lensId);
    if (!run) {
      return null;
    }
    await db.insertContextLensRuns([run]);
    return run;
  } catch (error) {
    // covers ships without the %steward agent as well as transient failures;
    // callers treat null as "run unavailable"
    logger.log('lens run scry failed', botShip, lensId, error);
    return null;
  }
}

/**
 * Resolve a lens run db-first: return the locally synced row if present,
 * otherwise scry the owner ship's %steward agent (lens module) and cache the result.
 */
export async function ensureContextLensRun({
  botShip,
  lensId,
}: {
  botShip: string;
  lensId: string;
}): Promise<db.ContextLensRun | null> {
  const existing = await db.getContextLensRun({ botShip, lensId });
  if (existing) {
    return existing;
  }

  return refreshContextLensRun({ botShip, lensId });
}

/**
 * Request a re-run of a failed lens run. Best-effort: the poke acks when our
 * ship accepts it; success is observable as a new run (trigger "retry")
 * arriving via lens sync.
 */
export async function retryLensRun({
  botShip,
  lensId,
}: {
  botShip: string;
  lensId: string;
}): Promise<void> {
  logger.log('requesting lens run retry', botShip, lensId);
  await api.retryLensRun({ botShip, lensId });
}
