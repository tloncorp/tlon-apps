import { useQuery } from '@tanstack/react-query';

import { getFallbackLinkMetadata, getLinkMetadata } from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { isValidUrl } from '../logic';

const logger = createDevLogger('metagrabActions', false);

export async function getLinkMetaWithFallback(url: string) {
  logger.trackEvent('Attempting metagrab link preview');
  const response = await getLinkMetadata(url);

  const failedToGetMeta =
    response.type === 'error' || response.type === 'redirect';
  const metaInsufficient =
    response.type === 'page' &&
    !response.title &&
    !response.previewImageUrl &&
    !response.description;

  if (failedToGetMeta || metaInsufficient) {
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
