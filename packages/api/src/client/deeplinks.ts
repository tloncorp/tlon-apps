import { AppInvite, getBranchLinkMeta, isLureMeta } from '../client/branch';
import { createDevLogger } from '../lib/logger';
import { getConstants } from '../types/constants';
import type { ContentReference } from '../types/references';
import { citeToPath } from '../urbit';
import { whomIsFlag } from '../urbit/utils';
import { normalizeUrbitColor } from './utils';

const logger = createDevLogger('deeplinks', false);

// the domain new links are written and displayed with. parsing continues
// accepting every known host so existing join.tlon.io links remain valid
export const CANONICAL_INVITE_HOST = 'invite.tlon.io';

// bare lowercase hostnames; the configured branch domain joins at parse time
const KNOWN_INVITE_HOSTS = new Set([
  'join.tlon.io',
  'invite.tlon.io',
  'serverless-infra.vercel.app',
  'sa96e.app.link',
  'sa96e-alternate.app.link',
  'sa96e.test-app.link',
  'sa96e-alternate.test-app.link',
]);
const DM_INVITE_PREFIX = 'dm-';

type ParsedInviteDeepLink =
  | { type: 'lure'; token: string }
  | { type: 'wer'; wer: string };

interface InviteDeepLinkParseOptions {
  branchDomain?: string;
}

export async function getReferenceFromDeeplink({
  deepLink,
}: {
  deepLink: string;
  branchKey: string;
  branchDomain: string;
}): Promise<{ reference: ContentReference; path: string } | null> {
  const linkMeta = await getInviteLinkMeta({
    inviteLink: deepLink,
  });

  if (linkMeta && typeof linkMeta === 'object') {
    // TODO: handle personal invite links
    if (isLureMeta(linkMeta) && linkMeta.invitedGroupId) {
      return {
        reference: {
          type: 'reference',
          referenceType: 'group',
          groupId: linkMeta.invitedGroupId,
        },
        path: citeToPath({ group: linkMeta.invitedGroupId }),
      };
    }
  }

  return null;
}

interface ProviderMetadataResponse {
  fields: {
    inviteType?: 'user' | 'group';
    inviterUserId?: string;
    inviterNickname?: string;
    inviterAvatarImage?: string;
    inviterColor?: string;
    invitedGroupId?: string;
    invitedGroupTitle?: string;
    invitedGroupDescription?: string;
    invitedGroupIconImageUrl?: string;
    invitedGroupDeleted?: boolean;
  };
}

export async function getInviteLinkMeta({
  inviteLink,
}: {
  inviteLink: string;
}): Promise<AppInvite | null> {
  const token = extractTokenFromInviteLink(inviteLink);
  if (!token) {
    return null;
  }

  return getMetadataFromInviteToken(token);
}

// flag-style v1 lures carry the inviter and group in the token itself —
// the same derivation extractLureMetadata applies to slash lures, used
// here whenever the provider has no first-party metadata for the token.
// some callers (e.g. useInviteParam) pass raw query tokens that never go
// through parseInviteDeepLink, so the shape is validated here too
function flagTokenFallback(token: string): AppInvite | null {
  if (!whomIsFlag(token)) {
    return null;
  }
  const [ship] = token.split('/');
  return {
    id: token,
    shouldAutoJoin: true,
    inviterUserId: ship,
    invitedGroupId: token,
  };
}

