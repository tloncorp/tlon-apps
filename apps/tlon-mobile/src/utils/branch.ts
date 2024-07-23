import * as urbit from '@tloncorp/shared/dist/urbit';
import { isValidPatp } from 'urbit-ob';

import { BRANCH_DOMAIN, BRANCH_KEY } from '../constants';

const fetchBranchApi = async (path: string, init?: RequestInit) =>
  fetch(`https://api2.branch.io${path}`, init);

export const getDeepLink = async (alias: string) => {
  const params = new URLSearchParams();
  params.set('url', `https://${BRANCH_DOMAIN}/${alias}`);
  params.set('branch_key', BRANCH_KEY);
  const response = await fetchBranchApi(`/v1/url?${params}`);

  console.log(`/v1/url?${params}`);

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

export async function getDmLink(ship: string): Promise<string> {
  const dmPath = `dm/${ship}`;
  const fallbackUrl = `https://tlon.network/lure/~loshut-lonreg/tlon`; // for now, send to generic signup page on desktop
  const link = await createDeepLink(fallbackUrl, 'wer', dmPath);
  return link || '';
}

export const createDeepLink = async (
  fallbackUrl: string | undefined,
  type: DeepLinkType,
  path: string
) => {
  if (!fallbackUrl || !path) {
    return undefined;
  }

  if (type === 'lure' && !urbit.whomIsFlag(path)) {
    return undefined;
  }

  if (type === 'wer') {
    const [location, ship] = path.split('/');
    const locationInvalid = !location || location !== 'dm';
    const shipInvalid = !ship || !isValidPatp(ship);

    if (locationInvalid || shipInvalid) {
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

  let url = await getDeepLink(alias).catch(() => fallbackUrl);
  if (!url) {
    console.log(`No existing deeplink for ${alias}, creating new one`);
    const response = await fetchBranchApi('/v1/url', {
      method: 'POST',
      body: JSON.stringify({
        branch_key: BRANCH_KEY,
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
