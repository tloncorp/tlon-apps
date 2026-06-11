import { configureClient } from "@tloncorp/api";
import { createHttpPokeApi } from "./http-poke.js";
import { authenticate } from "./auth.js";
import { ssrfPolicyFromAllowPrivateNetwork } from "./context.js";
import { urbitFetch } from "./fetch.js";

type PokeFn = (params: { app: string; mark: string; json: unknown }) => Promise<unknown>;
type ScryFn = (params: { app: string; path: string }) => Promise<unknown>;

/**
 * Create a minimal Urbit-compatible shim that delegates poke() to the given function.
 * The @tloncorp/api configureClient accepts a `client` that looks like an Urbit instance.
 * Includes stubs for connect/eventSource/scryWithInfo so configureClient never crashes.
 */
function createClientShim(pokeFn: PokeFn, shipUrl: string, scryFn?: ScryFn) {
  return {
    poke: (params: { app: string; mark: string; json: unknown }) => pokeFn(params),
    on: () => ({ on: () => ({}) }),
    // connect/eventSource are called by configureClient when code is provided.
    // Our shim should never hit that path (we always inject the client), but
    // if another configureClient call happens without injecting, these no-ops
    // prevent a TypeError crash.
    connect: async () => {},
    eventSource: async () => {},
    // scryWithInfo is used by @tloncorp/api for scry operations (e.g., uploadFile).
    scryWithInfo: scryFn
      ? async <T>(params: { app: string; path: string }) => {
          const result = await scryFn(params);
          return { result: result as T, responseSizeInBytes: 0, responseStatus: 200 };
        }
      : async () => {
          throw new Error("Scry not supported on this client shim");
        },
    // Properties configureClient may access
    verbose: false,
    nodeId: "",
    url: shipUrl,
  } as any;
}

/**
 * Configure @tloncorp/api's global client with an existing poke function.
 * Use this when you already have an authenticated poke backend (e.g., SSE client in monitor).
 */
export function configureTlonApiWithPoke(
  pokeFn: PokeFn,
  ship: string,
  shipUrl: string,
  scryFn?: ScryFn,
): void {
  const shim = createClientShim(pokeFn, shipUrl, scryFn);
  configureClient({
    shipName: ship.replace(/^~/, ""),
    shipUrl,
    client: shim,
  });
}

/**
 * Create an authenticated HTTP-only client, configure @tloncorp/api, run fn, clean up.
 * Use this for one-shot outbound operations (channel.ts, actions.ts).
 * Supports both poke and scry (needed for uploadFile).
 */
export async function withAuthenticatedTlonApi<T>(
  params: { url: string; code: string; ship: string; allowPrivateNetwork?: boolean },
  fn: () => Promise<T>,
): Promise<T> {
  const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(params.allowPrivateNetwork);
  const cookie = await authenticate(params.url, params.code, { ssrfPolicy });

  const api = await createHttpPokeApi({
    url: params.url,
    code: params.code,
    ship: params.ship,
    allowPrivateNetwork: params.allowPrivateNetwork,
  });

  // Build a scry function using the authenticated cookie
  const scryFn: ScryFn = async ({ app, path }) => {
    const scryPath = `/~/scry/${app}${path}.json`;
    const { response, release } = await urbitFetch({
      baseUrl: params.url,
      path: scryPath,
      init: {
        method: "GET",
        headers: { Cookie: cookie },
      },
      ssrfPolicy,
      timeoutMs: 30_000,
      auditContext: "tlon-api-scry",
    });
    try {
      if (!response.ok) {
        throw new Error(`Scry failed: ${response.status} ${scryPath}`);
      }
      return await response.json();
    } finally {
      await release();
    }
  };

  const shim = createClientShim(api.poke, params.url, scryFn);
  configureClient({
    shipName: params.ship.replace(/^~/, ""),
    shipUrl: params.url,
    client: shim,
    getCode: async () => params.code,
  });

  try {
    return await fn();
  } finally {
    try {
      await api.delete();
    } catch {
      // ignore cleanup errors
    }
  }
}
