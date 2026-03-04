import {
  Attachment,
  PLACEHOLDER_ASSET_URI,
  createDevLogger,
} from '@tloncorp/shared';
import {
  getAudioFileDurationSeconds,
  getFileSize,
  getMimeType,
} from '../../utils/files';
import { Button } from '@tloncorp/ui';
import * as ImagePicker from 'expo-image-picker';
import {
  ComponentRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isWeb } from 'tamagui';

import { useFeatureFlag } from '../../lib/featureFlags';
import { pickFile } from '../../utils/filepicker';
import { useAttachmentContext } from '../contexts';
import {
  isLikelyVideoSource,
  VIDEO_VALIDATION_ERROR,
  validateVideoSource,
} from '../contexts/attachmentRules';
import {
  createImageAssetFromClipboardData,
  getClipboardImageWithFallbacks,
} from '../utils';
import { getVideoPreviewData } from '../utils/videoPreviewData';
import { ActionGroup, ActionSheet, createActionGroups } from './ActionSheet';
import { AudioRecorder, AudioRecorderSheet } from './AudioRecorder';
import { ListItem } from './ListItem';
import {
  StorageQuotaIndicator,
  useStorageInfoQuery,
} from './StorageQuotaIndicator';

const logger = createDevLogger('AttachmentSheet', true);

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
  const statSize = fs.getFileSize(uri);
  if (typeof statSize === 'number' && statSize >= 0) {
    return statSize;
  }
  return undefined;
}

type UploadIntentVideoMetadata = Exclude<
  Extract<Attachment.UploadIntent, { type: 'file' | 'fileUri' }>['video'],
  false | undefined
>;

function asVideoMetadata(
  metadata: Extract<
    Attachment.UploadIntent,
    { type: 'file' | 'fileUri' }
  >['video']
): UploadIntentVideoMetadata | undefined {
  return metadata && typeof metadata === 'object' ? metadata : undefined;
}

function shouldHydrateVideoMetadata(
  metadata: UploadIntentVideoMetadata | undefined
) {
  return (
    metadata?.width == null ||
    metadata?.height == null ||
    metadata?.duration == null ||
    !metadata?.posterUri
  );
}

function mergeVideoMetadata(
  metadata: UploadIntentVideoMetadata | undefined,
  previewData: Awaited<ReturnType<typeof getVideoPreviewData>>
) {
  return {
    width: metadata?.width ?? previewData.width,
    height: metadata?.height ?? previewData.height,
    duration: metadata?.duration ?? previewData.duration,
    posterUri: metadata?.posterUri ?? previewData.posterUri,
  };
}

