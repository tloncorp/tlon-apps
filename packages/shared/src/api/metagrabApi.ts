import { formatUw } from '@urbit/aura';

import { createDevLogger } from '../debug';
import * as domain from '../domain';
import * as ub from '../urbit';
import { request } from './urbit';

const logger = createDevLogger('metagrabApi', true);

export async function getLinkMetadata(
  url: string
): Promise<domain.LinkMetadata | null> {
  const bytes = stringToBigIntForUw(url);
  const encodedUrl = formatUw(bytes);
  logger.log('encoded', { url, encodedUrl });
  const response = await request(`/apps/groups/~/metagrab/${encodedUrl}`, {
    method: 'GET',
    mode: 'cors',
  });
  logger.log('metagrab response', response);

  if (response.status !== 200) {
    logger.error(`bad metagrab response: ${response.status}`, response);
    return null;
  }

  return parseLinkMetadataResponse(url, response);
}

function parseLinkMetadataResponse(
  url: string,
  response: ub.LinkMetadataResponse
): domain.LinkMetadata | null {
  if (!response.result) {
    return null;
  }

  const result = response.result;
  if (result.type === 'page') {
    const { site_icon, site_name, title, image, description } = result;

    const siteIconUrl = site_icon?.[0]?.value;
    const siteName = site_name?.[0]?.value;
    const siteTitle = title?.[0]?.value;
    const siteDescription = result.description?.[0]?.value;
    const previewImageUrl = parseImageData(image ?? []) ?? undefined;

    const parsed: domain.LinkMetadata = {
      type: 'page',
      url,
      siteIconUrl,
      siteName,
      title: siteTitle,
      description: siteDescription,
      previewImageUrl,
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

  return null;
}

function parseImageData(data: ub.LinkMetadataItem[]): string | void {
  const index: Record<string, string> = data.reduce(
    (acc, item) => ({ ...acc, [item.namespace]: item.value }),
    {}
  );

  return index.twitter || index.og || data[0]?.value;
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
