import { da, parse } from '@urbit/aura';

import { createDevLogger } from '../lib/logger';
import * as ub from '../urbit';
import { BadResponseError, scry, subscribe } from './urbit';

const logger = createDevLogger('lensApi', false);

// Client-facing run records use unix timestamps and camelCase ids; the wire
// shape (ub.LensRunEntry) keeps the agent's @da string and short field names.
export interface LensRun {
  botShip: string;
  lensId: string;
  complete: boolean;
  receivedAt: number;
  payload: unknown;
}

export const toLensRun = (entry: ub.LensRunEntry): LensRun => {
  return {
    botShip: entry.bot,
    lensId: entry.id,
    complete: entry.complete,
    receivedAt: parseReceived(entry.received),
    payload: entry.payload,
  };
};

export const toLensRuns = (update: ub.LensUpdate): LensRun[] => {
  if ('run' in update) {
    return [toLensRun(update.run)];
  }

  return update.runs.map(toLensRun);
};

export const getRecentLensRuns = async (): Promise<LensRun[]> => {
  const response = await scry<ub.LensUpdate>({
    app: 'context-lens',
    path: '/recent',
  });

  return toLensRuns(response);
};

export const getLensRun = async (
  botShip: string,
  lensId: string
): Promise<LensRun | null> => {
  try {
    const response = await scry<ub.LensUpdate>({
      app: 'context-lens',
      path: `/run/${botShip}/${lensId}`,
    });

    return toLensRuns(response)[0] ?? null;
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const subscribeToLensUpdates = async (
  handler: (runs: LensRun[]) => void
) => {
  // Older ships don't have the %context-lens agent; probe with a scry so a missing
  // agent skips the subscription instead of wedging sync.
  try {
    await scry<ub.LensUpdate>({
      app: 'context-lens',
      path: '/recent',
    });
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      logger.trackEvent('%context-lens agent missing');
      logger.warn('lens agent unavailable, skipping lens subscription');
      return null;
    }

    throw error;
  }

  return subscribe<ub.LensUpdate>(
    {
      app: 'context-lens',
      path: '/v1',
    },
    (event) => {
      logger.log('raw lens event', event);
      handler(toLensRuns(event));
    }
  );
};

function parseReceived(received: string): number {
  try {
    return Number(da.toUnix(parse('da', received)));
  } catch {
    logger.log('failed to parse lens received time', received);
    return 0;
  }
}
