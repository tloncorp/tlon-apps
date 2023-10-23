const fetchBranchApi = async (path: string, init?: RequestInit) =>
  fetch(`https://api2.branch.io${path}`, init);

export const getDeepLink = async (alias: string) => {
  const params = new URLSearchParams();
  params.set('url', `https://${import.meta.env.VITE_BRANCH_DOMAIN}/${alias}`);
  params.set('branch_key', import.meta.env.VITE_BRANCH_KEY);
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

export type DeeepLinkType = 'lure' | 'wer';

export const createDeepLink = async (
  fallbackUrl: string | undefined,
  type: DeeepLinkType,
  path: string
) => {
  if (!fallbackUrl) {
    return undefined;
  }

  const alias = path.replace('~', '').replace('/', '-');
  let url = await getDeepLink(alias).catch(() => fallbackUrl);
  if (!url) {
    const response = await fetchBranchApi('/v1/url', {
      method: 'POST',
      body: JSON.stringify({
        branch_key: import.meta.env.VITE_BRANCH_KEY,
        alias,
        data: {
          $desktop_url: fallbackUrl,
          $canonical_url: fallbackUrl,
          [type]: path,
        },
      }),
    });

    if (!response.ok) {
      return fallbackUrl;
    }

    ({ url } = (await response.json()) as { url: string });
  }

  return url;
};
