import { preSig } from '@urbit/api';

import { RNFile, Uploader, client } from '../../api';
import { createDevLogger } from '../../debug';

const logger = createDevLogger('storage utils', true);

const fetchImageFromUri = async (uri: string) => {
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

export const handleImagePicked = async (uri: string, uploader: Uploader) => {
  logger.log('handleImagePicked', uri, uploader);
  try {
    const image = await fetchImageFromUri(uri);
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
