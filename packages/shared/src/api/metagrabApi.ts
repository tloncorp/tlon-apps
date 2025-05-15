import { formatUw } from '@urbit/aura';

import { createDevLogger } from '../debug';
import * as domain from '../domain';
import * as ub from '../urbit';
import { request } from './urbit';

const logger = createDevLogger('metagrabApi', false);

export async function getLinkMetadata(
  url: string
): Promise<domain.LinkMetadata | domain.LinkMetadataError> {
  try {
    const bytes = stringToBigIntForUw(url);
    const encodedUrl = formatUw(bytes);
    logger.log('encoded', { url, encodedUrl });
    const response = await request(`/apps/groups/~/metagrab/${encodedUrl}`, {
      method: 'GET',
      mode: 'cors',
    });
    logger.log('metagrab response', response);

    if (response.status !== 200) {
      logger.trackError(domain.AnalyticsEvent.ErrorFetchLinkMetadata, {
        message: `bad metagrab response: ${response.status}`,
        response,
      });
      return { type: 'error', reason: 'bad response' };
    }

    const parsed = parseLinkMetadataResponse(url, response);
    if (parsed.type === 'error') {
      logger.trackError(domain.AnalyticsEvent.ErrorFetchLinkMetadata, {
        message: `metagrab error: ${parsed.reason}`,
        response,
        parsedResponse: parsed,
      });
    } else {
      logger.trackEvent(domain.AnalyticsEvent.FetchLinkMetadata);
    }
    return parsed;
  } catch (error) {
    logger.trackError(domain.AnalyticsEvent.ErrorFetchLinkMetadata, error);
    return { type: 'error', reason: 'unknown error' };
  }
}

function parseLinkMetadataResponse(
  url: string,
  response: ub.LinkMetadataResponse
): domain.LinkMetadata | domain.LinkMetadataError {
  const { result } = response;
  if (!result) {
    return { type: 'redirect' };
  }

  if (typeof result === 'string') {
    logger.error(`link preview error: ${result}`);
    return { type: 'error', reason: result };
  }

  if (result.type === 'page') {
    const { site_icon, site_name, title, image, description } = result;

    const siteIconUrl = site_icon?.[0]?.value;
    const siteName = site_name?.[0]?.value;
    const siteTitle = title?.[0]?.value;
    const siteDescription = description?.[0]?.value;
    const imageData = parseImageData(url, image ?? []);

    const parsed: domain.LinkMetadata = {
      type: 'page',
      url,
      siteIconUrl,
      siteName,
      title: siteTitle,
      description: siteDescription,
      previewImageUrl: imageData.url,
      previewImageHeight: imageData.height,
      previewImageWidth: imageData.width,
    };
    logger.log(`parsed page metadata`, parsed);
    return parsed;
  }

  if (result.type === 'file') {
    const parsed: domain.LinkMetadata = {
      type: 'file',
      url,
      mime: result.mime,
      isImage: result.mime.startsWith('image/'),
    };
    return parsed;
  }

  return { type: 'error', reason: 'unknown' };
}

function grabImageUrl(url: string, data: ub.LinkMetadataItem[]) {
  return data.find((item) => {
    if (item.attributes?.secure_url) {
      return true;
    }

    if (!('attributes' in item)) {
      return true;
    }

    return !url.startsWith(item.value);
  })?.value;
}

function parseImageData(url: string, data: ub.LinkMetadataItem[]) {
  const twitter = grabImageUrl(
    url,
    data.filter((item) => item.namespace === 'twitter' && item.key === 'image')
  );
  const og = data.filter(
    (item) => item.namespace === 'og' && item.key === 'image'
  );

  // API returns the URL as the value if there isn't a value for a
  // particular set of tags aka "attributes" like image height/width
  const ogImage = grabImageUrl(url, og);
  const ogHeight = og.find((item) => item.attributes?.height)?.attributes
    ?.height;
  const ogWidth = og.find((item) => item.attributes?.width)?.attributes?.width;

  return {
    url: ogImage || twitter || data[0]?.value,
    height: ogHeight,
    width: ogWidth,
  };
}

/**
 * Converts a string to a BigInt for use with formatUw.
 * Uses UTF-8 encoding with little-endian byte order.
 *
 * @param {string} input - The string to convert
 * @returns {BigInt} - The bigint representation suitable for formatUw
 */
function stringToBigIntForUw(input: string) {
  // Convert string to UTF-8 bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);

  // Process bytes in little-endian order (least significant byte first)
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }

  return result;
}
