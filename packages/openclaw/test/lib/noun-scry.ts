import { da } from '@urbit/aura';
import { Atom, Cell, type Noun, cue, enjs } from '@urbit/nockjs';

import { type StateClientConfig, withStateClientLock } from './state.js';

export type GatewayStatusValue = 'unknown' | 'up' | 'down';

export interface GatewayStatusScry {
  status: GatewayStatusValue;
  leaseUntil: number | null;
  raw: string;
}

export interface BoundedNounScryOptions {
  app: string;
  path: string;
  archive: string;
  timeoutMs?: number;
}

export interface BoundedNounClient {
  scry(options: BoundedNounScryOptions): Promise<Noun>;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

async function withAbortDeadline<T>(
  label: string,
  timeoutMs: number,
  request: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`${label} exceeded ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await request(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${timeoutMs}ms`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function unpackJamBytes(buffer: ArrayBuffer): Noun {
  const hex = [...new Uint8Array(buffer)]
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (!hex) {
    throw new Error('noun response body was empty');
  }
  return cue(Atom.fromString(hex, 16));
}

/**
 * Create a raw authenticated noun client whose login and noun body read each
 * have a real AbortSignal deadline. Calls share StateClient's serialization
 * lock and always release it in that lock's `finally` block.
 */
export function createBoundedNounClient(
  config: StateClientConfig
): BoundedNounClient {
  const shipUrl = config.shipUrl.replace(/\/$/, '');
  let cookie: string | null = null;

  const authenticate = async (timeoutMs: number): Promise<void> => {
    const response = await withAbortDeadline(
      `Urbit authentication for ${config.shipName}`,
      timeoutMs,
      (signal) =>
        fetch(`${shipUrl}/~/login`, {
          method: 'POST',
          body: `password=${encodeURIComponent(config.code)}`,
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          signal,
        })
    );
    if (!response.ok) {
      throw new Error(
        `Urbit authentication for ${config.shipName} failed with HTTP ${response.status}`
      );
    }
    cookie = response.headers.get('set-cookie')?.split(';')[0]?.trim() ?? null;
    if (!cookie) {
      throw new Error(
        `Urbit authentication for ${config.shipName} returned no session cookie`
      );
    }
  };

  const fetchNoun = async (
    url: string,
    timeoutMs: number
  ): Promise<{ response: Response; body: ArrayBuffer | null }> => {
    return withAbortDeadline(`noun scry ${url}`, timeoutMs, async (signal) => {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Cookie: cookie ?? '',
          Connection: 'close',
          'X-Channel-Format': 'application/x-urb-jam',
        },
        signal,
      });
      const body = response.ok ? await response.arrayBuffer() : null;
      return { response, body };
    });
  };

  const fetchNounWithNetworkRetry = async (
    url: string,
    timeoutMs: number
  ): Promise<{ response: Response; body: ArrayBuffer | null }> => {
    try {
      return await fetchNoun(url, timeoutMs);
    } catch (error) {
      // An AbortController deadline is a real bounded failure. A fake ship's
      // HTTP server can, however, close an idle keep-alive socket during the
      // monitor restart; retry that transport failure once, under a fresh
      // AbortController/deadline, without weakening 404 semantics below.
      if (error instanceof Error && error.message.includes('timed out')) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      return fetchNoun(url, timeoutMs);
    }
  };

  return {
    async scry(options) {
      return withStateClientLock(async () => {
        const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
        const path = options.path.startsWith('/')
          ? options.path
          : `/${options.path}`;
        const url = `${shipUrl}/~/scry/${options.app}${path}.noun`;

        if (!cookie) {
          await authenticate(timeoutMs);
        }

        let result = await fetchNounWithNetworkRetry(url, timeoutMs);
        if (result.response.status === 403) {
          cookie = null;
          await authenticate(timeoutMs);
          result = await fetchNounWithNetworkRetry(url, timeoutMs);
        }

        if (result.response.status === 404) {
          throw new Error(
            `Terminal noun scry 404: app=%${options.app}, path=${options.path}, archive=${options.archive}`
          );
        }
        if (!result.response.ok || !result.body) {
          throw new Error(
            `Noun scry failed with HTTP ${result.response.status}: app=%${options.app}, path=${options.path}, archive=${options.archive}`
          );
        }

        return unpackJamBytes(result.body);
      });
    },
  };
}

function malformedGatewayStatus(noun: Noun, reason: string): never {
  throw new Error(
    `Malformed gateway-status noun (${reason}); raw=${noun.toString()}`
  );
}

/** Decode the old standalone agent's `[status (unit @da)]` noun. */
export function decodeGatewayStatus(noun: Noun): GatewayStatusScry {
  const raw = noun.toString();
  if (!(noun instanceof Cell)) {
    return malformedGatewayStatus(noun, 'outer noun is not a cell');
  }
  if (!(noun.head instanceof Atom)) {
    return malformedGatewayStatus(noun, 'status head is not an atom');
  }

  const status = enjs.cord(noun.head);
  if (status !== 'unknown' && status !== 'up' && status !== 'down') {
    return malformedGatewayStatus(noun, `invalid status %${status}`);
  }

  let leaseUntil: number | null;
  if (noun.tail instanceof Atom) {
    if (noun.tail.number !== 0n) {
      return malformedGatewayStatus(noun, 'empty lease unit is not atom 0');
    }
    leaseUntil = null;
  } else {
    if (!(noun.tail instanceof Cell)) {
      return malformedGatewayStatus(
        noun,
        'lease unit is neither atom nor cell'
      );
    }
    if (!(noun.tail.head instanceof Atom) || noun.tail.head.number !== 0n) {
      return malformedGatewayStatus(noun, 'lease some head is not atom 0');
    }
    if (!(noun.tail.tail instanceof Atom)) {
      return malformedGatewayStatus(noun, 'lease @da tail is not an atom');
    }
    leaseUntil = da.toUnix(noun.tail.tail.number);
    if (!Number.isFinite(leaseUntil)) {
      return malformedGatewayStatus(noun, 'lease @da did not decode finitely');
    }
  }

  return { status, leaseUntil, raw };
}

/** Decode a bare @da noun, used by the standalone owner-activity scry. */
export function decodeDa(noun: Noun): number {
  if (!(noun instanceof Atom)) {
    throw new Error(
      `Malformed @da noun (expected atom); raw=${noun.toString()}`
    );
  }
  const unix = da.toUnix(noun.number);
  if (!Number.isFinite(unix)) {
    throw new Error(`Malformed @da noun (non-finite); raw=${noun.toString()}`);
  }
  return unix;
}
