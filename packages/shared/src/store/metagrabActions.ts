import { useQuery } from '@tanstack/react-query';

import { getFallbackLinkMetadata, getLinkMetadata } from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import {
  fetchEmbed,
  isTrustedEmbed,
  isValidUrl,
  trustedProviders,
} from '../logic';

// YouTube oEmbed response type based on https://www.youtube.com/oembed API
interface YouTubeOEmbedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  [key: string]: unknown; // Allow other fields we don't use
}

const logger = createDevLogger('metagrabActions', false);

export async function getLinkMetaWithFallback(url: string) {
  logger.trackEvent('Attempting metagrab link preview');
  let response = await getLinkMetadata(url);

  const failedToGetMeta =
    response.type === 'error' || response.type === 'redirect';
  const metaInsufficient =
    response.type === 'page' &&
    !response.title &&
    !response.previewImageUrl &&
    !response.description;

  const twitterEmbedProvider = trustedProviders.find(
    (tp) => tp.name === 'Twitter'
  );

  const youtubeEmbedProvider = trustedProviders.find(
    (tp) => tp.name === 'YouTube'
  );

  // special case twitter links (metagrab is insufficient). Once we can proxy
  // oembed, we should instead use that
  const isTwitterUrl =
    !!twitterEmbedProvider && isTrustedEmbed(url, [twitterEmbedProvider]);

  // special case youtube links (metagrab is insufficient). Once we can proxy
  // oembed, we should instead use that.
  // Note: we can fetch oembed data on the client side for youtube links,
  // but not for twitter links (because of CORS).
  const isYouTubeUrl =
    !!youtubeEmbedProvider && isTrustedEmbed(url, [youtubeEmbedProvider]);

  if (isYouTubeUrl && response.type === 'page') {
    try {
      logger.trackEvent('Fetching YouTube oEmbed data', { url });
      const oembedData = (await fetchEmbed(
        url
      )) as YouTubeOEmbedResponse | null;

      if (oembedData?.title) {
        response = {
          ...response,
          title: oembedData.title,
          description: oembedData.author_name
            ? `by ${oembedData.author_name}`
            : response.description,
          previewImageUrl: oembedData.thumbnail_url || response.previewImageUrl,
        };
        logger.trackEvent('Enhanced YouTube metadata with oEmbed', {
          title: oembedData.title,
          author: oembedData.author_name,
        });
      }
    } catch (error) {
      logger.trackError('Failed to fetch YouTube oEmbed data', error);
    }
  }

  if (failedToGetMeta || metaInsufficient || isTwitterUrl) {
    const settings = await db.getSettings();
    const shouldUseFallback = !settings?.disableTlonInfraEnhancement;
    if (shouldUseFallback) {
      logger.trackEvent('Attempting fallback link preview', { url });
      const fallbackResponse = await getFallbackLinkMetadata(url);
      return fallbackResponse;
    }
  }

  return response;
}

export function useLinkGrabber(url: string) {
  return useQuery({
    queryKey: ['metagrab', url],
    queryFn: () => getLinkMetaWithFallback(url),
    enabled: !!url && isValidUrl(url),
  });
}
