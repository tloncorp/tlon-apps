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
    payload: parsePayload(entry.payload),
  };
};

// The agent relays payloads as opaque serialized-JSON cords; parse once at
// the API edge so the rest of the client sees structured data.
function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    logger.log('failed to parse lens payload', payload.slice(0, 100));
    return null;
  }
}

// %steward emits three lens-update variants on the wire. %entry / %recent
// carry data; %retry-requested is a signal for the gateway, not the client.
function isLensEntryUpdate(
  update: ub.LensModuleUpdate
): update is { entry: ub.LensRunEntry } {
  return 'entry' in update;
}

export const getRecentLensRuns = async (
  count?: number
): Promise<LensRun[]> => {
  const path =
    count && count > 0 ? `/v1/lens/recent/${count}` : '/v1/lens/recent';
  const response = await scry<ub.LensRecentScry>({ app: 'steward', path });
  return response.lens.recent.map(toLensRun);
};

export const getLensRunsSince = async (cutoff: string): Promise<LensRun[]> => {
  const response = await scry<ub.LensRecentScry>({
    app: 'steward',
    path: `/v1/lens/since/${cutoff}`,
  });
  return response.lens.recent.map(toLensRun);
};

export const getLensRun = async (
  botShip: string,
  lensId: string
): Promise<LensRun | null> => {
  try {
    const response = await scry<{ lens: ub.LensModuleUpdate }>({
      app: 'steward',
      path: `/v1/lens/run/${botShip}/${lensId}`,
    });
    if (!isLensEntryUpdate(response.lens)) {
      return null;
    }
    return toLensRun(response.lens.entry);
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

/**
 * Ask the bot to re-run a failed lens run. Pokes our own (local) %steward
 * with the bot ship and lensId; %steward routes it to the bot — if the bot
 * is us, it emits a %retry-requested fact for the local gateway; if the
 * bot is a different ship, %steward cross-ship pokes that ship's %steward,
 * which then emits the fact for its own local gateway.
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
    mark: 'steward-action-1',
    json: { lens: { retry: { bot: botShip, id: lensId } } },
  });

export const subscribeToLensUpdates = async (
  handler: (runs: LensRun[]) => void
) => {
  // Older ships don't have %steward; probe with a scry so a missing agent
  // skips the subscription instead of wedging sync.
  try {
    await scry<ub.LensRecentScry>({
      app: 'steward',
      path: '/v1/lens/recent',
    });
  } catch (error) {
    if (error instanceof BadResponseError && error.status === 404) {
      logger.trackEvent('%steward agent missing');
      logger.warn('steward agent unavailable, skipping lens subscription');
      return null;
    }

    throw error;
  }

  return subscribe<{ lens: ub.LensModuleUpdate }>(
    {
      app: 'steward',
      path: '/v1/lens',
    },
    (event) => {
      logger.log('raw steward lens event', event);
      if (!isLensEntryUpdate(event.lens)) {
        // %retry-requested signals are for the gateway, not run data.
        return;
      }
      handler([toLensRun(event.lens.entry)]);
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
