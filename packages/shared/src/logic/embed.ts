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
interface WikipediaAPIResponse {
  query: {
    pages: {
      [key: string]: {
        title: string;
        fullurl: string;
        extract: string;
        missing?: boolean;
        thumbnail?: {
          source: string;
          width: number;
          height: number;
        };
      };
    };
  };
}

async function getWikipediaData(articleUrl: string) {
  // Parse and validate the Wikipedia URL
  let articleTitle;
  try {
    const url = new URL(articleUrl);
    if (!url.hostname.endsWith('wikipedia.org')) {
      throw new Error('Not a valid Wikipedia URL');
    }

    // Extract the article title from the URL
    // Handle both /wiki/Title and /w/index.php?title=Title formats
    if (url.pathname.startsWith('/wiki/')) {
      articleTitle = decodeURIComponent(url.pathname.slice(6));
    } else if (url.pathname.startsWith('/w/')) {
      articleTitle = url.searchParams.get('title');
    } else {
      throw new Error('Invalid Wikipedia URL format');
    }

    if (!articleTitle) {
      throw new Error('Could not extract article title from URL');
    }
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }

  // Base URL for Wikipedia's API
  const apiUrl = `https://${new URL(articleUrl).hostname}/w/api.php?action=query&format=json&prop=extracts|pageimages|info&exintro=1&explaintext=1&inprop=url&pithumbsize=1000&titles=${encodeURIComponent(articleTitle)}&origin=*`;

  try {
    const response = await fetch(apiUrl);
    const data = (await response.json()) as WikipediaAPIResponse;

    // Get the page data (first page in pages object)
    const page = Object.values(data.query.pages)[0];

    // Check if page exists
    if (page.missing) {
      throw new Error('Wikipedia article not found');
    }

    // Create an oembed-like response
    return {
      version: '1.0',
      type: 'rich',
      provider_name: 'Wikipedia',
      provider_url: 'https://www.wikipedia.org',
      title: page.title,
      url: page.fullurl,
      thumbnail_url: page.thumbnail?.source || null,
      thumbnail_width: page.thumbnail?.width || null,
      thumbnail_height: page.thumbnail?.height || null,
      description: page.extract,
      author_name: 'Wikipedia contributors',
      author_url: `${page.fullurl}?action=history`,
    };
  } catch (error) {
    throw new Error(`Failed to fetch Wikipedia data: ${error.message}`);
  }
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
  const isWikipedia = url.includes('wikipedia.org');

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

  if (isWikipedia) {
    return getWikipediaData(url);
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
