import { render } from '@urbit/aura';
import { Atom } from '@urbit/nockjs';

import { createDevLogger } from '../debug';
import * as domain from '../domain';
import { getConstants } from '../domain';
import * as ub from '../urbit';
import { request } from './urbit';

const logger = createDevLogger('metagrabApi', false);

export async function getLinkMetadata(
  url: string
): Promise<domain.LinkMetadata | domain.LinkMetadataError> {
  try {
    const encodedUrl = render('uw', Atom.fromCord(url).number);
    logger.log('encoded', { url, encodedUrl });
    const response = await request<ub.LinkMetadataResponse>(
      `/apps/groups/~/metagrab/${encodedUrl}`,
      {
        method: 'GET',
        mode: 'cors',
      },
      10_000
    );
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

export async function getFallbackLinkMetadata(
  url: string
): Promise<domain.LinkMetadata | domain.LinkMetadataError> {
  try {
    const env = getConstants();
    const response = await fetch(`${env.INVITE_SERVICE_ENDPOINT}/linkPreview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      throw new Error(`fallback link meta bad response: ${response.status}`);
    }
    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
      throw new Error('fallback link meta payload invalid');
    }

    const meta: domain.LinkMetadata = {
      type: 'page',
      url,
      siteIconUrl: payload.siteIconUrl || '',
      siteName: payload.siteName || '',
      title: payload.title || '',
      description: payload.description || '',
      previewImageUrl: payload.previewImageUrl || '',
    };
    return meta;
  } catch (e) {
    console.log('fallback no good', e);
    logger.trackError('Failed to get fallback link metadata response', e);
    return { type: 'error', reason: 'unknown error' };
  }
}
