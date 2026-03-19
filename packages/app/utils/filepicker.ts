import type { Attachment } from '@tloncorp/shared/domain';
import * as DocumentPicker from 'expo-document-picker';
import type { ImagePickerAsset } from 'expo-image-picker';

import {
  inferAllowedVideoMimeType,
  isLikelyVideoSource,
  normalizeMediaType,
  VIDEO_VALIDATION_ERROR,
  validateVideoSource,
} from '../ui/contexts/attachmentRules';
import { getVideoPreviewData } from '../ui/utils/videoPreviewData';
import { getFileSize } from './files';

type UploadIntentVideoMetadata = Exclude<
  Extract<Attachment.UploadIntent, { type: 'file' | 'fileUri' }>['video'],
  false | undefined
>;

const IMAGE_EXTENSION_TO_MIME = {
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

const FILE_EXTENSION_REGEX = /\.([a-z0-9]+)(?:\?.*)?$/i;

function getAssetFile(asset: Pick<ImagePickerAsset, 'file'>): File | undefined {
  if (typeof File === 'undefined') {
    return undefined;
  }

  return asset.file instanceof File ? asset.file : undefined;
}

function normalizeAssetFile(
  file: File,
  {
    mimeType,
    name,
  }: {
    mimeType?: string;
    name?: string;
  }
): File {
  const normalizedName = name ?? file.name;
  const normalizedMimeType = mimeType ?? file.type;

  if (normalizedName === file.name && normalizedMimeType === file.type) {
    return file;
  }

  return new File([file], normalizedName, {
    type: normalizedMimeType,
    lastModified: file.lastModified,
  });
}

function positiveNumberOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function getDataUriSize(uri: string): number | undefined {
  const trimmedUri = uri.trim();
  if (!trimmedUri.toLowerCase().startsWith('data:')) {
    return undefined;
  }

  const commaIndex = trimmedUri.indexOf(',');
  if (commaIndex < 0) {
    return undefined;
  }

  const metadata = trimmedUri.slice(5, commaIndex).toLowerCase();
  const payload = trimmedUri.slice(commaIndex + 1);

  if (metadata.includes(';base64')) {
    const normalizedPayload = payload.replace(/\s+/g, '');
    if (!normalizedPayload) {
      return 0;
    }

    const paddingLength = normalizedPayload.endsWith('==')
      ? 2
      : normalizedPayload.endsWith('=')
        ? 1
        : 0;
    const size =
      Math.floor((normalizedPayload.length * 3) / 4) - paddingLength;

    return size >= 0 ? size : undefined;
  }

  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length;
  } catch {
    return undefined;
  }
}

function resolveVideoSize(
  size: number | undefined,
  uri: string | undefined
): number | undefined {
  if (size != null && size >= 0) {
    return size;
  }
  if (!uri) {
    return undefined;
  }
  const statSize = getFileSize(uri);
  if (typeof statSize === 'number' && statSize >= 0) {
    return statSize;
  }
  const dataUriSize = getDataUriSize(uri);
  if (typeof dataUriSize === 'number' && dataUriSize >= 0) {
    return dataUriSize;
  }
  return undefined;
}

function asVideoMetadata(
  metadata: Extract<
    Attachment.UploadIntent,
    { type: 'file' | 'fileUri' }
  >['video']
): UploadIntentVideoMetadata | undefined {
  return metadata && typeof metadata === 'object' ? metadata : undefined;
}

function inferImageMimeType({
  file,
  fileName,
  uri,
}: Pick<ImagePickerAsset, 'file' | 'fileName' | 'uri'>): string | undefined {
  const candidate = getAssetFile({ file })?.name ?? fileName ?? uri;
  const extension = candidate?.match(FILE_EXTENSION_REGEX)?.[1]?.toLowerCase();
  if (!extension) {
    return undefined;
  }

  return IMAGE_EXTENSION_TO_MIME[
    extension as keyof typeof IMAGE_EXTENSION_TO_MIME
  ];
}

function inferAssetMimeType(
  asset: Pick<ImagePickerAsset, 'file' | 'fileName' | 'mimeType' | 'uri'>
): string | undefined {
  const assetFile = getAssetFile(asset);
  if (assetFile?.type) {
    return normalizeMediaType(assetFile.type) ?? assetFile.type.toLowerCase();
  }

  if (asset.mimeType) {
    return normalizeMediaType(asset.mimeType) ?? asset.mimeType.toLowerCase();
  }

  const uriMediaType = normalizeMediaType(asset.uri);
  return (
    inferAllowedVideoMimeType({
      mimeType: uriMediaType,
      name: asset.fileName ?? assetFile?.name ?? undefined,
      uri: asset.uri,
    }) ??
    (uriMediaType?.startsWith('image/') ? uriMediaType : undefined) ??
    inferImageMimeType(asset)
  );
}

