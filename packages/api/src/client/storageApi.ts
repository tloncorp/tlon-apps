import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { da, render } from '@urbit/aura';

import { createDevLogger } from '../lib/logger';
import { desig } from '../lib/urbit';
import { StorageCredentials } from '../urbit';
import * as ub from '../urbit';
import { StorageConfiguration } from './upload';
import {
  getCurrentUserId,
  getCurrentUserIsHosted,
  scry,
  subscribe,
} from './urbit';

const logger = createDevLogger('storageApi', false);

export type StorageUpdateCredentials = ub.StorageUpdateCredentials & {
  type: 'storageCredentialsChanged';
};

export type StorageUpdateConfiguration = ub.StorageUpdateConfiguration & {
  type: 'storageCongfigurationChanged';
};

export type StorageUpdateCurrentBucket = ub.StorageUpdateCurrentBucket & {
  type: 'storageCurrentBucketChanged';
};

export type StorageUpdateAddBucket = ub.StorageUpdateAddBucket & {
  type: 'storageBucketAdded';
};

export type StorageUpdateRemoveBucket = ub.StorageUpdateRemoveBucket & {
  type: 'storageBucketRemoved';
};

export type StorageUpdateEndpoint = ub.StorageUpdateEndpoint & {
  type: 'storageEndpointChanged';
};

export type StorageUpdateAccessKeyId = ub.StorageUpdateAccessKeyId & {
  type: 'storageAccessKeyIdChanged';
};

export type StorageUpdateSecretAccessKey = ub.StorageUpdateSecretAccessKey & {
  type: 'storageSecretAccessKeyChanged';
};

export type StorageUpdateRegion = ub.StorageUpdateRegion & {
  type: 'storageRegionChanged';
};

export type StorageUpdateSetPresignedUrl = ub.StorageUpdateSetPresignedUrl & {
  type: 'storagePresignedUrlChanged';
};

export type StorageUpdateToggleService = ub.StorageUpdateToggleService & {
  type: 'storageServiceToggled';
};

export type StorageEventUnknown = {
  type: 'storageEventUnknown';
  data: unknown;
};

export type StorageUpdate =
  | StorageUpdateCredentials
  | StorageUpdateConfiguration
  | StorageUpdateCurrentBucket
  | StorageUpdateAddBucket
  | StorageUpdateRemoveBucket
  | StorageUpdateEndpoint
  | StorageUpdateAccessKeyId
  | StorageUpdateSecretAccessKey
  | StorageUpdateRegion
  | StorageUpdateToggleService
  | StorageUpdateSetPresignedUrl
  | StorageEventUnknown;

export const subscribeToStorageUpdates = async (
  eventHandler: (update: StorageUpdate) => void
) => {
  subscribe<ub.StorageUpdate>({ app: 'storage', path: '/all' }, (e) => {
    eventHandler(toStorageUpdate(e));
  });
};

function toStorageUpdate(e: ub.StorageUpdate): StorageUpdate {
  if ('credentials' in e) {
    return { type: 'storageCredentialsChanged', ...e };
  } else if ('configuration' in e) {
    return { type: 'storageCongfigurationChanged', ...e };
  } else if ('setCurrentBucket' in e) {
    return { type: 'storageCurrentBucketChanged', ...e };
  } else if ('addBucket' in e) {
    return { type: 'storageBucketAdded', ...e };
  } else if ('removeBucket' in e) {
    return { type: 'storageBucketRemoved', ...e };
  } else if ('setEndpoint' in e) {
    return { type: 'storageEndpointChanged', ...e };
  } else if ('setAccessKeyId' in e) {
    return { type: 'storageAccessKeyIdChanged', ...e };
  } else if ('setSecretAccessKey' in e) {
    return { type: 'storageSecretAccessKeyChanged', ...e };
  } else if ('setRegion' in e) {
    return { type: 'storageRegionChanged', ...e };
  } else if ('toggleService' in e) {
    return { type: 'storageServiceToggled', ...e };
  } else if ('setPresignedUrl' in e) {
    return { type: 'storagePresignedUrlChanged', ...e };
  } else {
    return { type: 'storageEventUnknown', data: e };
  }
}

export const getStorageConfiguration =
  async (): Promise<StorageConfiguration> => {
    const configuration = await scry<{
      'storage-update': StorageUpdateConfiguration;
    }>({
      app: 'storage',
      path: '/configuration',
    });
    return configuration['storage-update'].configuration;
  };

