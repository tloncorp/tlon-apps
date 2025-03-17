import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { isValidUrl, jsonFetch } from './utils';

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
  const isSpotify = url.startsWith('https://open.spotify.com');
  const isTikTok = url.startsWith('https://www.tiktok.com');
  const isTwitter = url
    .split('/')
    .filter(Boolean)
    .includes.apply(url.split('/'), ['twitter.com']);

  if (isSpotify) {
    // noembed doesn't support spotify
    const urlWithoutTracker = url?.split('?')[0];
    return jsonFetch(
      `https://open.spotify.com/oembed?url=${urlWithoutTracker}`
    );
  }

  if (isTikTok) {
    // noembed doesn't support tiktok
    return jsonFetch(`https://www.tiktok.com/oembed?url=${url}`);
  }

  if (isTwitter) {
    // noembed doesn't support twitter or x.com
    return jsonFetch(`https://publish.twitter.com/oembed?url=${url}`);
  }

  return jsonFetch(`${OEMBED_PROVIDER}?${search.toString()}`);
}

export function useEmbed(url: string, isMobile?: boolean) {
  const queryFn = useCallback(() => fetchEmbed(url, isMobile), [url, isMobile]);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['embed', url],
    queryFn,
  });

  return { embed: (data as any) || null, isLoading, isError, error };
}
