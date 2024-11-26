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
    const badRequestInfo = await response.json();
    logger.trackError('branch request failed', {
      responseStatus: response.status,
      responseJson: badRequestInfo,
    });
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
    const badRequestInfo = await response.json();
    logger.trackError('branch request failed', {
      responseStatus: response.status,
      responseJson: badRequestInfo,
    });
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
  $og_title?: string;
  $og_description?: string;
  $og_image_url?: string;
  $twitter_title?: string;
  $twitter_description?: string;
  $twitter_image_url?: string;
  $twitter_card?: string;
  inviterUserId?: string;
  inviterNickname?: string;
  inviterAvatarImage?: string;
  invitedGroupId?: string;
  invitedGroupTitle?: string;
  invitedGroupDescription?: string;
  invitedGroupIconImageUrl?: string;
  invitedGroupiconImageColor?: string;
}

export interface AppInvite extends DeepLinkMetadata {
  id: string;
  shouldAutoJoin: boolean;
}

export type Lure = {
  lure: AppInvite | undefined;
  priorityToken: string | undefined;
};

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
  // Not implemented
  return '';
}

export const createDeepLink = async ({
  fallbackUrl,
  type,
  path,
  inviteServiceEndpoint,
  inviteServiceIsDev,
  metadata,
}: {
  fallbackUrl: string | undefined;
  type: DeepLinkType;
  path: string;
  inviteServiceEndpoint: string;
  inviteServiceIsDev: boolean;
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

  if (type === 'lure') {
    data.lure = token;
  } else {
    data.wer = path;
  }

  try {
    const inviteLink = await getLinkFromInviteService({
      alias,
      data,
      inviteServiceEndpoint,
      inviteServiceIsDev,
    });
    return inviteLink;
  } catch (e) {
    logger.trackError('Failed to get or create invite link', {
      errorMessage: e?.message,
    });
    return '';
  }
};

async function getLinkFromInviteService({
  alias,
  data,
  inviteServiceEndpoint,
  inviteServiceIsDev,
}: {
  alias: string;
  data: DeepLinkData;
  inviteServiceEndpoint: string;
  inviteServiceIsDev: boolean;
}): Promise<string> {
  const response = await fetch(inviteServiceEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inviteId: alias,
      data: data,
      testEnv: inviteServiceIsDev,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to get invite link from service [${response.status}]: ${alias}`
    );
  }

  const { inviteLink }: { inviteLink: string } = await response.json();
  if (!inviteLink) {
    throw new Error('Inalid invite service response');
  }

  return inviteLink;
}
