import { ContentReference } from '../api';
import { createDevLogger } from '../debug';
import { getConstants } from '../domain';
import { citeToPath, whomIsFlag } from '../urbit';
import { AppInvite, getBranchLinkMeta, isLureMeta } from './branch';
import { getFlagParts } from './utils';

const logger = createDevLogger('deeplink', false);

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
    image?: string;
    title?: string;
    cover?: string;
    description?: string;
    group?: string;
    inviter?: string;
    inviterNickname?: string;
    inviterAvatarImage?: string;
    inviterColor?: string;
    inviteType?: 'user' | 'group';
  };
}

export async function getInviteLinkMeta({
  inviteLink,
}: {
  inviteLink: string;
}): Promise<AppInvite | null> {
  const token = extractInviteIdFromInviteLink(inviteLink);
  if (!token) {
    return null;
  }

  console.log(`token`, token);

  const providerResponse = await fetch(
    `https://loshut-lonreg.tlon.network/lure/${token}/metadata`
  );

  console.log(`providerResponse`, providerResponse);

  if (!providerResponse.ok) {
    return null;
  }

  // fetch invite link metadata from lure provider
  const response: ProviderMetadataResponse = await providerResponse.json();
  if (!response || !response.fields || typeof response.fields !== 'object') {
    return null;
  }
  const fields = response.fields;

  if (fields.group && fields.inviter) {
    // new style invite link, get as much metadata as we can
    const metadata: AppInvite = {
      id: token,
      inviterUserId: fields.inviter,
      invitedGroupId: fields.group,
      invitedGroupTitle: fields.title,
      invitedGroupDescription: fields.description,
      invitedGroupIconImageUrl: fields.image,
      inviterNickname: fields.inviterNickname,
      inviterAvatarImage: fields.inviterAvatarImage,
      inviterColor: fields.inviterColor,
      inviteType: fields.inviteType,
    };

    // some links might not have everything, try to extend with branch (fine if fails)
    if (!metadata.inviterNickname) {
      try {
        const branchMeta = await getBranchLinkMeta(inviteLink);
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

    return metadata;
  }

  if (whomIsFlag(token)) {
    const flag = getFlagParts(token);
    // legacy invite link, use what we have
    const metadata: AppInvite = {
      id: token,
      inviterUserId: flag.ship,
      invitedGroupId: token,
      invitedGroupTitle: fields.title,
      invitedGroupIconImageUrl: fields.image || fields.cover,
      isLegacy: true,
    };
    return metadata;
  }

  return null;
}

// new style invite links
export function createTokenInviteLinkRegex() {
  const env = getConstants();
  return new RegExp(
    `^(https?://)?(${env.BRANCH_DOMAIN}/|tlon\\.network/lure/)0v[^/]+$`
  );
}

// old style invite links
export function createLegacyInviteLinkRegex() {
  const env = getConstants();
  return new RegExp(
    `^(https?://)?(${env.BRANCH_DOMAIN}/|tlon\\.network/lure/)~[a-zA-Z0-9-]+/[a-zA-Z0-9-]+$`
  );
}

// either new or old style invite links
export function createInviteLinkRegex() {
  const env = getConstants();
  return new RegExp(
    `^(https?://)?(${env.BRANCH_DOMAIN}/|tlon\\.network/lure/)(0v[^/]+|~[a-zA-Z0-9-]+/[a-zA-Z0-9-]+)$`
  );
}

export function extractInviteIdFromInviteLink(url: string): string | null {
  try {
    if (!url) return null;
    const INVITE_LINK_REGEX = createInviteLinkRegex();
    const match = url.trim().match(INVITE_LINK_REGEX);

    // first check for new @uv style invite token
    if (match) {
      const parts = match[0].split('/');
      const token = parts[parts.length - 1];
      return token ?? null;
    } else {
      // otherwise, look for legacy flag invite
      const LEGACY_INVITE_LINK_REGEX = createLegacyInviteLinkRegex();
      const legacyMatch = url.trim().match(LEGACY_INVITE_LINK_REGEX);
      if (legacyMatch) {
        console.log(`got a legacy match`, legacyMatch);
        const parts = legacyMatch[0].split('/');
        const token = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        return token ?? null;
      }
    }

    return null;
  } catch (err) {
    logger.trackError('Error Extracting Invite', {
      url,
      errorMessage: err.message,
    });
    return null;
  }
}

export function extractNormalizedInviteLink(url: string): string | null {
  if (!url) return null;
  const env = getConstants();
  const inviteId = extractInviteIdFromInviteLink(url);

  if (inviteId) {
    return `https://${env.BRANCH_DOMAIN}/${inviteId}`;
  }

  return null;
}