export default function AttachmentSheet({
  isOpen: showAttachmentSheet,
  onOpenChange: onOpenChange,
  showClearOption,
  onClearAttachments,
  onAttach,
  mediaType,
}: {
  isOpen: boolean;
  showClearOption?: boolean;
  onClearAttachments?: () => void;
  onOpenChange: (open: boolean) => void;
  onAttach?: (assets: Attachment.UploadIntent[]) => void;
  mediaType: 'image' | 'all';
}) {
  const [mediaLibraryPermissionStatus, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [cameraPermissionStatus, requestCameraPermission] =
    ImagePicker.useCameraPermissions();

  const {
    attachAssets,
    addAttachment,
    clearAttachments,
    removeAttachment,
    setAttachmentErrorMessage,
  } = useAttachmentContext();

  const [hasClipboardImage, setHasClipboardImage] = useState(false);

  const getClipboardImageData = useCallback(async (): Promise<{
    data: string;
    mimeType: string;
  } | null> => {
    try {
      return await getClipboardImageWithFallbacks();
    } catch (error) {
      logger.trackError('Clipboard access failed', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!showAttachmentSheet || isWeb) {
      setHasClipboardImage(false);
      return;
    }

    const checkClipboard = async () => {
      const clipboardData = await getClipboardImageData();
      setHasClipboardImage(!!clipboardData);
    };

    checkClipboard();
  }, [showAttachmentSheet, getClipboardImageData]);

  const placeholderUploadIntent: Attachment.UploadIntent = useMemo(
    () =>
      Attachment.UploadIntent.fromImagePickerAsset({
        assetId: 'placeholder-asset-id',
        uri: PLACEHOLDER_ASSET_URI,
        width: 300,
        height: 300,
        fileName: 'camera-image.jpg',
        fileSize: 0,
        type: 'image',
        duration: undefined,
        exif: undefined,
        base64: undefined,
      }),
    []
  );

  const removePlaceholderAttachment = useCallback(() => {
    const placeholderToRemove = {
      type: 'image' as const,
      file: { uri: PLACEHOLDER_ASSET_URI } as ImagePicker.ImagePickerAsset,
    };

    removeAttachment(placeholderToRemove);
  }, [removeAttachment]);

  const audioRecorder = useAudioRecorderController({
    async onSubmit({ audioFilePath, waveformPreview }) {
      const duration = await (async () => {
        try {
          return await getAudioFileDurationSeconds(audioFilePath);
        } catch {
          return undefined;
        }
      })();
      addAttachment({
        type: 'voicememo',
        localUri: audioFilePath,
        size: getFileSize(audioFilePath) ?? -1,
        waveformPreview,
        duration: duration ?? undefined,
        mimeType: getMimeType(audioFilePath) ?? undefined,
      });
      audioRecorder.dismiss();
    },
  });
  const startRecordingVoiceMemo = useCallback(() => {
    // Close the sheet immediately
    onOpenChange(false);
    audioRecorder.present();
  }, [onOpenChange, audioRecorder]);

  const useVideoInMediaPicker = mediaType === 'all';
  const pickerMediaTypes = useMemo<ImagePicker.MediaType[]>(
    () => (useVideoInMediaPicker ? ['images', 'videos'] : ['images']),
    [useVideoInMediaPicker]
  );

  const asUploadIntent = useCallback(
    (asset: ImagePicker.ImagePickerAsset): Attachment.UploadIntent => {
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
            duration:
              asset.duration != null ? asset.duration / 1000 : undefined,
          },
        };
      }
      return Attachment.UploadIntent.fromImagePickerAsset(asset);
    },
    []
  );

  const normalizeUploadIntent = useCallback(
    async (
      uploadIntent: Attachment.UploadIntent
    ): Promise<Attachment.UploadIntent | null> => {
      if (uploadIntent.type === 'image') {
        return uploadIntent;
      }

      if (uploadIntent.type === 'fileUri' && uploadIntent.voiceMemo) {
        return uploadIntent;
      }

      if (uploadIntent.type !== 'file' && uploadIntent.type !== 'fileUri') {
        return null;
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
      const previewSource = isFileIntent
        ? { file: uploadIntent.file }
        : { uri: uploadIntent.localUri };

      if (!isLikelyVideoSource({ mimeType, name, uri })) {
        return uploadIntent;
      }

      if (
        !validateVideoSource({
          mimeType,
          size,
          name,
          uri,
        })
      ) {
        logger.trackError('video validation failed', {
          mimeType,
          size,
          name,
          uri,
        });
        setAttachmentErrorMessage(VIDEO_VALIDATION_ERROR);
        return null;
      }

      const existingMetadata = asVideoMetadata(uploadIntent.video);
      const previewData = shouldHydrateVideoMetadata(existingMetadata)
        ? await getVideoPreviewData(previewSource)
        : {};

      if (isFileIntent) {
        return {
          ...uploadIntent,
          video: mergeVideoMetadata(existingMetadata, previewData),
        };
      }

      return {
        ...uploadIntent,
        size: size ?? uploadIntent.size,
        video: mergeVideoMetadata(existingMetadata, previewData),
      };
    },
    [setAttachmentErrorMessage]
  );

  const normalizeUploadIntents = useCallback(
    async (
      uploadIntents: Attachment.UploadIntent[]
    ): Promise<Attachment.UploadIntent[]> => {
      const normalized = await Promise.all(
        uploadIntents.map((uploadIntent) => normalizeUploadIntent(uploadIntent))
      );
      return normalized.flatMap((uploadIntent) =>
        uploadIntent ? [uploadIntent] : []
      );
    },
    [normalizeUploadIntent]
  );

  const processPickedAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      const uploadIntent = asUploadIntent(asset);
      removePlaceholderAttachment();
      const atts = await normalizeUploadIntents([uploadIntent]);
      if (atts.length > 0) {
        setAttachmentErrorMessage(null);
        attachAssets(atts);
        onAttach?.(atts);
      }
    },
    [
      asUploadIntent,
      attachAssets,
      normalizeUploadIntents,
      onAttach,
      removePlaceholderAttachment,
      setAttachmentErrorMessage,
    ]
  );

  const runAfterSheetClose = useCallback(
    (action: () => Promise<void> | void) => {
      onOpenChange(false);
      setTimeout(() => {
        void action();
      }, 50);
    },
    [onOpenChange]
  );

  const attachPlaceholder = useCallback(() => {
    // skip on web, the browser doesn't like trying to load a file that doesn't exist
    if (Platform.OS !== 'web') {
      attachAssets([placeholderUploadIntent]);
    }
  }, [attachAssets, placeholderUploadIntent]);

  const runPickerFlow = useCallback(
    ({
      permissionStatus,
      requestPermission,
      launchPicker,
      attachPlaceholderDelayMs,
      errorMessage,
    }: {
      permissionStatus: ImagePicker.PermissionResponse | null;
      requestPermission: () => Promise<ImagePicker.PermissionResponse>;
      launchPicker: () => Promise<ImagePicker.ImagePickerResult>;
      attachPlaceholderDelayMs: number;
      errorMessage: string;
    }) => {
      runAfterSheetClose(async () => {
        let placeholderTimeout: ReturnType<typeof setTimeout> | null = null;
        try {
          if (permissionStatus?.granted === false) {
            const permissionResult = await requestPermission();
            if (!permissionResult.granted) {
              return;
            }
          }
          if (attachPlaceholderDelayMs === 0) {
            attachPlaceholder();
          } else if (attachPlaceholderDelayMs > 0) {
            placeholderTimeout = setTimeout(
              attachPlaceholder,
              attachPlaceholderDelayMs
            );
          }
          const result = await launchPicker();
          if (result.canceled) {
            clearAttachments();
            return;
          }
          await processPickedAsset(result.assets[0]);
        } catch (error) {
          console.error(errorMessage, error);
          logger.trackError(errorMessage, error);
          clearAttachments();
        } finally {
          if (placeholderTimeout) {
            clearTimeout(placeholderTimeout);
          }
        }
      });
    },
    [
      attachPlaceholder,
      clearAttachments,
      processPickedAsset,
      runAfterSheetClose,
    ]
  );

  const createAssetFromClipboard = useCallback(() => {
    runAfterSheetClose(async () => {
      try {
        const clipboardData = await getClipboardImageData();

        if (!clipboardData) {
          throw new Error('No image data available in clipboard');
        }

        // TODO: we're doing two layers of conversion here:
        //   clipboardData -> ImagePickerAsset -> UploadIntent
        // `createImageAssetFromClipboardData` in particular lies about the
        // image's dimensions - we should probably remove one layer
        const clipboardAsset = createImageAssetFromClipboardData(clipboardData);
        const atts = [
          Attachment.UploadIntent.fromImagePickerAsset(clipboardAsset),
        ];
        attachAssets(atts);
        onAttach?.(atts);
      } catch (error) {
        logger.trackError('Error pasting from clipboard', error);
      }
    });
  }, [attachAssets, getClipboardImageData, onAttach, runAfterSheetClose]);

  const takePicture = useCallback(() => {
    runPickerFlow({
      permissionStatus: cameraPermissionStatus ?? null,
      requestPermission: requestCameraPermission,
      launchPicker: () =>
        ImagePicker.launchCameraAsync({
          mediaTypes: pickerMediaTypes,
          allowsEditing: false,
          quality: 0.5,
          exif: false,
        }),
      attachPlaceholderDelayMs: 0,
      errorMessage: 'Error taking picture',
    });
  }, [
    cameraPermissionStatus,
    pickerMediaTypes,
    requestCameraPermission,
    runPickerFlow,
  ]);

  const pickImage = useCallback(() => {
    runPickerFlow({
      permissionStatus: mediaLibraryPermissionStatus ?? null,
      requestPermission: requestMediaLibraryPermission,
      launchPicker: () =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: pickerMediaTypes,
          allowsEditing: false,
          quality: 0.5,
          exif: false,
        }),
      attachPlaceholderDelayMs: 200,
      errorMessage: 'Error picking image',
    });
  }, [
    mediaLibraryPermissionStatus,
    pickerMediaTypes,
    requestMediaLibraryPermission,
    runPickerFlow,
  ]);

  const startFilePicker = useCallback(async () => {
    onOpenChange(false);

    const uploadIntents = await pickFile();
    const normalized = await normalizeUploadIntents(uploadIntents);
    if (normalized.length > 0) {
      setAttachmentErrorMessage(null);
      attachAssets(normalized);
      onAttach?.(normalized);
    }
  }, [
    attachAssets,
    onOpenChange,
    onAttach,
    normalizeUploadIntents,
    setAttachmentErrorMessage,
  ]);
  const [canRecordVoiceMemos] = useFeatureFlag('recordVoiceMemos');

  const actionGroups: ActionGroup[] = useMemo(
    () =>
      createActionGroups(
        [
          'neutral',
          {
            title: useVideoInMediaPicker
              ? isWeb
                ? 'Upload Media'
                : 'Media Library'
              : isWeb
                ? 'Upload an Image'
                : 'Photo Library',
            description: isWeb
              ? useVideoInMediaPicker
                ? 'Upload an image or video from your computer'
                : 'Upload an image from your computer'
              : useVideoInMediaPicker
                ? 'Choose a photo or video from your library'
                : 'Choose a photo from your library',
            action: pickImage,
          },
          !isWeb && {
            title: useVideoInMediaPicker
              ? 'Capture Photo or Video'
              : 'Take a Photo',
            description: useVideoInMediaPicker
              ? 'Use your camera to capture a photo or video'
              : 'Use your camera to take a photo',
            action: takePicture,
          },
          !isWeb &&
            hasClipboardImage && {
              title: 'Paste from Clipboard',
              description: 'Use the image currently in your clipboard',
              action: createAssetFromClipboard,
            },
          mediaType === 'all' && {
            title: 'Upload a File',
            description: 'Upload files from your device',
            action: startFilePicker,
          },
          mediaType === 'all' &&
            canRecordVoiceMemos &&
            !isWeb && {
              title: 'Voice Memo',
              description: 'Record an audio message',
              action: startRecordingVoiceMemo,
            },
        ],
        showClearOption && [
          'negative',
          {
            title: 'Clear',
            description: 'Remove attached media',
            action: onClearAttachments,
          },
        ]
      ),
    [
      startRecordingVoiceMemo,
      canRecordVoiceMemos,
      onClearAttachments,
      pickImage,
      startFilePicker,
      showClearOption,
      takePicture,
      hasClipboardImage,
      createAssetFromClipboard,
      mediaType,
      useVideoInMediaPicker,
    ]
  );

  const title = 'Attach a file';
  const subtitle = 'Choose a file to attach';
  const storageInfoQuery = useStorageInfoQuery();

  return (
    <>
      <ActionSheet
        open={showAttachmentSheet}
        onOpenChange={(open: boolean) => onOpenChange(open)}
        modal
      >
        <ActionSheet.Header>
          {storageInfoQuery.isSuccess && storageInfoQuery.data == null ? (
            // If we definitively do not have storage info, fall back to info box
            <>
              <ListItem.MainContent>
                <ListItem.Title>{title}</ListItem.Title>
                <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
              </ListItem.MainContent>
              <ListItem.EndContent
                onPress={() => onOpenChange(false)}
                testID="AttachmentSheetCloseButton"
              >
                <Button
                  preset="minimal"
                  onPress={() => onOpenChange(false)}
                  testID="AttachmentSheetCloseButton"
                  label="Cancel"
                />
              </ListItem.EndContent>
            </>
          ) : (
            <ListItem.MainContent height={undefined}>
              <StorageQuotaIndicator storageInfoQuery={storageInfoQuery} />
            </ListItem.MainContent>
          )}
        </ActionSheet.Header>
        <ActionSheet.Content>
          <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
        </ActionSheet.Content>
      </ActionSheet>
      {audioRecorder.mount()}
    </>
  );
}

function useAudioRecorderController({
  onSubmit,
}: {
  onSubmit?: (opts: {
    audioFilePath: string;
    waveformPreview?: number[];
  }) => void;
}) {
  const safeAreaInsets = useSafeAreaInsets();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const audioRecorderRef = useRef<ComponentRef<typeof AudioRecorder> | null>(
    null
  );

  return {
    mount: () => (
      <AudioRecorderSheet
        open={isSheetOpen}
        disableDrag
        snapPointsMode="fit"
        audioRecorderProps={{
          startInRecordingMode: true,
          paddingBottom: safeAreaInsets.bottom,
          onSubmit,
          onCancel() {
            setIsSheetOpen(false);
          },
          ref: audioRecorderRef,
        }}
      />
    ),
    present: () => setIsSheetOpen(true),
    dismiss: () => setIsSheetOpen(false),
  };
}
