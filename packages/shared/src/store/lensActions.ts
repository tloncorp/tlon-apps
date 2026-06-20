import * as api from '@tloncorp/api';

import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('lensActions', false);

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

  try {
    const run = await api.getLensRun(botShip, lensId);
    if (!run) {
      return null;
    }
    await db.insertContextLensRuns([run]);
    return run;
  } catch (error) {
    // covers ships without the %steward agent (lens module) as well as transient failures;
    // callers treat null as "run unavailable"
    logger.log('lens run scry failed', botShip, lensId, error);
    return null;
  }
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
