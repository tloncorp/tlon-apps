import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RNFile, getCurrentUserId } from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { Attachment } from '@tloncorp/api/types/attachment';
import { da, render } from '@urbit/aura';
// Aliased so it doesn't shadow the global web File used elsewhere in this
// module.
import { File as ExpoFile } from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import * as db from '../../db';
import { createDevLogger, escapeLog } from '../../debug';
import { AnalyticsEvent } from '../../domain';
import { getLocalFileSize } from './getLocalFileSize';
import { setUploadState } from './storageUploadState';
import {
  getExtensionFromMimeType,
  getMemexUpload,
  hasCustomS3Creds,
  hasHostingUploadCreds,
} from './storageUtils';

const logger = createDevLogger('storageActions', false);

export const PLACEHOLDER_ASSET_URI = 'placeholder-asset-id';

function getVideoPosterMimeType(posterUri: string): string {
  const normalizedUri = posterUri.toLowerCase();
  if (normalizedUri.endsWith('.png')) {
    return 'image/png';
  }
  if (normalizedUri.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

async function uploadVideoPoster(
  posterUri: string | undefined,
  isWeb: boolean
): Promise<string | undefined> {
  if (!posterUri) {
    return undefined;
  }
  if (Attachment.isRemoteUri(posterUri)) {
    return posterUri;
  }
  try {
    return await performUpload(
      {
        uri: posterUri,
        mimeType: getVideoPosterMimeType(posterUri),
      },
      isWeb
    );
  } catch (error) {
    logger.trackError('video poster upload failed', {
      error,
      message: error instanceof Error ? error.message : String(error),
      isWeb,
    });
    return undefined;
  }
}

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

function getSaveFormatMimeType(format: SaveFormat): string {
  switch (format) {
    case SaveFormat.PNG:
      return 'image/png';
    case SaveFormat.WEBP:
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

export async function uploadAsset(
  intent: Attachment.UploadIntent,
  isWeb = false
) {
  switch (intent.type) {
    case 'image': {
      const asset = intent.asset;
      if (asset.uri === PLACEHOLDER_ASSET_URI) {
        logger.log('placeholder image, skipping upload');
        return;
      }
      await uploadImageAsset(intent, isWeb);
      break;
    }

    case 'file': {
      await uploadAssetWithLifecycle(intent, isWeb, {
        async prepareAsset() {
          return intent.file;
        },
      });
      break;
    }

    case 'fileUri': {
      await uploadAssetWithLifecycle(intent, isWeb, {
        async prepareAsset() {
          return {
            uri: intent.localUri,
            size: intent.size,
            mimeType: intent.mimeType,
            name: intent.name,
          };
        },
      });
      break;
    }
  }
}

async function uploadAssetWithLifecycle(
  uploadIntent: Attachment.UploadIntent,
  isWeb = false,
  callbacks: {
    willUpload?: () => void;
    prepareAsset: () => Promise<
      (Pick<RNFile, 'uri' | 'height' | 'width'> & { mimeType?: string }) | File
    >;
  }
) {
  const uploadKey = Attachment.UploadIntent.extractKey(uploadIntent);
  const { isVideo, posterUri: localPosterUri } =
    Attachment.UploadIntent.getVideoUploadMetadata(uploadIntent);
  callbacks.willUpload?.();

  setUploadState(uploadKey, {
    status: 'uploading',
    localUri: Attachment.UploadIntent.createLocalUri(uploadIntent),
  });
  if (isVideo) {
    logger.trackEvent(AnalyticsEvent.VideoUploadStarted, {
      uploadKey,
      isWeb,
    });
  }
  try {
    const remoteUri = await performUpload(
      await callbacks.prepareAsset(),
      isWeb
    );
    const posterUri = isVideo
      ? await uploadVideoPoster(localPosterUri, isWeb)
      : undefined;
    logger.crumb('upload succeeded');
    logger.trackEvent(AnalyticsEvent.AttachmentUploadSuccess, {
      remoteUri,
      isWeb,
    });
    setUploadState(uploadKey, {
      status: 'success',
      remoteUri,
      posterUri,
    });
  } catch (e) {
    logger.trackError('upload failed', {
      error: e,
      message: e.message,
      uploadIntent: JSON.stringify(uploadIntent),
      isWeb,
    });
    console.error(e);
    setUploadState(uploadKey, {
      status: 'error',
      errorMessage: e.message,
    });
    if (isVideo) {
      logger.trackEvent(AnalyticsEvent.VideoUploadFailed, {
        uploadKey,
        isWeb,
        error: e.message,
      });
    }
  }
}

async function uploadImageAsset(
  uploadIntent: Extract<Attachment.UploadIntent, { type: 'image' }>,
  isWeb = false
) {
  await uploadAssetWithLifecycle(uploadIntent, isWeb, {
    willUpload() {
      const asset = uploadIntent.asset;
      logger.crumb(
        'uploading asset',
        asset.mimeType,
        asset.fileSize,
        'isWeb',
        isWeb
      );
      logger.log('full asset', asset);
    },
    async prepareAsset() {
      const asset = uploadIntent.asset;
      logger.log('resizing asset', asset.uri);
      let resizedAsset = asset;
      // manipulateAsync re-encodes to `format`, so the upload mime must track
      // the output (e.g. HEIC is saved as JPEG), not the original asset mime.
      let uploadMimeType = asset.mimeType;
      // Only resize when we know it's a non-gif image. If mimeType is missing
      // or non-image, upload the original bytes — re-encoding through the
      // canvas-backed manipulator would clobber the format (e.g. animated
      // gifs flattened to a single PNG/JPEG frame).
      const canResize =
        !!asset.mimeType &&
        asset.mimeType.startsWith('image/') &&
        !asset.mimeType.includes('gif');
      if (canResize) {
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
        uploadMimeType = getSaveFormatMimeType(format);
      }
      return {
        ...resizedAsset,
        mimeType: uploadMimeType,
      };
    },
  });
}

export const performUpload = async (
  params:
    | (Pick<RNFile, 'uri' | 'height' | 'width'> & {
        mimeType?: string;
        size?: number;
        name?: string;
      })
    | File,
  isWeb = false
) => {
  if (!(params instanceof File)) {
    logger.log('performing upload', params.uri, 'isWeb', isWeb);
  }
  const [config, credentials] = await Promise.all([
    db.storageConfiguration.getValue(),
    db.storageCredentials.getValue(),
  ]);

  if (!credentials || !config) {
    throw new Error('unable to upload: missing storage configuration');
  }

  const { size, fileName, contentType, sourceUri } = await (async () => {
    if (params instanceof File) {
      return {
        size: params.size,
        fileName: params.name,
        contentType: params.type,
        sourceUri: URL.createObjectURL(params),
      };
    } else {
      // fileUri intents use -1 when the source didn't report a size.
      const size =
        params.size != null && params.size >= 0
          ? params.size
          : await getLocalFileSize(params.uri);
      const contentType = params.mimeType || 'application/octet-stream';
      const baseFileName =
        params.name || params.uri.split('/').pop()?.split('?')[0] || 'image';
      const extension = getExtensionFromMimeType(contentType);
      const fileName = baseFileName.includes('.')
        ? baseFileName
        : `${baseFileName}${extension}`;

      return {
        size,
        fileName,
        contentType,
        sourceUri: params.uri,
      };
    }
  })();

  logger.log('fetched file', fileName, contentType, size);

  const fileKey = `${desig(getCurrentUserId())}/${desig(
    render('da', da.fromUnix(new Date().getTime()))
  )}-${fileName}`;
  logger.log('asset key:', fileKey);

  if (hasHostingUploadCreds(config, credentials)) {
    const { hostedUrl, uploadUrl } = await getMemexUpload({
      contentLength: size,
      contentType,
      fileName: fileKey,
    });
    await uploadFile(
      uploadUrl,
      sourceUri,
      {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': contentType,
      },
      isWeb
    );
    return hostedUrl;
  } else if (hasCustomS3Creds(config, credentials)) {
    const endpointUrl = prefixEndpoint(credentials.endpoint);
    const client = new S3Client({
      endpoint: endpointUrl,
      // us-east-1 is necessary for compatibility with other S3 providers (i.e., filebase)
      region: config.region || 'us-east-1',
      credentials,
      forcePathStyle: true,
    });

    // ACL travels in the signed query string only (the presigner hoists it;
    // SignedHeaders=host). Unsigned x-amz-* wire headers are forbidden by AWS
    // SigV4, so we never send an ACL header — except DO Spaces, whose legacy
    // wire shape includes it. Content-Type/Cache-Control are ordinary unsigned
    // metadata headers. Non-DO browser uploads omit Cache-Control to avoid new
    // CORS preflight requirements (narrow AllowedHeaders on existing buckets);
    // this leaves a Cache-Control metadata gap on those objects. GCS
    // uniform-bucket-level-access rejects any ACL with 400, hence the single
    // retry without it.
    const isDO = new URL(endpointUrl).hostname.endsWith(
      '.digitaloceanspaces.com'
    );

    const presign = async (includeAcl: boolean) => {
      const headers: Record<string, string> = {
        'Content-Type': contentType ?? 'application/octet-stream',
      };
      if (isDO) {
        headers['Cache-Control'] = 'public, max-age=3600';
        if (includeAcl) {
          headers['x-amz-acl'] = 'public-read';
        }
      }

      const command = new PutObjectCommand({
        Bucket: config.currentBucket,
        Key: fileKey,
        ContentType: headers['Content-Type'],
        CacheControl: isDO ? headers['Cache-Control'] : undefined,
        ...(includeAcl ? { ACL: 'public-read' as const } : {}),
      });

      const signedUrl = await getSignedUrl(client, command, {
        expiresIn: 3600,
        signableHeaders: new Set(Object.keys(headers)),
      });

      return { signedUrl, headers };
    };

    let { signedUrl, headers } = await presign(true);
    logger.log('Signed URL:', signedUrl);
    logger.log('Headers to be sent:', headers);

    try {
      await uploadFile(signedUrl, sourceUri, headers, isWeb);
    } catch (e) {
      if (e instanceof UploadResponseError && e.status === 400) {
        logger.log(
          'ACL rejected (400); retrying upload without ACL for uniform-access buckets'
        );
        ({ signedUrl, headers } = await presign(false));
        await uploadFile(signedUrl, sourceUri, headers, isWeb);
      } else {
        throw e;
      }
    }

    return config.publicUrlBase
      ? new URL(fileKey, config.publicUrlBase).toString()
      : signedUrl.split('?')[0];
  } else {
    console.log('invalid storage configuration', config, credentials);
    throw new Error('invalid storage configuration');
  }
};

class UploadResponseError extends Error {
  status: number;
  constructor(status: number) {
    super(`Got bad upload response ${status}`);
    this.status = status;
  }
}

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
      throw new UploadResponseError(response.status);
    }
    return response;
  } else {
    const response = await new ExpoFile(assetUri).upload(presignedUrl, {
      httpMethod: 'PUT',
      headers,
    });

    if (response.status !== 200) {
      console.log(escapeLog(response.body));
      throw new UploadResponseError(response.status);
    }
    return response;
  }
}

function prefixEndpoint(endpoint: string) {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}
