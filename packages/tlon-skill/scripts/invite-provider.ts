import { commandError, errorMessage } from './commands/command';
import {
  type InviteBiteResult,
  type InviteMetadataResult,
  unusableMetadataError,
} from './commands/join-invite';

// The lure provider the app uses (packages/app/lib/envVars.ts). Token
// metadata lives only in this ship's %bait state, so no scry on the user's
// own ship can stand in for these requests.
export const DEFAULT_INVITE_PROVIDER = 'https://loshut-lonreg.tlon.network';
export const INVITE_PROVIDER_ENV = 'TLON_INVITE_PROVIDER';
export const INVITE_PROVIDER_TIMEOUT_MS = 5_000;

/**
 * The only origin the CLI ever sends invite requests to. A pasted invite URL
 * contributes its token, never its host.
 */
export function resolveInviteProviderOrigin(
  env: Record<string, string | undefined>
): string {
  const raw = env[INVITE_PROVIDER_ENV];
  if (!raw) return DEFAULT_INVITE_PROVIDER;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw commandError(`${INVITE_PROVIDER_ENV} must be an http(s) URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw commandError(`${INVITE_PROVIDER_ENV} must be an http(s) URL: ${raw}`);
  }
  return url.origin;
}

export interface InviteProviderClientOptions {
  origin: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export interface InviteProviderClient {
  getMetadata: (token: string) => Promise<InviteMetadataResult>;
  bite: (token: string, ship: string) => Promise<InviteBiteResult>;
}

export function createInviteProviderClient({
  origin,
  fetchFn = fetch,
  timeoutMs = INVITE_PROVIDER_TIMEOUT_MS,
}: InviteProviderClientOptions): InviteProviderClient {
  const lureUrl = (token: string) =>
    `${origin}/lure/${encodeURIComponent(token)}`;

  const send = async (url: string, init: RequestInit): Promise<Response> => {
    try {
      return await fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw commandError(
        `Could not reach the invite service at ${origin} (${errorMessage(error)}). Try again later.`
      );
    }
  };

  const httpError = (status: number, token: string) =>
    commandError(`Invite service returned HTTP ${status} for invite ${token}.`);

  return {
    getMetadata: async (token) => {
      const response = await send(`${lureUrl(token)}/metadata`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 404) return { kind: 'not-found' };
      if (!response.ok) throw httpError(response.status, token);

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw unusableMetadataError(token);
      }
      // %bait serializes every field as a cord (lib/reel.hoon enjs-metadata),
      // including invitedGroupDeleted, which is the string 'true'.
      const fields = (body as { fields?: unknown } | null)?.fields;
      if (
        !fields ||
        typeof fields !== 'object' ||
        Array.isArray(fields) ||
        Object.values(fields).some((value) => typeof value !== 'string')
      ) {
        throw unusableMetadataError(token);
      }
      return { kind: 'found', fields: fields as Record<string, string> };
    },
    bite: async (token, ship) => {
      // %bait only accepts this exact body shape (it checks the `ship=%7E`
      // prefix), and it does not authenticate the joiner: callers must only
      // ever pass the acting ship.
      const response = await send(lureUrl(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `ship=%7E${ship.replace(/^~/, '')}`,
      });
      if (response.status === 404) return { kind: 'not-found' };
      if (!response.ok) throw httpError(response.status, token);
      return { kind: 'sent' };
    },
  };
}
