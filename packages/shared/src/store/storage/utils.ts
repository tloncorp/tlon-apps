import { preSig } from '@urbit/api';
import { deSig, formatDa, unixToDa } from '@urbit/aura';

import {
  RNFile,
  StorageConfiguration,
  StorageCredentials,
  Uploader,
  client,
  scry,
} from '../../api';
import { createDevLogger } from '../../debug';

const logger = createDevLogger('storage utils', true);

const fetchImageFromUri = async (
  uri: string,
  height: number,
  width: number
) => {
  try {
    logger.log('fetchImageFromUri', uri);
    const response = await fetch(uri);
    logger.log('fetchImageFromUri response', response);
    const blob = await response.blob();
    const name = uri.split('/').pop();

    const file: RNFile = {
      uri,
      blob,
      name: name ?? 'channel-image',
      type: blob.type,
      height,
      width,
    };

    return file;
  } catch (e) {
    console.error(e);
  }
};

export type SizedImage = { uri: string; width: number; height: number };
export const handleImagePicked = async (
  image: SizedImage,
  uploader: Uploader
) => {
  logger.log('handleImagePicked', image.uri, uploader);
  try {
    const file = await fetchImageFromUri(image.uri, image.height, image.width);
    if (!file) {
      logger.log('no image');
      return;
    }

    await uploader?.uploadFiles([file]);
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

export const hasCustomS3Creds = ({
  configuration,
  credentials,
}: {
  configuration: StorageConfiguration;
  credentials: StorageCredentials | null;
}) => {
  return (
    configuration.service === 'credentials' &&
    credentials?.accessKeyId &&
    credentials?.endpoint &&
    credentials?.secretAccessKey
  );
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

export const getMemexUploadUrl = async (key: string) => {
  const baseUrl = 'https://memex.tlon.network';
  const url = `${baseUrl}/${key}`;
  const token = await scry<string>({
    app: 'genuine',
    path: '/secret',
  }).catch((e) => {
    logger.log('failed to get secret', { e });
    return '';
  });
  return `${url}?token=${token}`;
};

export function getUploadObjectKey(ship: string, fileName: string) {
  return `${deSig(ship)}/${deSig(formatDa(unixToDa(new Date().getTime())))}-${fileName.split(' ').join('-')}`;
}

export const getFinalMemexUrl = async (memexUploadUrl: string) => {
  const fileUrlResponse = await fetch(memexUploadUrl);
  const fileUrl = await fileUrlResponse.json().catch(() => {
    logger.log('Error parsing response body, fileUrlResponse');
    return '';
  });

  console.log(`final memex url`, fileUrl);

  return fileUrl;
};
