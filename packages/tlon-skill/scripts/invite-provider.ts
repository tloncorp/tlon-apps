import { isGroupFlag } from './cli-utils';
import { commandError, errorMessage } from './commands/command';
import {
  type InviteBiteResult,
  type InviteMetadataFields,
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

const STRING_FIELDS = [
  'inviterUserId',
  'inviteType',
  'invitedGroupId',
] as const;

// Only the fields the CLI reads are validated, and only they are kept. %bait
// serializes every field as a cord (lib/reel.hoon enjs-metadata), so
// invitedGroupDeleted is usually the string 'true'; the app's
// ProviderMetadataResponse declares it boolean, so both are accepted.
function readMetadataFields(raw: unknown): InviteMetadataFields | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const fields: InviteMetadataFields = {};
  for (const key of STRING_FIELDS) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') return null;
    fields[key] = value;
  }
  const deleted = record.invitedGroupDeleted;
  if (deleted === true || deleted === 'true') fields.invitedGroupDeleted = true;
  else if (deleted !== undefined && deleted !== false && deleted !== 'false') {
    return null;
  }
  return fields;
}

export function createInviteProviderClient({
  origin,
  fetchFn = fetch,
  timeoutMs = INVITE_PROVIDER_TIMEOUT_MS,
}: InviteProviderClientOptions): InviteProviderClient {
  // A legacy flag-shaped token (`~ship/name`, URL-safe by its shape) keeps
  // its slash, as in the app's request; anything else is one path segment.
  const lureUrl = (token: string) =>
    `${origin}/lure/${isGroupFlag(token) ? token : encodeURIComponent(token)}`;

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

  // Errors reach tool traces unredacted, and a token the service accepts is a
  // live capability, so these messages never echo it.
  const httpError = (status: number) =>
    commandError(`Invite service returned HTTP ${status} for the invite.`);

  return {
    getMetadata: async (token) => {
      const response = await send(`${lureUrl(token)}/metadata`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 404) return { kind: 'not-found' };
      if (!response.ok) throw httpError(response.status);

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw unusableMetadataError();
      }
      const fields = readMetadataFields(
        (body as { fields?: unknown } | null)?.fields
      );
      if (!fields) throw unusableMetadataError();
      return { kind: 'found', fields };
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
      if (!response.ok) throw httpError(response.status);
      return { kind: 'sent' };
    },
  };
}
