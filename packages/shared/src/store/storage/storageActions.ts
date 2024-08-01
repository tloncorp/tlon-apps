import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { deSig, unixToDa } from '@urbit/api';
import { formatDa } from '@urbit/aura';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync } from 'expo-image-manipulator';
import { ImagePickerAsset } from 'expo-image-picker';

import { getCurrentUserId } from '../../api';
import * as db from '../../db';
import { createDevLogger, escapeLog } from '../../debug';
import { setUploadState } from './storageUploadState';
import {
  fetchImageFromUri,
  getMemexUpload,
  hasCustomS3Creds,
  hasHostingUploadCreds,
} from './storageUtils';

const logger = createDevLogger('storageActions', true);

export const uploadAsset = async (asset: ImagePickerAsset) => {
  logger.crumb('uploading asset', asset.mimeType, asset.fileSize);
  logger.log('full asset', asset);
  setUploadState(asset.uri, { status: 'uploading', localUri: asset.uri });
  try {
    const remoteUri = await performUpload(asset);
    logger.crumb('upload succeeded');
    logger.log('final uri', remoteUri);
    setUploadState(asset.uri, { status: 'success', remoteUri });
  } catch (e) {
    logger.crumb('upload failed');
    console.error(e);
    setUploadState(asset.uri, { status: 'error', errorMessage: e.message });
  }
};

const performUpload = async (asset: ImagePickerAsset) => {
  const [config, credentials] = await Promise.all([
    db.getStorageConfiguration(),
    db.getStorageCredentials(),
  ]);

  if (!credentials || !config) {
    throw new Error('unable to upload: missing storage configuration');
  }

  logger.log('resizing asset', asset.uri);
  const resizedAsset = await manipulateAsync(
    asset.uri,
    [
      {
        resize: asset.width > asset.height ? { width: 1200 } : { height: 1200 },
      },
    ],
    { compress: 0.75 }
  );

  const fileKey = `${getCurrentUserId()}/${deSig(
    formatDa(unixToDa(new Date().getTime()))
  )}-${resizedAsset.uri.split('/').pop()}`;
  logger.log('asset key:', fileKey);

  if (hasHostingUploadCreds(config, credentials)) {
    const file = await fetchImageFromUri(
      resizedAsset.uri,
      resizedAsset.height,
      resizedAsset.width
    );
    if (!file) {
      throw new Error('unable to fetch image from uri');
    }
    const { hostedUrl, uploadUrl } = await getMemexUpload({
      file,
      uploadKey: fileKey,
    });
    await uploadFile(uploadUrl, resizedAsset.uri, {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': file.type,
    });
    return hostedUrl;
  } else if (hasCustomS3Creds(config, credentials)) {
    const endpoint = new URL(prefixEndpoint(credentials.endpoint));
    const client = new S3Client({
      endpoint: {
        protocol: endpoint.protocol.slice(0, -1),
        hostname: endpoint.host,
        path: endpoint.pathname || '/',
      },
      // us-east-1 is necessary for compatibility with other S3 providers (i.e., filebase)
      region: config.region || 'us-east-1',
      credentials,
      forcePathStyle: true,
    });
    const command = new PutObjectCommand({
      Bucket: config.currentBucket,
      Key: fileKey,
      ContentType: asset.mimeType ?? 'application/octet-stream',
      CacheControl: 'public, max-age=3600',
      ACL: 'public-read',
    });
    const signedUrl = await getSignedUrl(client, command);
    await uploadFile(signedUrl, resizedAsset.uri, {
      'Content-Type': asset.mimeType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    });
    return config.publicUrlBase
      ? new URL(fileKey, config.publicUrlBase).toString()
      : signedUrl.split('?')[0];
  } else {
    console.log('invalid storage configuration', config, credentials);
    throw new Error('invalid storage configuration');
  }
};

async function uploadFile(
  presignedUrl: string,
  assetUri: string,
  headers?: Record<string, string>
) {
  logger.log('uploading', assetUri, 'to', presignedUrl);
  const response = await FileSystem.uploadAsync(presignedUrl, assetUri, {
    httpMethod: 'PUT',
    headers,
  });
  if (response.status !== 200) {
    console.log(escapeLog(response.body));
    throw new Error(`Got bad upload response ${response.status}`);
  }
  return response;
}

function prefixEndpoint(endpoint: string) {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}
