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
    // covers ships without the %steward agent as well as transient failures;
    // callers treat null as "run unavailable"
    logger.log('lens run scry failed', botShip, lensId, error);
    return null;
  }
}

/** How many of a scheduled task's runs one fetch brings in. */
export const CRON_JOB_RUN_PAGE_SIZE = 50;

/**
 * Bring a page of one scheduled task's runs from the owner ship into the
 * local store: the newest, or with `before` (the cursor of the page before)
 * the next older page. Resolves with how many runs of the task the ship
 * holds, whether this page came back full, so a caller knows whether to offer
 * more, the cursor to ask for the page after it, and when the page's oldest
 * run was received.
 */
export async function syncCronJobRuns({
  botShip,
  jobId,
  before,
}: {
  botShip: string;
  jobId: string;
  before?: string;
}): Promise<{
  total: number;
  hasMore: boolean;
  cursor?: string;
  oldestAt?: number;
}> {
  const { total, runs, cursor } = await api.getLensCronRuns({
    botShip,
    jobId,
    count: CRON_JOB_RUN_PAGE_SIZE,
    before,
  });
  await db.insertContextLensRuns(runs);
  return {
    total,
    hasMore: runs.length === CRON_JOB_RUN_PAGE_SIZE,
    cursor,
    oldestAt: runs.at(-1)?.receivedAt,
  };
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
