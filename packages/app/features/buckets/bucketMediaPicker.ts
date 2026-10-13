import type { ImagePickerAsset } from 'expo-image-picker';

import type { BucketUploadCandidate } from '../../ui';
import { getFileSize } from '../../utils/files';

function getAssetSize(asset: ImagePickerAsset) {
  if (asset.fileSize != null) return asset.fileSize;
  if (asset.file) return asset.file.size;

  try {
    return getFileSize(asset.uri) ?? -1;
  } catch {
    return -1;
  }
}

function fallbackMediaName(asset: ImagePickerAsset, index: number) {
  const uriName = asset.uri.split('/').pop()?.split(/[?#]/)[0]?.trim();
  if (uriName) return uriName;

  const mimeSubtype = asset.mimeType?.split('/')[1]?.toLowerCase();
  const extension =
    mimeSubtype === 'jpeg'
      ? 'jpg'
      : mimeSubtype === 'quicktime'
        ? 'mov'
        : mimeSubtype;
  const isVideo =
    asset.type === 'video' ||
    asset.type === 'pairedVideo' ||
    asset.mimeType?.startsWith('video/');

  return `${isVideo ? 'video' : 'photo'}-${index + 1}.${extension ?? (isVideo ? 'mov' : 'jpg')}`;
}

export function imagePickerAssetsToBucketUploadCandidates(
  assets: ImagePickerAsset[]
): BucketUploadCandidate[] {
  return assets.map((asset, index) => ({
    file: asset.file,
    mimeType: asset.mimeType ?? asset.file?.type ?? undefined,
    name:
      asset.fileName?.trim() ||
      asset.file?.name ||
      fallbackMediaName(asset, index),
    size: getAssetSize(asset),
    uri: asset.uri,
  }));
}
