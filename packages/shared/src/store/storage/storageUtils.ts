import { preSig } from '@urbit/aura';

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

const logger = createDevLogger('storage utils', false);

const mimeToExt: Record<string, string> = {
  // Images
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  // Archives
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-7z-compressed': '.7z',
  'application/gzip': '.gz',
  'application/x-tar': '.tar',
  // Media
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-m4a': '.m4a',
  // Code
  'application/json': '.json',
  'application/xml': '.xml',
  'text/html': '.html',
  'text/css': '.css',
  'text/javascript': '.js',
  'application/javascript': '.js',
};

export function ensureFileExtension(
  filename: string,
  contentType?: string
): string {
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(filename)) {
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
    return '';
  }

  return mimeToExt[mimeType.toLowerCase()] || '';
}

export function isImageMimeType(mimeType?: string): boolean {
  if (!mimeType) {
    return false;
  }

  return mimeType.toLowerCase().startsWith('image/');
}

export const fetchFileFromUri = async (
  uri: string,
  height?: number,
  width?: number
) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const name = uri.split('/').pop();

    const file: RNFile = {
      uri,
      blob,
      name: name ?? 'file',
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
