import { isValidUrl, jsonFetch } from '@/logic/utils';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

const OEMBED_PROVIDER = 'https://noembed.com/embed';

export async function fetchEmbed(url: string, isMobile?: boolean) {
  if (!url || !isValidUrl(url)) return null;
  const search = new URLSearchParams({
    maxwidth: isMobile ? '320' : '600',
    url,
  });
  let embed;
  const isSpotify = url.includes('open.spotify.com');
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
