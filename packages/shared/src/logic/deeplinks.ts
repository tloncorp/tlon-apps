import { ContentReference } from '../api';
import { getConstants } from '../domain';
import { citeToPath } from '../urbit';
import { AppInvite, getBranchLinkMeta, isLureMeta } from './branch';

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
  const token = extractTokenFromInviteLink(inviteLink);
  if (!token) {
    return null;
  }

  return getMetadataFromInviteToken(token);
}

export async function getMetadataFromInviteToken(token: string) {
  const env = getConstants();
  const providerResponse = await fetch(
    `${env.INVITE_PROVIDER}/lure/${token}/metadata`
  );
  if (!providerResponse.ok) {
    return null;
  }

  // fetch invite link metadata from lure provider
  const responseMeta: ProviderMetadataResponse = await providerResponse.json();
  if (
    !responseMeta.fields ||
    !responseMeta.fields.group ||
    !responseMeta.fields.inviter
  ) {
    return null;
  }

  const metadata: AppInvite = {
    id: token,
    shouldAutoJoin: true,
    inviterUserId: responseMeta.fields.inviter,
    invitedGroupId: responseMeta.fields.group,
    invitedGroupTitle: responseMeta.fields.title,
    invitedGroupDescription: responseMeta.fields.description,
    invitedGroupIconImageUrl: responseMeta.fields.image,
    inviterNickname: responseMeta.fields.inviterNickname,
    inviterAvatarImage: responseMeta.fields.inviterAvatarImage,
    inviterColor: responseMeta.fields.inviterColor,
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

  return metadata;
}

export function createInviteLinkRegex(branchDomain: string) {
  return new RegExp(
    `^(https?://)?(${branchDomain}/|tlon\\.network/lure/)0v[^/]+$`
  );
}

export function extractTokenFromInviteLink(url: string): string | null {
  const env = getConstants();
  if (!url) return null;
  const INVITE_LINK_REGEX = createInviteLinkRegex(env.BRANCH_DOMAIN);
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
  const INVITE_LINK_REGEX = createInviteLinkRegex(env.BRANCH_DOMAIN);
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
