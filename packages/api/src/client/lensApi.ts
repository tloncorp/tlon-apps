import { da, parse } from '@urbit/aura';

import { createDevLogger } from '../lib/logger';
import * as ub from '../urbit';
import { BadResponseError, poke, scry, subscribe } from './urbit';

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
    // %steward relays the run record as structured JSON, not a cord — pass
    // it through unchanged.
    payload: entry.payload,
  };
};

export const getRecentLensRuns = async (): Promise<LensRun[]> => {
  const response = await scry<{ recent: ub.LensRunEntry[] }>({
    app: 'steward',
    path: '/v1/lens/recent',
  });

  return response.recent.map(toLensRun);
};

export const getLensRun = async (
  botShip: string,
  lensId: string
): Promise<LensRun | null> => {
  try {
    const response = await scry<{ entry: ub.LensRunEntry }>({
      app: 'steward',
      path: `/v1/lens/run/${botShip}/${lensId}`,
    });

    return toLensRun(response.entry);
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

/**
 * Ask the bot to re-run a failed lens run. Pokes our own %steward agent,
 * which relays the request to the bot ship; the bot's gateway re-dispatches
 * and the retry shows up as a new run.
 */
export const retryLensRun = ({
  botShip,
  lensId,
}: {
  botShip: string;
  lensId: string;
}) =>
  poke({
    app: 'steward',
    mark: 'steward-lens-action-1',
    json: { retry: { bot: botShip, id: lensId } },
  });

export const subscribeToLensUpdates = async (
  handler: (runs: LensRun[]) => void
) => {
  // Older ships don't have the %steward agent; probe with a scry so a missing
  // agent skips the subscription instead of wedging sync.
  try {
    await scry<{ recent: ub.LensRunEntry[] }>({
      app: 'steward',
      path: '/v1/lens/recent',
    });
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      logger.trackEvent('%steward agent missing');
      logger.warn('lens agent unavailable, skipping lens subscription');
      return null;
    }

    throw error;
  }

  return subscribe<ub.LensUpdate>(
    {
      app: 'steward',
      path: '/v1/lens',
    },
    (event) => {
      logger.log('raw lens event', event);
      // /v1/lens carries %entry (a stored run, for us) and %retry-requested
      // (for the bot's own gateway); only the former concerns the client.
      if ('entry' in event) {
        handler([toLensRun(event.entry)]);
      }
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
