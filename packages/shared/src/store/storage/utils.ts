import { preSig } from '@urbit/api';
import { deSig, formatDa, unixToDa } from '@urbit/aura';

import { RNFile, Uploader, client, scry } from '../../api';
import { createDevLogger } from '../../debug';

const logger = createDevLogger('storage utils', true);

const fetchImageFromUri = async (uri: string, base64: string) => {
  try {
    logger.log('fetchImageFromUri', uri);
    const response = await fetch(uri);
    logger.log('fetchImageFromUri response', response);
    const blob = await response.blob();
    const name = uri.split('/').pop();

    const file: RNFile = {
      blob,
      name: name ?? 'channel-image',
      type: blob.type,
    };

    return file;
  } catch (e) {
    console.error(e);
  }
};

export const handleImagePicked = async (
  uri: string,
  base64: string,
  uploader: Uploader
) => {
  logger.log('handleImagePicked', uri, uploader);
  try {
    const image = await fetchImageFromUri(uri, base64);
    if (!image) {
      logger.log('no image');
      return;
    }

    logger.log({ image });

    await uploader?.uploadFiles([image]);
  } catch (e) {
    console.error(e);
  }
};

export const getShipInfo = async () => {
  const { ship, url } = client;

  if (!ship) {
    return { ship: '', shipUrl: '' };
  }

  return { ship: preSig(ship), shipUrl: url };
};

export const getIsHosted = async () => {
  const shipInfo = await getShipInfo();
  const isHosted = shipInfo?.shipUrl?.endsWith('tlon.network');
  return isHosted;
};

export const getHostingUploadURL = async () => {
  const isHosted = await getIsHosted();
  return isHosted ? 'https://memex.tlon.network' : '';
};

export const getMemexUploadUrl = async (ship: string, fileName: string) => {
  const presignedUrl = 'https://memex.tlon.network';
  const key = `${ship}/${deSig(formatDa(unixToDa(new Date().getTime())))}-${fileName.split(' ').join('-')}`;
  const url = `${presignedUrl}/${key}`;
  const token = await scry<string>({
    app: 'genuine',
    path: '/secret',
  }).catch((e) => {
    logger.log('failed to get secret', { e });
    return '';
  });
  return `${url}?token=${token}`;
};

export const getFinalMemexUrl = async (memexUploadUrl: string) => {
  const fileUrlResponse = await fetch(memexUploadUrl);
  const fileUrl = await fileUrlResponse.json().catch(() => {
    logger.log('Error parsing response body, fileUrlResponse');
    return '';
  });

  console.log(`final memex url`, fileUrl);

  return fileUrl;
};
