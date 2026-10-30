import { getConstants } from '../types';
import { createDevLogger } from '../lib/logger';
import {
  isTrustedBrowserViewerHost,
  isBrowserViewerDevelopmentOrigin,
} from './browserSession';
import {
  getBrowserVaultOwnerAuthorization,
  getClientGeneration,
  onClientSessionChange,
} from './urbit';

const logger = createDevLogger('browserOwnerSession', false);
type Session = {
  token: string;
  expiresAt: number;
  idleTimeoutMs: number;
  used: number;
  botMoon: string;
};
const sessions = new Map<string, Session>();
const pending = new Map<string, Promise<Session>>();
let lastIssuedAt = 0;

export function trustedBrowserOwnerEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  const test = (host: string) =>
    host === 'test.tlon.systems' || host.endsWith('.test.tlon.systems');
  const developmentOrigin =
    process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN ||
    (typeof __DEV__ !== 'undefined' && __DEV__
      ? process.env.EXPO_PUBLIC_BROWSER_VIEWER_DEV_ORIGIN
      : undefined);
  const local = isBrowserViewerDevelopmentOrigin(url, developmentOrigin);
  if (
    (!local &&
      (url.protocol !== 'https:' ||
        url.port ||
        !isTrustedBrowserViewerHost(url.hostname) ||
        test(url.hostname) !==
          test(new URL(getConstants().API_URL).hostname))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Owner authentication requires a trusted browser host in this environment.'
    );
  }
  return url;
}

/** Configured independently of browser cards so settings work with no session. */
export function browserOwnerServiceOrigin(): string {
  const configured = getConstants().KERNEL_SERVICE_ORIGIN;
  if (!configured)
    throw new Error('Kernel service is not configured for this environment.');
  const url = trustedBrowserOwnerEndpoint(configured);
  if (url.pathname !== '/')
    throw new Error('Configure a Kernel service origin, without a path.');
  return url.origin;
}

/** Reuse a verified session for viewer/approval requests on the same service. */
export function browserOwnerSessionMoon(endpoint: string): string | undefined {
  return sessions.get(trustedBrowserOwnerEndpoint(endpoint).origin)?.botMoon;
}

export class BrowserOwnerRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string
  ) {
    super('Browser owner operation failed.');
  }
}
async function request(
  url: URL,
  method: string,
  body?: unknown,
  token?: string,
  signal?: AbortSignal
) {
  const response = await fetch(url.toString(), {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => undefined);
    throw new BrowserOwnerRequestError(response.status, result?.error);
  }
  return response.json();
}
async function revoke(origin: string, session: Session) {
  try {
    await request(
      new URL('/owner/sessions/current', origin),
      'DELETE',
      undefined,
      session.token
    );
  } catch {
    logger.trackError('Could not revoke browser owner session.');
  }
}

export function clearBrowserOwnerSessions() {
  const previous = [...sessions.entries()];
  sessions.clear();
  pending.clear();
  for (const [origin, session] of previous) void revoke(origin, session);
}
onClientSessionChange(clearBrowserOwnerSessions);

async function sessionFor(origin: string, botMoon: string): Promise<Session> {
  const cached = sessions.get(origin),
    now = Date.now();
  if (
    cached &&
    cached.expiresAt > now &&
    cached.used + cached.idleTimeoutMs > now
  )
    return cached;
  const existing = pending.get(origin);
  if (existing) return existing;
  const generation = getClientGeneration();
  const work = (async () => {
    let result!: Session;
    for (let exchange = 0; exchange < 2; exchange++) {
      // Other tabs can consume a proof with the same second-resolution expiry.
      const issuedAt = Math.max(Date.now(), lastIssuedAt + 1000);
      if (issuedAt > Date.now() + 60000)
        throw new Error('Owner authentication is busy. Try again shortly.');
      lastIssuedAt = issuedAt;
      const proof = await getBrowserVaultOwnerAuthorization(issuedAt);
      if (getClientGeneration() !== generation)
        throw new Error('Account changed.');
      try {
        result = await request(new URL('/owner/sessions', origin), 'POST', {
          planet: proof.planet,
          botMoon: botMoon.replace(/^~/, ''),
          ownerProof: proof.ownerToken,
        });
        break;
      } catch (error) {
        if (
          exchange > 0 ||
          !(error instanceof BrowserOwnerRequestError) ||
          error.status !== 409 ||
          error.code !== 'proof_already_exchanged'
        )
          throw error;
      }
    }
    if (getClientGeneration() !== generation) {
      void revoke(origin, result);
      throw new Error('Account changed.');
    }
    result.used = Date.now();
    result.botMoon = botMoon;
    sessions.set(origin, result);
    return result;
  })();
  pending.set(origin, work);
  try {
    return await work;
  } finally {
    if (pending.get(origin) === work) pending.delete(origin);
  }
}

/** The settings caller supplies its selected bot and configured service origin. */
export async function browserOwnerRequest(
  endpoint: string,
  botMoon: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  const url = trustedBrowserOwnerEndpoint(endpoint);
  if (
    !/^\/(?:owner\/credentials(?:\/[a-zA-Z0-9_-]+)?|viewer-authorize|credential-vault\/[A-Za-z0-9_-]{40,64})$/.test(
      url.pathname
    )
  ) {
    throw new Error('Unsupported browser owner operation.');
  }
  const generation = getClientGeneration();
  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await sessionFor(url.origin, botMoon);
    if (generation !== getClientGeneration() || signal?.aborted)
      throw new Error('Owner operation canceled.');
    try {
      const result = await request(url, method, body, session.token, signal);
      if (generation !== getClientGeneration())
        throw new Error('Account changed.');
      session.used = Date.now();
      return result;
    } catch (error) {
      // Only a rejected authentication can be retried. A failed mutation may
      // already have happened and must never be replayed after a network error.
      if (
        !(error instanceof BrowserOwnerRequestError) ||
        error.status !== 401 ||
        attempt > 0
      )
        throw error;
      if (sessions.get(url.origin) === session) sessions.delete(url.origin);
    }
  }
  throw new Error('Owner authentication failed.');
}
