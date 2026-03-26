import type { ImagePickerAsset } from 'expo-image-picker';

import {
  inferAllowedVideoMimeType,
  isLikelyVideoSource,
} from '../ui/contexts/attachmentRules';

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

function normalizeMediaType(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim().toLowerCase();
  const withoutDataPrefix = trimmedValue.startsWith('data:')
    ? trimmedValue.slice('data:'.length)
    : trimmedValue;
  const semicolonIndex = withoutDataPrefix.indexOf(';');
  const commaIndex = withoutDataPrefix.indexOf(',');
  const endIndex = [semicolonIndex, commaIndex]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const mediaType =
    endIndex == null
      ? withoutDataPrefix
      : withoutDataPrefix.slice(0, endIndex);

  return mediaType || undefined;
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

export function normalizeImagePickerAssetForUpload(
  asset: ImagePickerAsset
): ImagePickerAsset {
  const assetFile = getAssetFile(asset);
  const fileName = asset.fileName ?? assetFile?.name ?? undefined;
  const mimeType = inferAssetMimeType(asset) ?? undefined;
  const type =
    asset.type === 'image' || asset.type === 'video'
      ? asset.type
      : isLikelyVideoSource({
          mimeType: mimeType ?? undefined,
          name: fileName ?? undefined,
          uri: asset.uri,
        })
        ? 'video'
        : 'image';
  const normalizedFile =
    assetFile != null
      ? normalizeAssetFile(assetFile, {
          mimeType: mimeType ?? undefined,
          name: fileName ?? undefined,
        })
      : asset.file;
  const fileSize =
    asset.fileSize ?? assetFile?.size ?? getDataUriSize(asset.uri) ?? undefined;

  if (
    normalizedFile === asset.file &&
    fileName === asset.fileName &&
    mimeType === asset.mimeType &&
    fileSize === asset.fileSize &&
    type === asset.type
  ) {
    return asset;
  }

  return {
    ...asset,
    file: normalizedFile,
    fileName,
    fileSize,
    mimeType,
    type,
  };
}
