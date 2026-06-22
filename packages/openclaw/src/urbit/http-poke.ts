import { randomUUID } from 'node:crypto';
import type { SsrFPolicy } from 'openclaw/plugin-sdk/ssrf-runtime';

import { authenticate } from './auth.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './context.js';
import { urbitFetch } from './fetch.js';

export type HttpPokeApi = {
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<number>;
  delete: () => Promise<void>;
};

/**
 * Simple HTTP-only poke that doesn't open an EventSource (avoids conflict with monitor's SSE)
 */
export async function createHttpPokeApi(params: {
  url: string;
  code: string;
  ship: string;
  allowPrivateNetwork?: boolean;
}): Promise<HttpPokeApi> {
  const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(
    params.allowPrivateNetwork
  );
  const cookie = await authenticate(params.url, params.code, { ssrfPolicy });
  const channelId = `${Math.floor(Date.now() / 1000)}-${randomUUID().slice(0, 8)}`;
  const channelPath = `/~/channel/${channelId}`;
  const shipName = params.ship.replace(/^~/, '');

  return {
    poke: async (pokeParams: { app: string; mark: string; json: unknown }) => {
      const pokeId = Date.now();
      const pokeData = {
        id: pokeId,
        action: 'poke',
        ship: shipName,
        app: pokeParams.app,
        mark: pokeParams.mark,
        json: pokeParams.json,
      };

      const { response, release } = await urbitFetch({
        baseUrl: params.url,
        path: channelPath,
        init: {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie.split(';')[0],
          },
          body: JSON.stringify([pokeData]),
        },
        ssrfPolicy,
        timeoutMs: 30_000,
        auditContext: 'tlon-http-poke',
      });

      try {
        if (!response.ok && response.status !== 204) {
          const errorText = await response.text();
          throw new Error(`Poke failed: ${response.status} - ${errorText}`);
        }
        return pokeId;
      } finally {
        await release();
      }
    },
    delete: async () => {
      // No-op for HTTP-only client
    },
  };
}