export function imagePickerAssetToUploadIntent(
  asset: ImagePickerAsset
): Attachment.UploadIntent {
  const assetFile = getAssetFile(asset);
  const mimeType = inferAssetMimeType(asset);
  const assetType =
    asset.type === 'image' || asset.type === 'video'
      ? asset.type
      : isLikelyVideoSource({
          mimeType,
          name: asset.fileName ?? assetFile?.name ?? undefined,
          uri: asset.uri,
        })
        ? 'video'
        : 'image';

  if (assetType === 'video') {
    if (assetFile) {
      return {
        type: 'file',
        file: normalizeAssetFile(assetFile, {
          mimeType,
          name: asset.fileName ?? assetFile.name,
        }),
        video: {
          width: asset.width ?? undefined,
          height: asset.height ?? undefined,
          duration: asset.duration != null ? asset.duration / 1000 : undefined,
        },
      };
    }

    return {
      type: 'fileUri',
      localUri: asset.uri,
      name: asset.fileName ?? undefined,
      size: resolveVideoSize(asset.fileSize ?? undefined, asset.uri) ?? -1,
      mimeType,
      video: {
        width: asset.width ?? undefined,
        height: asset.height ?? undefined,
        duration: asset.duration != null ? asset.duration / 1000 : undefined,
      },
    };
  }
  return {
    type: 'image',
    asset: {
      ...asset,
      mimeType,
    },
  };
}

export async function normalizeUploadIntent(
  uploadIntent: Attachment.UploadIntent
): Promise<{ uploadIntent: Attachment.UploadIntent | null; errorMessage: string | null }> {
  if (uploadIntent.type === 'image') {
    return { uploadIntent, errorMessage: null };
  }

  if (uploadIntent.type === 'fileUri' && uploadIntent.voiceMemo) {
    return { uploadIntent, errorMessage: null };
  }

  if (uploadIntent.type !== 'file' && uploadIntent.type !== 'fileUri') {
    return { uploadIntent: null, errorMessage: null };
  }

  const isFileIntent = uploadIntent.type === 'file';
  const { mimeType, name, uri, size } = isFileIntent
    ? {
        mimeType: uploadIntent.file.type || undefined,
        name: uploadIntent.file.name,
        uri: undefined,
        size: uploadIntent.file.size,
      }
    : {
        mimeType: uploadIntent.mimeType,
        name: uploadIntent.name,
        uri: uploadIntent.localUri,
        size: resolveVideoSize(uploadIntent.size, uploadIntent.localUri),
      };

  if (!isLikelyVideoSource({ mimeType, name, uri })) {
    return { uploadIntent, errorMessage: null };
  }

  if (!validateVideoSource({ mimeType, size, name, uri })) {
    return {
      uploadIntent: null,
      errorMessage: VIDEO_VALIDATION_ERROR,
    };
  }

  const existingVideo = asVideoMetadata(uploadIntent.video);
  const existingWidth = positiveNumberOrUndefined(existingVideo?.width);
  const existingHeight = positiveNumberOrUndefined(existingVideo?.height);
  const existingDuration = positiveNumberOrUndefined(existingVideo?.duration);
  const needsPreviewData =
    existingWidth == null ||
    existingHeight == null ||
    existingDuration == null ||
    !existingVideo?.posterUri;
  let previewData: Awaited<ReturnType<typeof getVideoPreviewData>> = {};
  if (needsPreviewData) {
    try {
      previewData = await getVideoPreviewData(
        isFileIntent ? { file: uploadIntent.file } : { uri: uploadIntent.localUri }
      );
    } catch {
      previewData = {};
    }
  }
  const video = {
    width: existingWidth ?? positiveNumberOrUndefined(previewData.width),
    height: existingHeight ?? positiveNumberOrUndefined(previewData.height),
    duration:
      existingDuration ?? positiveNumberOrUndefined(previewData.duration),
    posterUri: existingVideo?.posterUri ?? previewData.posterUri,
  };

  if (isFileIntent) {
    return {
      uploadIntent: {
        ...uploadIntent,
        video,
      },
      errorMessage: null,
    };
  }

  return {
    uploadIntent: {
      ...uploadIntent,
      size: size ?? uploadIntent.size,
      video,
    },
    errorMessage: null,
  };
}

export async function normalizeUploadIntents(
  uploadIntents: Attachment.UploadIntent[]
): Promise<{ uploadIntents: Attachment.UploadIntent[]; errorMessage: string | null }> {
  const normalized = await Promise.all(
    uploadIntents.map((uploadIntent) => normalizeUploadIntent(uploadIntent))
  );
  const errorMessage =
    normalized.find((result) => result.errorMessage)?.errorMessage ?? null;
  return {
    uploadIntents: normalized.flatMap((result) =>
      result.uploadIntent ? [result.uploadIntent] : []
    ),
    errorMessage,
  };
}

export async function pickFile(): Promise<Attachment.UploadIntent[]> {
  const results = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['*/*'],
  });

  if (results.assets == null) {
    return [];
  }

  return results.assets?.map(
    (res): Attachment.UploadIntent =>
      res.file == null
        ? {
            type: 'fileUri',
            name: res.name,
            localUri: res.uri,
            size: res.size ?? -1, // not sure when size would be undefined, but it's in the types...
            mimeType: res.mimeType,
          }
        : {
            type: 'file',
            file: res.file,
          }
  );
}