export async function getMetadataFromInviteToken(token: string) {
  const env = getConstants();
  logger.log('getting metadata for invite token', {
    token,
    inviteProvider: env.INVITE_PROVIDER,
  });

  let providerResponse = null;
  try {
    providerResponse = await fetch(
      `${env.INVITE_PROVIDER}/lure/${token}/metadata`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    logger.trackError('failed to fetch invite metadata', {
      inviteToken: token,
      errorMessage: e.toString(),
    });
  }
  if (!providerResponse?.ok) {
    return flagTokenFallback(token);
  }

  let responseMeta: ProviderMetadataResponse | null = null;
  try {
    const json = await providerResponse.json();
    logger.log(`provider response for token ${token}`, {
      status: providerResponse.status,
      json,
    });
    responseMeta = json as ProviderMetadataResponse;
  } catch (e) {
    logger.trackError('failed to parse provider response', {
      inviteToken: token,
      errorMessage: e.toString(),
    });
    return flagTokenFallback(token);
  }

  if (
    !responseMeta.fields ||
    !responseMeta.fields.inviterUserId ||
    // personal invite links post inviteType 'user' with an empty
    // invitedGroupId (createPersonalInviteLinkOnService), and the provider
    // serves posted fields verbatim — only group invites need a group
    (!responseMeta.fields.invitedGroupId &&
      responseMeta.fields.inviteType !== 'user')
  ) {
    return flagTokenFallback(token);
  }

  const metadata: AppInvite = {
    id: token,
    shouldAutoJoin: true,
    inviterUserId: responseMeta.fields.inviterUserId,
    invitedGroupId: responseMeta.fields.invitedGroupId,
    invitedGroupTitle: responseMeta.fields.invitedGroupTitle,
    invitedGroupDescription: responseMeta.fields.invitedGroupDescription,
    invitedGroupIconImageUrl: responseMeta.fields.invitedGroupIconImageUrl,
    inviterNickname: responseMeta.fields.inviterNickname,
    inviterAvatarImage: responseMeta.fields.inviterAvatarImage,
    inviterColor: responseMeta.fields.inviterColor
      ? normalizeUrbitColor(responseMeta.fields.inviterColor) ?? undefined
      : undefined,
    inviteType: responseMeta.fields.inviteType,
  };

  // some links might not have everything, try to extend with branch (fine if fails)
  if (!metadata.inviterNickname) {
    try {
      const branchMeta = await getBranchLinkMeta(
        `${env.BRANCH_DOMAIN}/${token}`,
        env.BRANCH_KEY
      );
      if (branchMeta) {
        if (branchMeta.inviterNickname && !metadata.inviterNickname) {
          metadata.inviterNickname = branchMeta.inviterNickname;
        }
        if (branchMeta.inviterAvatarImage && !metadata.inviterAvatarImage) {
          metadata.inviterAvatarImage = branchMeta.inviterAvatarImage;
        }
      }
    } catch (e) {
      console.error('Failed to fetch branch metadata. Ignoring', e);
    }
  }

  logger.trackEvent('successfully fetched invite metadata', {
    inviteToken: token,
  });

  return metadata;
}

function normalizeHost(host: string) {
  return host
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function parseUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function getTokenFromPath(pathname: string) {
  const path = pathname.replace(/^\/+|\/+$/g, '');
  if (!path) {
    return null;
  }

  if (/^0v[^/]+$/.test(path)) {
    return path;
  }

  if (path.startsWith('~')) {
    return whomIsFlag(path) ? path : null;
  }

  return null;
}

function getConfiguredBranchDomain() {
  try {
    return getConstants().BRANCH_DOMAIN;
  } catch {
    return undefined;
  }
}

export function parseInviteDeepLink(
  input: string,
  options: InviteDeepLinkParseOptions = {}
): ParsedInviteDeepLink | null {
  const parsed = parseUrl(input);
  if (!parsed) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (host === 'tlon.network' && parsed.pathname.startsWith('/lure/')) {
    const token = getTokenFromPath(parsed.pathname.replace(/^\/lure\//, ''));
    return token ? { type: 'lure', token } : null;
  }

  const branchDomain = options.branchDomain ?? getConfiguredBranchDomain();
  if (
    !KNOWN_INVITE_HOSTS.has(host) &&
    (!branchDomain || host !== normalizeHost(branchDomain))
  ) {
    return null;
  }

  const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
  if (path.startsWith(DM_INVITE_PREFIX)) {
    const ship = path.slice(DM_INVITE_PREFIX.length);
    return ship ? { type: 'wer', wer: `dm/${ship}` } : null;
  }

  const token = getTokenFromPath(path);
  return token ? { type: 'lure', token } : null;
}

// deferred-install payloads arrive as a raw token (our referrer default),
// a key=value referrer string, or a full invite url (our clipboard default) —
// organic-install referrers (utm noise) and arbitrary clipboard contents
// must come back null
export function inviteUrlFromDeferredPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) {
    return null;
  }

  if (/^0v[^/\s]+$/.test(trimmed) || whomIsFlag(trimmed)) {
    return `https://${CANONICAL_INVITE_HOST}/${trimmed}`;
  }

  const tokenParam = trimmed.match(/(?:^|[?&])token=([^&\s]+)/);
  if (tokenParam) {
    return inviteUrlFromDeferredPayload(decodeURIComponent(tokenParam[1]));
  }

  return parseInviteDeepLink(trimmed) ? trimmed : null;
}

export function extractTokenFromInviteLink(url: string): string | null {
  const parsed = parseInviteDeepLink(url);
  return parsed?.type === 'lure' ? parsed.token : null;
}

export function extractNormalizedInviteLink(url: string): string | null {
  const parsed = parseInviteDeepLink(url);

  if (parsed?.type === 'lure') {
    return `https://${CANONICAL_INVITE_HOST}/${parsed.token}`;
  }

  return null;
}

interface ShortcodeInvite {
  inviteId: string;
  title: string;
}

export async function getInviteShortcode(
  input: string,
  context: { telemetryId?: string } = {}
): Promise<ShortcodeInvite | null> {
  const env = getConstants();

  const normalizedInput = input.toLowerCase().trim();
  const response = await fetch(
    `${env.INVITE_SERVICE_ENDPOINT}/checkInviteShortcode`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shortcode: normalizedInput,
        telemetryId: context.telemetryId,
      }),
    }
  );

  if (response.ok) {
    const payload = (await response.json()) as ShortcodeInvite;
    return payload;
  } else {
    if (response.status !== 404) {
      logger.trackError('checked shortcode, unexpected response', {
        shortcode: normalizedInput,
        status: response.status,
        statusText: response.statusText,
      });
    }
  }

  return null;
}

export async function checkInputForInvite(
  input: string,
  context: { telemetryId?: string } = {}
): Promise<AppInvite | null> {
  // first, check if it's an invite link
  const extractedLink = extractNormalizedInviteLink(input);
  if (extractedLink) {
    const appInvite = await getInviteLinkMeta({ inviteLink: extractedLink });
    if (appInvite) {
      return appInvite;
    } else {
      logger.trackError('Failed to find invite for invite link regex match', {
        input,
        inviteLink: extractedLink,
      });
    }
  } else if (input.length >= 4) {
    logger.trackEvent('Checking user input for invite', { input });
    // if not, check for valid shortcode
    const normalizedShortcode = input.toLowerCase().trim();
    const shortcodeInvite = await getInviteShortcode(
      normalizedShortcode,
      context
    );
    if (shortcodeInvite) {
      const appInvite = await getMetadataFromInviteToken(
        shortcodeInvite.inviteId
      );
      if (appInvite) {
        return appInvite;
      } else {
        logger.trackError('Failed to find invite meta for shortcode', {
          shortcode: normalizedShortcode,
          inviteId: shortcodeInvite.inviteId,
        });
      }
    }
  }
  return null;
}
