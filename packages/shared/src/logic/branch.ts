import { isValidPatp } from '@urbit/aura';

import { getPostInfoFromWer } from '../api/harkApi';
import * as urbit from '../urbit';

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

export type DeepLinkType = 'lure' | 'wer';

interface DeepLinkData {
  $desktop_url: string;
  $canonical_url: string;
  lure?: string;
  wer?: string;
}

export async function getDmLink(
  ship: string,
  branchDomain: string,
  branchKey: string
): Promise<string> {
  const dmPath = `dm/${ship}`;
  const fallbackUrl = `https://tlon.network/lure/~loshut-lonreg/tlon`; // for now, send to generic signup page on desktop
  const link = await createDeepLink(
    fallbackUrl,
    'wer',
    dmPath,
    branchDomain,
    branchKey
  );
  return link || '';
}

export const createDeepLink = async (
  fallbackUrl: string | undefined,
  type: DeepLinkType,
  path: string,
  branchDomain: string,
  branchKey: string
) => {
  if (!fallbackUrl || !path) {
    return undefined;
  }
  if (type === 'lure' && !urbit.whomIsFlag(path)) {
    return undefined;
  }
  if (type === 'wer') {
    const parts = path.split('/');
    const isDMLure =
      parts.length === 2 && parts[0] === 'dm' && isValidPatp(parts[1]);
    if (!isDMLure && !getPostInfoFromWer(path)) {
      console.log(`Invalid path: ${path}`);
      return undefined;
    }
  }
  const alias = path.replace('~', '').replace('/', '-');
  const data: DeepLinkData = {
    $desktop_url: fallbackUrl,
    $canonical_url: fallbackUrl,
  };
  if (type === 'lure') {
    data.lure = path;
  } else {
    data.wer = path;
  }
  let url = await getDeepLink(alias, branchDomain, branchKey).catch(
    () => fallbackUrl
  );
  if (!url) {
    console.log(`No existing deeplink for ${alias}, creating new one`);
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
  return url;
};
