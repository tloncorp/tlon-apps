import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { deSig, unixToDa } from '@urbit/aura';
import { formatDa } from '@urbit/aura';
import * as FileSystem from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { ImagePickerAsset } from 'expo-image-picker';

import { RNFile, getCurrentUserId } from '../../api';
import * as db from '../../db';
import { createDevLogger, escapeLog } from '../../debug';
import { Attachment } from '../../domain/attachment';
import { setUploadState } from './storageUploadState';
import {
  fetchFileFromUri,
  getExtensionFromMimeType,
  getMemexUpload,
  hasCustomS3Creds,
  hasHostingUploadCreds,
} from './storageUtils';

const logger = createDevLogger('storageActions', false);

export const PLACEHOLDER_ASSET_URI = 'placeholder-asset-id';

function getSaveFormat(mimeType?: string): SaveFormat {
  if (!mimeType) {
    return SaveFormat.JPEG;
  }

  const lowercaseMime = mimeType.toLowerCase();
  if (lowercaseMime.includes('png')) {
    return SaveFormat.PNG;
  }
  if (lowercaseMime.includes('webp')) {
    return SaveFormat.WEBP;
  }
  // expo-image-manipulator only supports JPEG, PNG, and WEBP
  return SaveFormat.JPEG;
}

export async function uploadAsset(
  asset: Attachment.UploadIntent,
  isWeb = false
) {
  switch (asset.type) {
    case 'image': {
      return await uploadImageAsset(asset.asset, isWeb);
    }

    case 'file': {
      return await performUpload(
        {
          uri: asset.fileUri,
          mimeType: undefined, // TODO
        },
        isWeb
      );
    }
  }
  throw new Error('not implemented');
}

const uploadImageAsset = async (asset: ImagePickerAsset, isWeb = false) => {
  if (asset.uri === PLACEHOLDER_ASSET_URI) {
    logger.log('placeholder image, skipping upload');
    return;
  }
  logger.crumb(
    'uploading asset',
    asset.mimeType,
    asset.fileSize,
    'isWeb',
    isWeb
  );
  logger.log('full asset', asset);
  setUploadState(asset.uri, { status: 'uploading', localUri: asset.uri });
  try {
    logger.log('resizing asset', asset.uri);
    let resizedAsset = asset;
    const originalMimeType = asset.mimeType;
    // avoid resizing gifs
    if (!asset.mimeType?.includes('gif')) {
      const format = getSaveFormat(asset.mimeType);
      resizedAsset = await manipulateAsync(
        asset.uri,
        [
          {
            resize:
              asset.width > asset.height ? { width: 1200 } : { height: 1200 },
          },
        ],
        {
          compress: 0.75,
          format,
        }
      );
    }
    const remoteUri = await performUpload(
      { ...resizedAsset, mimeType: originalMimeType },
      isWeb
    );
    logger.crumb('upload succeeded');
    logger.log('final uri', remoteUri);
    setUploadState(asset.uri, { status: 'success', remoteUri });
  } catch (e) {
    logger.crumb('upload failed');
    console.error(e);
    setUploadState(asset.uri, { status: 'error', errorMessage: e.message });
  }
};

export const performUpload = async (
  params: Pick<RNFile, 'uri' | 'height' | 'width'> & { mimeType?: string },
  isWeb = false
) => {
  logger.log('performing upload', params.uri, 'isWeb', isWeb);
  const [config, credentials] = await Promise.all([
    db.storageConfiguration.getValue(),
    db.storageCredentials.getValue(),
  ]);

  if (!credentials || !config) {
    throw new Error('unable to upload: missing storage configuration');
  }

  const file = await fetchFileFromUri(params.uri, params.height, params.width);
  logger.log('fetched file', file);
  if (!file) {
    throw new Error('unable to fetch image from uri');
  }

  const contentType = file.type;
  const baseFileName = params.uri.split('/').pop()?.split('?')[0] || 'image';
  const extension = getExtensionFromMimeType(params.mimeType || contentType);
  const fileName = baseFileName.includes('.')
    ? baseFileName
    : `${baseFileName}${extension}`;
  const fileKey = `${deSig(getCurrentUserId())}/${deSig(
    formatDa(unixToDa(new Date().getTime()))
  )}-${fileName}`;
  logger.log('asset key:', fileKey);

  if (hasHostingUploadCreds(config, credentials)) {
    const { hostedUrl, uploadUrl } = await getMemexUpload({
      contentLength: file.blob.size,
      contentType,
      fileName: fileKey,
    });
    await uploadFile(
      uploadUrl,
      params.uri,
      {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': contentType,
      },
      isWeb
    );
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

    const headers = {
      'Content-Type': contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
      'x-amz-acl': 'public-read', // necessary for digital ocean spaces
    };

    const command = new PutObjectCommand({
      Bucket: config.currentBucket,
      Key: fileKey,
      ContentType: headers['Content-Type'],
      CacheControl: headers['Cache-Control'],
      ACL: headers['x-amz-acl'],
    });

    const signedUrl = await getSignedUrl(client, command, {
      expiresIn: 3600,
      signableHeaders: new Set(Object.keys(headers)),
    });

    logger.log('Signed URL:', signedUrl);
    logger.log('Headers to be sent:', headers);

    const isDigitalOcean = signedUrl.includes('digitaloceanspaces.com');

    await uploadFile(
      signedUrl,
      params.uri,
      isDigitalOcean ? headers : undefined,
      isWeb
    );
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
  headers?: Record<string, string>,
  isWeb = false
) {
  logger.log('uploading', assetUri, 'to', presignedUrl, 'isWeb', isWeb);

  if (isWeb) {
    let body: Blob | string = assetUri;

    // If assetUri is a base64 string, convert it to a Blob
    if (assetUri.startsWith('data:')) {
      const arr = assetUri.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime =
        mimeMatch && mimeMatch[1] ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      body = new Blob([u8arr], { type: mime });
    } else {
      // If assetUri is a file path, fetch the file
      const response = await fetch(assetUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from ${assetUri}`);
      }
      body = await response.blob();
    }

    logger.log('final upload params', { presignedUrl, headers });

    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: body,
      headers,
    });
    if (!response.ok) {
      throw new Error(`Got bad upload response ${response.status}`);
    }
    return response;
  } else {
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
}

function prefixEndpoint(endpoint: string) {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}
