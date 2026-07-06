import { AppInvite, getBranchLinkMeta, isLureMeta } from '../client/branch';
import { createDevLogger } from '../lib/logger';
import { getConstants } from '../types/constants';
import type { ContentReference } from '../types/references';
import { citeToPath } from '../urbit';
import { normalizeUrbitColor } from './utils';

const logger = createDevLogger('deeplinks', false);

const DEFAULT_INVITE_DOMAINS = ['join.tlon.io', 'invite.tlon.io'];
const DEFAULT_APP_LINK_DOMAINS = [
  'sa96e.app.link',
  'sa96e-alternate.app.link',
  'sa96e.test-app.link',
  'sa96e-alternate.test-app.link',
];
const DM_INVITE_PREFIX = 'dm-';

type ParsedInviteDeepLink =
  | { type: 'lure'; token: string }
  | { type: 'wer'; wer: string };

interface InviteDeepLinkParseOptions {
  branchDomain?: string;
  inviteDomains?: string[];
  appLinkDomains?: string[];
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
    return null;
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
    return null;
  }

  if (
    !responseMeta.fields ||
    !responseMeta.fields.invitedGroupId ||
    !responseMeta.fields.inviterUserId
  ) {
    return null;
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

function getInviteHosts(options: InviteDeepLinkParseOptions = {}) {
  const hosts = [
    ...(options.inviteDomains ?? DEFAULT_INVITE_DOMAINS),
    ...(options.appLinkDomains ?? DEFAULT_APP_LINK_DOMAINS),
    options.branchDomain,
  ];

  return new Set(
    hosts
      .filter((host): host is string => Boolean(host))
      .map((host) =>
        host
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '')
          .toLowerCase()
      )
  );
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

  if (/^~[a-z-]+\/[^/]+(?:\/[^/]+)*$/i.test(path)) {
    return path;
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
  const inviteHosts = getInviteHosts(options);

  if (host === 'tlon.network' && parsed.pathname.startsWith('/lure/')) {
    const token = getTokenFromPath(parsed.pathname.replace(/^\/lure\//, ''));
    return token ? { type: 'lure', token } : null;
  }

  if (!inviteHosts.has(host)) {
    return null;
  }

  const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
  if (path.startsWith(DM_INVITE_PREFIX)) {
    const ship = path.slice(DM_INVITE_PREFIX.length);
    return ship ? { type: 'wer', wer: `dm/${ship}` } : null;
  }

  const token = getTokenFromPath(parsed.pathname);
  return token ? { type: 'lure', token } : null;
}

function getInviteLinkPattern() {
  const hosts = Array.from(
    getInviteHosts({ branchDomain: getConfiguredBranchDomain() })
  )
    .map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  return `(?:${hosts}|tlon\\.network/lure)`;
}

export function createInviteLinkRegex() {
  return new RegExp(
    `^(https?://)?${getInviteLinkPattern()}/(?:0v[^/\\s]+|~[a-z-]+/\\S+)$`,
    'i'
  );
}

export function extractTokenFromInviteLink(url: string): string | null {
  const parsed = parseInviteDeepLink(url, {
    branchDomain: getConfiguredBranchDomain(),
  });
  return parsed?.type === 'lure' ? parsed.token : null;
}

export function extractNormalizedInviteLink(url: string): string | null {
  const env = getConstants();
  const parsed = parseInviteDeepLink(url, { branchDomain: env.BRANCH_DOMAIN });

  if (parsed?.type === 'lure') {
    return `https://${env.BRANCH_DOMAIN}/${parsed.token}`;
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
