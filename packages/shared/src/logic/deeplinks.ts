import { createDevLogger } from '../debug';
import { ContentReference, getConstants } from '../domain';
import { citeToPath } from '../urbit';
import { AppInvite, getBranchLinkMeta, isLureMeta } from './branch';
import { normalizeUrbitColor } from './utils';

const logger = createDevLogger('deeplinks', false);

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

export function createInviteLinkRegex() {
  const env = getConstants();
  return new RegExp(
    `^(https?://)?(${env.BRANCH_DOMAIN}/|tlon\\.network/lure/)0v[^/]+$`
  );
}

export function extractTokenFromInviteLink(url: string): string | null {
  if (!url) return null;
  const INVITE_LINK_REGEX = createInviteLinkRegex();
  const match = url.trim().match(INVITE_LINK_REGEX);

  if (match) {
    const parts = match[0].split('/');
    const token = parts[parts.length - 1];
    return token ?? null;
  }

  return null;
}

export function extractNormalizedInviteLink(url: string): string | null {
  if (!url) return null;
  const env = getConstants();
  const INVITE_LINK_REGEX = createInviteLinkRegex();
  const match = url.trim().match(INVITE_LINK_REGEX);

  if (match) {
    const parts = match[0].split('/');
    const token = parts[parts.length - 1];
    if (token) {
      return `https://${env.BRANCH_DOMAIN}/${token}`;
    }
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
