import { preSig } from '@urbit/api';

import * as api from '../../api';
import {
  RNFile,
  StorageConfiguration,
  StorageCredentials,
  client,
  scry,
} from '../../api';
import { createDevLogger } from '../../debug';
import { desig } from '../../urbit';

const logger = createDevLogger('storage utils', true);

export const fetchImageFromUri = async (
  uri: string,
  height: number,
  width: number
) => {
  try {
    const response = await fetch(uri);
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

export const getShipInfo = () => {
  const { ship, url } = client;

  if (!ship) {
    return { ship: '', shipUrl: '' };
  }

  return { ship: preSig(ship), shipUrl: url };
};

export const hasHostingUploadCreds = (
  configuration: StorageConfiguration | null,
  credentials: StorageCredentials | null
) => {
  return (
    getIsHosted() &&
    (configuration?.service === 'presigned-url' ||
      !hasCustomS3Creds(configuration, credentials))
  );
};

export const hasCustomS3Creds = (
  configuration: StorageConfiguration | null,
  credentials: StorageCredentials | null
): credentials is {
  accessKeyId: string;
  endpoint: string;
  secretAccessKey: string;
} => {
  return !!(
    credentials?.accessKeyId &&
    credentials?.endpoint &&
    credentials?.secretAccessKey
  );
};

const MEMEX_BASE_URL = 'https://memex.tlon.network';

export const getIsHosted = () => {
  const shipInfo = getShipInfo();
  const isHosted = shipInfo?.shipUrl?.endsWith('tlon.network');
  return isHosted;
};

interface MemexUploadParams {
  token: string;
  contentLength: number;
  contentType: string;
  fileName: string;
}

export const getMemexUpload = async ({
  file,
  uploadKey,
}: {
  file: api.RNFile;
  uploadKey: string;
}) => {
  const currentUser = api.getCurrentUserId();
  const token = await scry<string>({
    app: 'genuine',
    path: '/secret',
  }).catch((e) => {
    throw new Error('Failed to get secret');
  });

  const uploadParams: MemexUploadParams = {
    token,
    contentLength: file.blob.size,
    contentType: file.type,
    fileName: uploadKey,
  };

  const endpoint = `${MEMEX_BASE_URL}/v1/${desig(currentUser)}/upload`;
  const response = await fetch(`${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(uploadParams),
  });

  if (response.status !== 200) {
    logger.log(`Bad response from memex`, response.status);
    throw new Error('Bad response from memex');
  }

  const data: { url?: string; filePath?: string } | null =
    await response.json();

  if (data && data.url && data.filePath) {
    return {
      hostedUrl: data.filePath,
      uploadUrl: data.url,
    };
  } else {
    logger.log(`Invalid response from memex upload`, data);
    throw new Error('Invalid response from memex upload');
  }
};

export const getHostingUploadURL = async () => {
  const isHosted = getIsHosted();
  return isHosted ? MEMEX_BASE_URL : '';
};
