import type { Attachment } from '@tloncorp/shared/domain';
import * as DocumentPicker from 'expo-document-picker';
import type { ImagePickerAsset } from 'expo-image-picker';

import { isLikelyVideoSource, VIDEO_VALIDATION_ERROR, validateVideoSource } from '../ui/contexts/attachmentRules';
import { getVideoPreviewData } from '../ui/utils/videoPreviewData';
import { getAudioFileDurationSeconds, getFileSize } from './files';
import { imageSize } from './images';

type UploadIntentVideoMetadata = Exclude<
  Extract<Attachment.UploadIntent, { type: 'file' | 'fileUri' }>['video'],
  false | undefined
>;

function getAssetFile(asset: Pick<ImagePickerAsset, 'file'>): File | undefined {
  if (typeof File === 'undefined') {
    return undefined;
  }

  return asset.file instanceof File ? asset.file : undefined;
}

function positiveNumberOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function imagePickerAssetVideoMetadata(
  asset: Pick<ImagePickerAsset, 'width' | 'height' | 'duration'>,
  assetFile?: File
) {
  // On web, expo-image-picker's returnMediaData path (which also sets asset.file)
  // provides duration directly from HTMLVideoElement.duration — already in seconds.
  // On native, duration is in milliseconds. Use assetFile as the signal.
  const durationSeconds =
    asset.duration == null ? undefined
    : assetFile ? asset.duration        // web: already seconds
    : asset.duration / 1000;            // native: ms → seconds

  return {
    width: positiveNumberOrUndefined(asset.width),
    height: positiveNumberOrUndefined(asset.height),
    duration: positiveNumberOrUndefined(durationSeconds),
  };
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
    const assetFile = getAssetFile(asset);
    const video = imagePickerAssetVideoMetadata(asset, assetFile);

    if (assetFile) {
      return {
        type: 'file',
        file: assetFile,
        video,
      };
    }

    return {
      type: 'fileUri',
      localUri: asset.uri,
      name: asset.fileName ?? undefined,
      size: resolveVideoSize(asset.fileSize ?? undefined, asset.uri) ?? -1,
      mimeType: asset.mimeType ?? undefined,
      video,
    };
  }

  return {
    type: 'image',
    asset: {
      ...asset,
      mimeType: asset.mimeType ?? undefined,
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

  // Promote image/* files to ImageUploadIntent so they go through the
  // standard image pipeline and get proper dimensions.
  if (mimeType?.startsWith('image/')) {
    let localUri: string | undefined;
    try {
      localUri = isFileIntent
        ? URL.createObjectURL(uploadIntent.file)
        : uploadIntent.localUri;
      const [width, height] = await imageSize(localUri);
      return {
        uploadIntent: {
          type: 'image',
          asset: {
            uri: localUri,
            width,
            height,
            fileSize: size,
            mimeType,
          },
        },
        errorMessage: null,
      };
    } catch {
      // If we can't resolve dimensions, fall through and keep as file.
      // Revoke the blob URL we created so it doesn't leak.
      if (isFileIntent && localUri) {
        URL.revokeObjectURL(localUri);
      }
    }
  }

  // Promote audio/* files to voicememo so they render with the audio player
  // instead of a generic file download card.
  if (mimeType?.startsWith('audio/')) {
    const localUri = isFileIntent
      ? URL.createObjectURL(uploadIntent.file)
      : uploadIntent.localUri;
    const duration =
      (await getAudioFileDurationSeconds(localUri)) ?? undefined;
    return {
      uploadIntent: {
        type: 'fileUri',
        localUri,
        name,
        size: size ?? -1,
        mimeType,
        voiceMemo: {
          duration,
          transcription: undefined,
          waveformPreview: undefined,
        },
      },
      errorMessage: null,
    };
  }

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

export async function pickFile(
  acceptedTypes: string[] = ['*/*']
): Promise<{ uploadIntents: Attachment.UploadIntent[]; errorMessage: string | null }> {
  const results = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: acceptedTypes,
  });

  if (results.assets == null) {
    return { uploadIntents: [], errorMessage: null };
  }

  const raw: Attachment.UploadIntent[] = results.assets.map(
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

  return normalizeUploadIntents(raw);
}
