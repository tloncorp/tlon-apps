import { da, parse } from '@urbit/aura';

import { createDevLogger } from '../lib/logger';
import * as ub from '../urbit';
import {
  pokeRequest,
  scryRequest,
  steward,
  subscribeRequest,
} from './requests';
import { BadResponseError } from './urbit';

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

export const getRecentLensRuns = async (count?: number): Promise<LensRun[]> => {
  const response =
    count && count > 0
      ? await scryRequest(steward.lensRecentN)<ub.LensRecentScry>({ count })
      : await scryRequest(steward.lensRecent)<ub.LensRecentScry>({});

  return response.recent.map(toLensRun);
};

// Paginate run history backwards: pass the oldest receivedAt (@da string)
// from the last page to fetch everything at or after that cutoff.
export const getLensRunsSince = async (cutoff: string): Promise<LensRun[]> => {
  const response = await scryRequest(steward.lensSince)<ub.LensRecentScry>({
    time: cutoff,
  });

  return response.recent.map(toLensRun);
};

export const getLensRun = async (
  botShip: string,
  lensId: string
): Promise<LensRun | null> => {
  try {
    const response = await scryRequest(steward.lensRun)<{
      entry: ub.LensRunEntry;
    }>({ bot: botShip, lens: lensId });

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
}) => pokeRequest(steward.lensAction)({ retry: { bot: botShip, id: lensId } });

export const subscribeToLensUpdates = async (
  handler: (runs: LensRun[]) => void
) => {
  // Older ships don't have the %steward agent; probe with a scry so a missing
  // agent skips the subscription instead of wedging sync.
  try {
    await scryRequest(steward.lensRecent)<ub.LensRecentScry>({});
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      logger.trackEvent('%steward agent missing');
      logger.warn('lens agent unavailable, skipping lens subscription');
      return null;
    }

    throw error;
  }

  return subscribeRequest(steward.lensFeed)<ub.LensUpdate>({}, (event) => {
    logger.log('raw lens event', event);
    // /v1/lens carries %entry (a stored run, for us) and %retry-requested
    // (for the bot's own gateway); only the former concerns the client.
    if ('entry' in event) {
      handler([toLensRun(event.entry)]);
    }
  });
};

function parseReceived(received: string): number {
  try {
    return Number(da.toUnix(parse('da', received)));
  } catch {
    logger.log('failed to parse lens received time', received);
    return 0;
  }
}
