import { createDevLogger } from '@tloncorp/shared/dist';
import { RNFile, Uploader } from '@tloncorp/shared/dist/api';

import type { ShipInfo } from '../../contexts/ship';
import storage from '../../lib/storage';

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

const getShipInfo = async () => {
  const shipInfo = (await storage.load({ key: 'store' })) as
    | ShipInfo
    | undefined;

  return shipInfo;
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
