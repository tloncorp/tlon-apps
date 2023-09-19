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

export const createDeepLink = async (canonicalUrl: string, lure: string) => {
  const alias = lure.replace('~', '').replace('/', '-');
  let url = await getDeepLink(alias);
  if (!url) {
    const response = await fetchBranchApi('/v1/url', {
      method: 'POST',
      body: JSON.stringify({
        branch_key: import.meta.env.VITE_BRANCH_KEY,
        alias,
        data: {
          $desktop_url: canonicalUrl,
          $canonical_url: canonicalUrl,
          lure,
        },
      }),
    });
    if (!response.ok) {
      return undefined;
    }

    ({ url } = (await response.json()) as { url: string });
  }

  return url;
};
