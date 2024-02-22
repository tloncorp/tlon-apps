import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { isValidUrl, jsonFetch } from '@/logic/utils';

const OEMBED_PROVIDER = 'https://noembed.com/embed';

function transformUrl(inputUrl: string): string {
  const url = new URL(inputUrl);
  if (url.hostname === 'x.com') {
    url.hostname = 'twitter.com';
  }

  return url.href;
}

export async function fetchEmbed(inputUrl: string, isMobile?: boolean) {
  if (!inputUrl || !isValidUrl(inputUrl)) return null;
  const url = transformUrl(inputUrl);

  const search = new URLSearchParams({
    maxwidth: isMobile ? '320' : '600',
    url,
  });
  let embed;
  const isSpotify = url.startsWith('https://open.spotify.com');
  if (isSpotify) {
    // noembed doesn't support spotify
    const urlWithoutTracker = url?.split('?')[0];
    embed = await jsonFetch(
      `https://open.spotify.com/oembed?url=${urlWithoutTracker}`
    );
    return embed;
  }

  embed = await jsonFetch(`${OEMBED_PROVIDER}?${search.toString()}`);
  return embed;
}

export function useEmbed(url: string, isMobile?: boolean) {
  const queryFn = useCallback(() => fetchEmbed(url, isMobile), [url, isMobile]);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['embed', url],
    queryFn,
  });

  return { embed: (data as any) || null, isLoading, isError, error };
}
