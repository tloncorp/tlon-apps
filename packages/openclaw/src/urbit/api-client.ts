import { type Urbit, setClientResolver } from '@tloncorp/api';
import { AsyncLocalStorage } from 'node:async_hooks';

import { sharedSlot } from '../shared-state.js';
import { authenticate } from './auth.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './context.js';
import { urbitFetch } from './fetch.js';
import { createHttpPokeApi } from './http-poke.js';

type PokeFn = (params: {
  app: string;
  mark: string;
  json: unknown;
}) => Promise<unknown>;
type ScryFn = (params: { app: string; path: string }) => Promise<unknown>;
type RequestJsonFn = <T>(
  path: string,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown
) => Promise<T>;

/**
 * Create the small Urbit-compatible surface used by OpenClaw's API helpers.
 */
function createClientShim(
  pokeFn: PokeFn,
  ship: string,
  shipUrl: string,
  scryFn?: ScryFn,
  requestJsonFn?: RequestJsonFn
) {
  return {
    poke: (params: { app: string; mark: string; json: unknown }) =>
      pokeFn(params),
    scryWithInfo: scryFn
      ? async <T>(params: { app: string; path: string }) => {
          const result = await scryFn(params);
          return {
            result: result as T,
            responseSizeInBytes: 0,
            responseStatus: 200,
          };
        }
      : async () => {
          throw new Error('Scry not supported on this client shim');
        },
    requestJson: requestJsonFn
      ? <T>(
          path: string,
          method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
          body?: unknown
        ) => requestJsonFn<T>(path, method, body)
      : async () => {
          throw new Error('JSON requests not supported on this client shim');
        },
    nodeId: ship ? (ship.startsWith('~') ? ship : `~${ship}`) : '',
    url: shipUrl,
  } as unknown as Urbit;
}

type ClientScope = { client: ReturnType<typeof createClientShim> | null };
const clientScopeSlot = sharedSlot<AsyncLocalStorage<ClientScope>>(
  'tlon-api-client-scope'
);
const clientScope =
  clientScopeSlot.get() ?? new AsyncLocalStorage<ClientScope>();
clientScopeSlot.set(clientScope);

// Load-order invariant: every module context that calls @tloncorp/api must
// transit this import side effect so its API copy resolves the shared scope.
// Async context follows child work, not EventEmitter listeners invoked by an
// emitter in another context; known lifecycle hooks re-enter explicitly below.
setClientResolver(() => clientScope.getStore()?.client);

/** Give one monitor its own async client slot before it creates background work. */
export function runWithTlonApiScope<T>(fn: () => Promise<T>): Promise<T> {
  return clientScope.run({ client: null }, fn);
}

export type TlonApiScopeRunner = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Capture the configured monitor scope for work invoked by a later lifecycle
 * hook. Function references alone do not retain AsyncLocalStorage context.
 */
export function captureTlonApiScope(): TlonApiScopeRunner | undefined {
  const scope = clientScope.getStore();
  if (!scope?.client) return undefined;
  return <T>(fn: () => Promise<T>) => clientScope.run(scope, fn);
}

/** Run a gateway API call through one explicit poke without changing globals. */
export function withTlonApiPoke<T>(
  pokeFn: PokeFn,
  fn: () => Promise<T>
): Promise<T> {
  const client = createClientShim(pokeFn, '', '');
  return clientScope.run({ client }, fn);
}

/**
 * Install a monitor's authenticated SSE transport in its own async scope.
 */
export function setScopedTlonApiWithPoke(
  pokeFn: PokeFn,
  ship: string,
  shipUrl: string,
  scryFn?: ScryFn,
  requestJsonFn?: RequestJsonFn
): void {
  const scope = clientScope.getStore();
  if (!scope) {
    throw new Error('Tlon API client scope not initialized');
  }
  scope.client = createClientShim(pokeFn, ship, shipUrl, scryFn, requestJsonFn);
}

/**
 * Create an authenticated HTTP-only client, run fn in its own scope, clean up.
 * Use this for one-shot outbound operations (channel.ts, actions.ts).
 * Supports both poke and scry (needed for uploadFile).
 */
export async function withAuthenticatedTlonApi<T>(
  params: {
    url: string;
    code: string;
    ship: string;
    allowPrivateNetwork?: boolean;
  },
  fn: () => Promise<T>
): Promise<T> {
  const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(
    params.allowPrivateNetwork
  );
  let cookie = await authenticate(params.url, params.code, { ssrfPolicy });

  const api = await createHttpPokeApi({
    url: params.url,
    code: params.code,
    ship: params.ship,
    allowPrivateNetwork: params.allowPrivateNetwork,
  });

  let pendingAuth: Promise<void> | null = null;
  const reauthenticate = async () => {
    if (!pendingAuth) {
      pendingAuth = authenticate(params.url, params.code, { ssrfPolicy })
        .then((nextCookie) => {
          cookie = nextCookie;
        })
        .finally(() => {
          pendingAuth = null;
        });
    }
    await pendingAuth;
  };

  const fetchAuthenticated = async (
    path: string,
    init: RequestInit,
    auditContext: string,
    reauthStatuses: readonly number[] = [403]
  ) => {
    const request = () =>
      urbitFetch({
        baseUrl: params.url,
        path,
        init: { ...init, headers: { ...init.headers, Cookie: cookie } },
        ssrfPolicy,
        timeoutMs: 30_000,
        auditContext,
      });
    let result = await request();
    if (reauthStatuses.includes(result.response.status)) {
      await result.release();
      await reauthenticate();
      result = await request();
    }
    return result;
  };

  const scryFn: ScryFn = async ({ app, path }) => {
    const scryPath = `/~/scry/${app}${path}.json`;
    const { response, release } = await fetchAuthenticated(
      scryPath,
      { method: 'GET' },
      'tlon-api-scry'
    );
    try {
      if (!response.ok) {
        throw Object.assign(
          new Error(`Scry failed: ${response.status} ${scryPath}`),
          { status: response.status }
        );
      }
      return await response.json();
    } finally {
      await release();
    }
  };

  const requestJsonFn: RequestJsonFn = async <T>(
    path: string,
    method = 'POST',
    body?: unknown
  ) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const { response, release } = await fetchAuthenticated(
      path,
      {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      'tlon-api-request-json',
      [401, 403]
    );
    try {
      const responseText = await response.text();
      if (!response.ok) {
        throw Object.assign(
          new Error(responseText || `HTTP ${response.status}`),
          {
            status: response.status,
            body: responseText,
            text: async () => responseText,
          }
        );
      }
      return responseText.trim()
        ? (JSON.parse(responseText) as T)
        : (undefined as T);
    } finally {
      await release();
    }
  };

  const shim = createClientShim(
    api.poke,
    params.ship,
    params.url,
    scryFn,
    requestJsonFn
  );

  try {
    return await clientScope.run({ client: shim }, fn);
  } finally {
    try {
      await api.delete();
    } catch {
      // ignore cleanup errors
    }
  }
}
