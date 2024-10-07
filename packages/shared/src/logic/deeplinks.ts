import { ContentReference } from '../api';
import { citeToPath } from '../urbit';
import { DeepLinkMetadata, getBranchLinkMeta, isLureMeta } from './branch';

export async function getReferenceFromDeeplink(
  url: string,
  branchKey: string
): Promise<{ reference: ContentReference; path: string } | null> {
  const linkMeta = await getBranchLinkMeta(url, branchKey);

  if (linkMeta && typeof linkMeta === 'object') {
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

export async function getMetadaFromInviteLink(
  url: string,
  branchKey: string
): Promise<DeepLinkMetadata | null> {
  const linkMeta = await getBranchLinkMeta(url, branchKey);
  if (linkMeta && typeof linkMeta === 'object') {
    if (isLureMeta(linkMeta)) {
      return linkMeta;
    }
  }
  return null;
}

export function createInviteLinkRegex(branchDomain: string) {
  return new RegExp(
    `^(https?://)?(${branchDomain}/|tlon\\.network/lure/)0v[^/]+$`
  );
}

export function extractNormalizedInviteLink(
  url: string,
  branchDomain: string
): string | null {
  if (!url) return null;
  const INVITE_LINK_REGEX = createInviteLinkRegex(branchDomain);
  const match = url.trim().match(INVITE_LINK_REGEX);

  if (match) {
    const parts = match[0].split('/');
    const token = parts[parts.length - 1];
    if (token) {
      return `https://${branchDomain}/${token}`;
    }
  }

  return null;
}
