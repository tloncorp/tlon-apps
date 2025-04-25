import { formatUv, formatUw, parseUv, parseUw } from '@urbit/aura';

import { createDevLogger } from '../debug';
import * as domain from '../domain';
import * as ub from '../urbit';
import { request } from './urbit';

const logger = createDevLogger('metagrabApi', true);

export async function getLinkMetadata(
  url: string
): Promise<domain.LinkAttachment | null> {
  const bytes = stringToBigIntForUw(url);
  const encodedUrl = formatUw(bytes);
  // const encodedUrl = '0w6lOrS.NMu6k.LomUK.pn9xb.DtTtO.YLeDd.Mt7hE';
  logger.log('bl: getLinkMetadata', url, encodedUrl);
  const response = await request(`/apps/groups/~/metagrab/${encodedUrl}`, {
    method: 'GET',
  });
  logger.log('bl: getLinkMetadata response', response);

  if (response.status !== 200) {
    logger.error('bl: getLinkMetadata error', response);
    return null;
  }

  return parseLinkMetadataResponse(response);
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

function parseLinkMetadataResponse(
  response: ub.LinkMetadataResponse
): domain.LinkAttachment | null {
  if (!response.result) {
    return null;
  }

  const { site_icon, site_name, title } = response.result;

  const icon = site_icon?.[0]?.value;
  const siteName = site_name?.[0]?.value;
  const description = title?.[0]?.value;
  const previewImageUrl = response.result.image?.[0]?.value;

  const parsed: domain.LinkAttachment = {
    type: 'link',
    icon,
    siteName,
    description,
    previewImageUrl,
  };

  logger.log('bl: parseLinkMetadataResponse', parsed);
  return parsed;
}
