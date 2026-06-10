import * as api from '@tloncorp/api';

import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('lensActions', false);

/**
 * Resolve a lens run db-first: return the locally synced row if present,
 * otherwise scry the owner ship's %context-lens agent and cache the result.
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
    // covers ships without the %context-lens agent as well as transient failures;
    // callers treat null as "run unavailable"
    logger.log('lens run scry failed', botShip, lensId, error);
    return null;
  }
}
