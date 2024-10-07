import { isValidPatp } from '@urbit/aura';

import { getPostInfoFromWer } from '../api/harkApi';
import { createDevLogger } from '../debug';

const logger = createDevLogger('branch', true);

const fetchBranchApi = async (path: string, init?: RequestInit) =>
  fetch(`https://api2.branch.io${path}`, init);

export const getDeepLink = async (
  alias: string,
  branchDomain: string,
  branchKey: string
) => {
  const params = new URLSearchParams();
  params.set('url', `https://${branchDomain}/${alias}`);
  params.set('branch_key', branchKey);
  const response = await fetchBranchApi(`/v1/url?${params}`);
  if (!response.ok) {
    return undefined;
  }
  const {
    data: { url },
  } = (await response.json()) as {
    data: { url: string };
  };
  return url;
};

export const getBranchLinkMeta = async (
  branchUrl: string,
  branchKey: string
) => {
  const params = new URLSearchParams();
  params.set('url', branchUrl);
  params.set('branch_key', branchKey);
  const response = await fetchBranchApi(`/v1/url?${params}`);
  if (!response.ok) {
    return undefined;
  }

  const payload = await response.json();
  if (!payload || !payload.data) {
    return undefined;
  }

  return payload.data;
};

export type DeepLinkType = 'lure' | 'wer';

export interface DeepLinkMetadata {
  inviterUserId?: string;
  inviterNickname?: string;
  inviterAvatarImage?: string;
  invitedGroupId?: string;
  invitedGroupTitle?: string;
  invitedGroupDescription?: string;
  invitedGroupIconImageUrl?: string;
  invitedGroupiconImageColor?: string;
}
export interface DeepLinkData extends DeepLinkMetadata {
  $desktop_url: string;
  $canonical_url: string;
  wer?: string;
  lure?: string;
}

export function extractLureMetadata(branchParams: any) {
  if (!branchParams || typeof branchParams !== 'object') {
    return {};
  }

  return {
    inviterUserId: branchParams.inviterUserId,
    inviterNickname: branchParams.inviterNickname,
    inviterAvatarImage: branchParams.inviterAvatarImage,
    invitedGroupId: branchParams.invitedGroupId,
    invitedGroupTitle: branchParams.invitedGroupTitle,
    invitedGroupDescription: branchParams.invitedGroupDescription,
    invitedGroupIconImageUrl: branchParams.invitedGroupIconImageUrl,
    invitedGroupiconImageColor: branchParams.invitedGroupiconImageColor,
  };
}

export function isLureMeta(input: unknown): input is DeepLinkMetadata {
  if (!input || typeof input !== 'object') {
    return false;
  }

  return 'invitedGroupId' in input;
}

export async function getDmLink(
  ship: string,
  branchDomain: string,
  branchKey: string
): Promise<string> {
  const dmPath = `dm/${ship}`;
  const fallbackUrl = `https://tlon.network/lure/~loshut-lonreg/tlon`; // for now, send to generic signup page on desktop
  const link = await createDeepLink({
    fallbackUrl,
    type: 'wer',
    path: dmPath,
    branchDomain,
    branchKey,
  });
  return link || '';
}

export const createDeepLink = async ({
  fallbackUrl,
  type,
  path,
  branchDomain,
  branchKey,
  metadata,
}: {
  fallbackUrl: string | undefined;
  type: DeepLinkType;
  path: string;
  branchDomain: string;
  branchKey: string;
  metadata?: DeepLinkMetadata;
}) => {
  if (!fallbackUrl || !path) {
    return undefined;
  }
  if (type === 'wer') {
    const parts = path.split('/');
    const isDMLure =
      parts.length === 2 && parts[0] === 'dm' && isValidPatp(parts[1]);
    if (!isDMLure && !getPostInfoFromWer(path)) {
      logger.crumb(`Invalid path: ${path}`);
      return undefined;
    }
  }

  const parsedURL = new URL(fallbackUrl);
  const token = parsedURL.pathname.split('/').pop();
  const alias = token || path.replace('~', '').replace('/', '-');
  const data: DeepLinkData = {
    $desktop_url: fallbackUrl,
    $canonical_url: fallbackUrl,
    ...(metadata ?? {}),
  };
  data['$desktop_url'] = fallbackUrl;
  data['$canonical_url'] = fallbackUrl;

  if (type === 'lure') {
    data.lure = token;
  } else {
    data.wer = path;
  }

  try {
    let url = await getDeepLink(alias, branchDomain, branchKey).catch(
      () => fallbackUrl
    );
    if (!url) {
      logger.crumb(`No existing deeplink for ${alias}, creating new one`);
      const response = await fetchBranchApi('/v1/url', {
        method: 'POST',
        body: JSON.stringify({
          branch_key: branchKey,
          alias,
          data,
        }),
      });
      if (!response.ok) {
        return fallbackUrl;
      }
      ({ url } = (await response.json()) as { url: string });
    }
    logger.crumb(`Created new deeplink: ${url}`);
    return url;
  } catch (e) {
    logger.trackError('Failed to get or create deeplink', {
      errorMessage: e?.message,
    });
    return '';
  }
};
