import * as api from '@tloncorp/api';
import { StorageConfiguration, StorageCredentials, scry } from '@tloncorp/api';
import { desig } from '@tloncorp/api/urbit';

import * as db from '../../db';
import { createDevLogger } from '../../debug';

const logger = createDevLogger('storage utils', false);

const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

export function ensureFileExtension(
  filename: string,
  contentType?: string
): string {
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|webm)$/i.test(filename)) {
    return filename;
  }

  if (contentType) {
    const ext = mimeToExt[contentType.toLowerCase()];
    if (ext) {
      return `${filename}${ext}`;
    }
  }

  return `${filename}.jpg`;
}

export function getExtensionFromMimeType(mimeType?: string): string {
  if (!mimeType) {
    return '.jpg';
  }

  return mimeToExt[mimeType.toLowerCase()] || '.jpg';
}

export type SizedImage = { uri: string; width: number; height: number };

export const hasHostingUploadCreds = (
  configuration: StorageConfiguration | null,
  credentials: StorageCredentials | null
) => {
  return (
    api.getCurrentUserIsHosted() &&
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

export async function getObjectStorageMethod(): Promise<
  'hosting' | 'custom-s3' | null
> {
  const [config, credentials] = await Promise.all([
    db.storageConfiguration.getValue(),
    db.storageCredentials.getValue(),
  ]);

  if (hasHostingUploadCreds(config, credentials)) {
    return 'hosting';
  } else if (hasCustomS3Creds(config, credentials)) {
    return 'custom-s3';
  } else {
    return null;
  }
}

const MEMEX_BASE_URL = 'https://memex.tlon.network';

export interface MemexUploadParams {
  token: string;
  contentLength: number;
  contentType: string;
  fileName: string;
}

export const getMemexUpload = async (
  params: Omit<MemexUploadParams, 'token'>
) => {
  const currentUser = api.getCurrentUserId();
  const token = await scry<string>({
    app: 'genuine',
    path: '/secret',
  }).catch((e) => {
    throw new Error('Failed to get secret');
  });

  const uploadParams: MemexUploadParams = {
    token,
    ...params,
  };

  const endpoint = `${MEMEX_BASE_URL}/v1/${desig(currentUser)}/upload`;
  const response = await fetch(`${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(uploadParams),
  });

  if (!response.ok) {
    logger.trackError('Bad response from memex', {
      status: response.status,
    });
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
    logger.trackError('Invalid response from memex upload', { data });
    throw new Error('Invalid response from memex upload');
  }
};

export interface StorageInfoResponse {
  availableBytes: number;
  totalBytes: number;
  usedBytes: number;
}

export namespace StorageInfoResponse {
  export function validate(obj: unknown): obj is StorageInfoResponse {
    return (
      obj != null &&
      typeof obj === 'object' &&
      'availableBytes' in obj &&
      'totalBytes' in obj &&
      'usedBytes' in obj &&
      typeof obj.availableBytes === 'number' &&
      typeof obj.totalBytes === 'number' &&
      typeof obj.usedBytes === 'number'
    );
  }
}

export const getStorageQuota = async (): Promise<StorageInfoResponse> => {
  const currentUser = api.getCurrentUserId();
  const token = await scry<string>({
    app: 'genuine',
    path: '/secret',
  }).catch((e) => {
    throw new Error('Failed to get secret', { cause: e });
  });

  const endpoint = `${MEMEX_BASE_URL}/v1/${desig(currentUser)}/storage-info`;
  const response = await fetch(`${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-landscape-token': token,
    },
  });

  if (!response.ok) {
    logger.trackError('Bad response status for storage quota', {
      status: response.status,
    });
    throw new Error('Expected ok response from memex, got ' + response.status);
  }

  const data: { url?: string; filePath?: string } | null =
    await response.json();

  if (StorageInfoResponse.validate(data)) {
    logger.trackEvent('Successfully retrieved storage quota info');
    return data;
  } else {
    logger.trackError('Invalid response data for storage quota', { data });
    throw new Error('Invalid response');
  }
};

export const getHostingUploadURL = async () => {
  const isHosted = api.getCurrentUserIsHosted();
  return isHosted ? MEMEX_BASE_URL : '';
};

export const downloadImageForWeb = async (uri: string) => {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || blob.type;
  const blobUrl = URL.createObjectURL(blob);

  const baseFilename =
    uri.split('/').pop()?.split('?')[0] || 'downloaded-image';
  const filename = ensureFileExtension(baseFilename, contentType);

  // Create download link and trigger click
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
};
