import { Attachment } from '@tloncorp/shared/domain';
import * as DocumentPicker from 'expo-document-picker';
import type { ImagePickerAsset } from 'expo-image-picker';

import {
  isLikelyVideoSource,
  VIDEO_VALIDATION_ERROR,
  validateVideoSource,
} from '../ui/contexts/attachmentRules';
import { getVideoPreviewData } from '../ui/utils/videoPreviewData';
import { getFileSize } from './files';

type UploadIntentVideoMetadata = Exclude<
  Extract<Attachment.UploadIntent, { type: 'file' | 'fileUri' }>['video'],
  false | undefined
>;

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

export function imagePickerAssetToUploadIntent(
  asset: ImagePickerAsset
): Attachment.UploadIntent {
  if (asset.type === 'video') {
    return {
      type: 'fileUri',
      localUri: asset.uri,
      name: asset.fileName ?? undefined,
      size: resolveVideoSize(asset.fileSize ?? undefined, asset.uri) ?? -1,
      mimeType: asset.mimeType ?? undefined,
      video: {
        width: asset.width ?? undefined,
        height: asset.height ?? undefined,
        duration: asset.duration != null ? asset.duration / 1000 : undefined,
      },
    };
  }
  return Attachment.UploadIntent.fromImagePickerAsset(asset);
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
  const mimeType = isFileIntent
    ? uploadIntent.file.type || undefined
    : uploadIntent.mimeType;
  const name = isFileIntent ? uploadIntent.file.name : uploadIntent.name;
  const uri = isFileIntent ? undefined : uploadIntent.localUri;
  const size = isFileIntent
    ? uploadIntent.file.size
    : resolveVideoSize(uploadIntent.size, uploadIntent.localUri);

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
  const needsPreviewData =
    existingVideo?.width == null ||
    existingVideo?.height == null ||
    existingVideo?.duration == null ||
    !existingVideo?.posterUri;
  const previewData = needsPreviewData
    ? await getVideoPreviewData(
        isFileIntent ? { file: uploadIntent.file } : { uri: uploadIntent.localUri }
      )
    : {};
  const video = {
    width: existingVideo?.width ?? previewData.width,
    height: existingVideo?.height ?? previewData.height,
    duration: existingVideo?.duration ?? previewData.duration,
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

  return results.assets.map(
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