export const getStorageCredentials = async (): Promise<StorageCredentials> => {
  const credentials = await scry<{
    'storage-update': StorageUpdateCredentials;
  }>({
    app: 'storage',
    path: '/credentials',
  });
  return credentials['storage-update'].credentials;
};

const MEMEX_BASE_URL = 'https://memex.tlon.network';

const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

function getExtensionFromMimeType(mimeType?: string): string {
  if (!mimeType) return '.jpg';
  return mimeToExt[mimeType.toLowerCase()] || '.jpg';
}

function hasCustomS3Creds(
  credentials: StorageCredentials | null
): credentials is StorageCredentials {
  return !!(
    credentials?.accessKeyId &&
    credentials?.endpoint &&
    credentials?.secretAccessKey
  );
}

export interface UploadFileParams {
  blob: Blob;
  fileName?: string;
  contentType?: string;
}

export interface UploadResult {
  url: string;
}

export async function uploadFile(
  params: UploadFileParams
): Promise<UploadResult> {
  const [config, credentials] = await Promise.all([
    getStorageConfiguration(),
    getStorageCredentials(),
  ]);

  const contentType =
    params.contentType || params.blob.type || 'application/octet-stream';
  const extension = getExtensionFromMimeType(contentType);
  const fileName = params.fileName || `upload${extension}`;

  const currentUser = getCurrentUserId();
  const fileKey = `${desig(currentUser)}/${desig(
    render('da', da.fromUnix(Date.now()))
  )}-${fileName}`;

  logger.log('uploading file', {
    fileKey,
    contentType,
    size: params.blob.size,
  });

  const isHosted = getCurrentUserIsHosted();
  const useMemex =
    isHosted &&
    (config.service === 'presigned-url' || !hasCustomS3Creds(credentials));

  if (useMemex) {
    const { hostedUrl, uploadUrl } = await getMemexUploadUrl({
      contentLength: params.blob.size,
      contentType,
      fileName: fileKey,
    });

    await fetch(uploadUrl, {
      method: 'PUT',
      body: params.blob,
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': contentType,
      },
    }).then((res) => {
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    });

    return { url: hostedUrl };
  }

  if (!hasCustomS3Creds(credentials)) {
    throw new Error('No storage credentials configured');
  }

  const endpointUrl = prefixEndpoint(credentials.endpoint);
  const client = new S3Client({
    // AWS SDK v3 can mis-reconstruct object-form endpoints for custom S3
    // providers, so keep this as a normalized string URL.
    endpoint: endpointUrl,
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    forcePathStyle: true,
  });

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600',
    'x-amz-acl': 'public-read',
  };

  const command = new PutObjectCommand({
    Bucket: config.currentBucket,
    Key: fileKey,
    ContentType: headers['Content-Type'],
    CacheControl: headers['Cache-Control'],
    ACL: 'public-read',
  });

  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: 3600,
    signableHeaders: new Set(Object.keys(headers)),
  });

  const isDigitalOcean = signedUrl.includes('digitaloceanspaces.com');

  await fetch(signedUrl, {
    method: 'PUT',
    body: params.blob,
    headers: isDigitalOcean ? headers : undefined,
  }).then((res) => {
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  });

  const publicUrl = config.publicUrlBase
    ? new URL(fileKey, config.publicUrlBase).toString()
    : signedUrl.split('?')[0];

  return { url: publicUrl };
}

function prefixEndpoint(endpoint: string): string {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}

async function getMemexUploadUrl(params: {
  contentLength: number;
  contentType: string;
  fileName: string;
}): Promise<{ hostedUrl: string; uploadUrl: string }> {
  const currentUser = getCurrentUserId();
  const token = await scry<string>({
    app: 'genuine',
    path: '/secret',
  });

  const endpoint = `${MEMEX_BASE_URL}/v1/${desig(currentUser)}/upload`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...params }),
  });

  if (!response.ok) {
    throw new Error(`Memex upload request failed: ${response.status}`);
  }

  const data: { url?: string; filePath?: string } | null =
    await response.json();
  if (!data?.url || !data?.filePath) {
    throw new Error('Invalid response from Memex');
  }

  return { hostedUrl: data.filePath, uploadUrl: data.url };
}
