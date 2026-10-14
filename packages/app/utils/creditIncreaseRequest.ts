import * as db from '@tloncorp/shared/db';

import { POST_HOG_API_KEY } from '../constants';

type CreditRequest = {
  ownerShip: string;
  botShip: string;
  sourcePostId: string;
  requestId: string;
};

const inFlight = new Map<string, Promise<void>>();

/** A user-requested operational signal, sent without creating a chat post. */
export async function submitCreditIncreaseRequest(
  request: CreditRequest
): Promise<void> {
  const key = `${request.ownerShip}/${request.requestId}`;
  const current = inFlight.get(key);
  if (current) return current;
  const flight = (async () => {
    const completed = await db.creditIncreaseRequested.getValue(true);
    if (!Object.values(completed).includes(request.requestId)) {
      if (!POST_HOG_API_KEY)
        throw new Error('Credit request reporting is unavailable');
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 15_000);
      try {
        // Same first-party ingestion proxy used by app PostHog clients. Await
        // the HTTP result so a failed request never becomes a completed button.
        const response = await fetch(
          'https://data-bridge-v1.vercel.app/ingest/batch/',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abort.signal,
            body: JSON.stringify({
              api_key: POST_HOG_API_KEY,
              batch: [
                {
                  event: 'TlonBot Credit Increase Requested',
                  uuid: request.requestId,
                  distinct_id: request.ownerShip,
                  timestamp: new Date().toISOString(),
                  properties: {
                    ...request,
                    source: 'budget_hold',
                    requestedFrom: 'tlon_app',
                  },
                },
              ],
            }),
          }
        );
        if (!response.ok)
          throw new Error(`Credit request failed (${response.status})`);
      } finally {
        clearTimeout(timeout);
      }
    }
    await db.creditIncreaseRequested.setValue((value) => ({
      ...value,
      [request.sourcePostId]: request.requestId,
    }));
  })();
  inFlight.set(key, flight);
  try {
    await flight;
  } finally {
    if (inFlight.get(key) === flight) inFlight.delete(key);
  }
}
