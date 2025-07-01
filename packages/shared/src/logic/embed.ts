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

export const trustedProviders = [
  {
    name: 'YouTube',
    regex:
      /^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)/,
  },
  {
    name: 'Twitter',
    regex: /^https:\/\/(?:twitter\.com|x\.com)\/\w+\/status\//,
  },
  {
    name: 'Spotify',
    regex: /^https:\/\/open\.spotify\.com\//,
  },
  {
    name: 'TikTok',
    regex: /^https:\/\/www\.tiktok\.com\//,
  },
];

export function isTrustedEmbed(
  url: string,
  providers = trustedProviders
): boolean {
  return providers.some((provider) => provider.regex.test(url));
}

export async function fetchEmbed(inputUrl: string, isMobile?: boolean) {
  if (!inputUrl || !isValidUrl(inputUrl)) return null;
  const url = transformUrl(inputUrl);

  const search = new URLSearchParams({
    maxwidth: isMobile ? '320' : '600',
    url,
  });
  const isSpotify = trustedProviders
    .filter((provider) => provider.name === 'Spotify')
    .some((provider) => provider.regex.test(url));
  const isTikTok = trustedProviders
    .filter((provider) => provider.name === 'TikTok')
    .some((provider) => provider.regex.test(url));
  const isTwitter = trustedProviders
    .filter((provider) => provider.name === 'Twitter')
    .some((provider) => provider.regex.test(url));
  const isYouTube = trustedProviders
    .filter((provider) => provider.name === 'YouTube')
    .some((provider) => provider.regex.test(url));

  if (isSpotify) {
    const urlWithoutTracker = url?.split('?')[0];
    return jsonFetch(
      `https://open.spotify.com/oembed?url=${urlWithoutTracker}`
    );
  }

  if (isTikTok) {
    return jsonFetch(`https://www.tiktok.com/oembed?url=${url}`);
  }

  if (isTwitter && isMobile) {
    return jsonFetch(`https://publish.twitter.com/oembed?url=${url}`);
  }

  if (isYouTube) {
    return jsonFetch(`https://www.youtube.com/oembed?url=${url}`);
  }

  // For other providers (none at the moment), we fall back to noembed
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
