import {
  Attachment,
  PLACEHOLDER_ASSET_URI,
  createDevLogger,
} from '@tloncorp/shared';
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
import fs from '../../utils/files';
import { useAttachmentContext } from '../contexts';
import {
  createImageAssetFromClipboardData,
  getClipboardImageWithFallbacks,
} from '../utils';
import { ActionGroup, ActionSheet, createActionGroups } from './ActionSheet';
import { AudioRecorder, AudioRecorderSheet } from './AudioRecorder';
import { ListItem } from './ListItem';
import {
  StorageQuotaIndicator,
  useStorageInfoQuery,
} from './StorageQuotaIndicator';

const logger = createDevLogger('AttachmentSheet', true);
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const VIDEO_MIME_ALLOWLIST = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const VIDEO_EXTENSION_REGEX = /\.(mp4|mov|webm)(?:\?.*)?$/i;

function isLikelyVideo({
  mimeType,
  name,
  uri,
}: {
  mimeType?: string;
  name?: string;
  uri?: string;
}) {
  return (
    (!!mimeType && mimeType.toLowerCase().startsWith('video/')) ||
    (!!name && VIDEO_EXTENSION_REGEX.test(name)) ||
    (!!uri && VIDEO_EXTENSION_REGEX.test(uri))
  );
}

function validateVideo({
  mimeType,
  size,
  name,
  uri,
}: {
  mimeType?: string;
  size?: number;
  name?: string;
  uri?: string;
}) {
  if (size == null || size < 0) {
    return {
      valid: false,
      reason: 'Unable to determine video size',
    };
  }
  if (size > MAX_VIDEO_SIZE_BYTES) {
    return {
      valid: false,
      reason: 'Video exceeds the 100MB upload limit',
    };
  }
  if (mimeType) {
    if (!VIDEO_MIME_ALLOWLIST.has(mimeType.toLowerCase())) {
      return {
        valid: false,
        reason: `Unsupported video format: ${mimeType}`,
      };
    }
    return { valid: true };
  }
  if (!isLikelyVideo({ name, uri })) {
    return {
      valid: false,
      reason: 'Unsupported video format',
    };
  }
  return { valid: true };
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
  const statSize = fs.getFileSize(uri);
  if (typeof statSize === 'number' && statSize >= 0) {
    return statSize;
  }
  return undefined;
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

  const createAssetFromClipboard = useCallback(async () => {
    onOpenChange(false);
    // Wait for sheet close animation to complete before pasting
    setTimeout(async () => {
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
    }, 50);
  }, [attachAssets, onAttach, onOpenChange, getClipboardImageData]);

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

  const takePicture = useCallback(() => {
    // Close the sheet immediately
    onOpenChange(false);

    // Then initiate the camera after a small delay to ensure sheet is closed
    setTimeout(async () => {
      try {
        if (cameraPermissionStatus?.granted === false) {
          const permissionResult = await requestCameraPermission();
          if (!permissionResult.granted) {
            return;
          }
        }

        // Immediately set the placeholder attachment to show in the UI
        // skip on web, the browser doesn't like trying to load a file that doesn't exist
        if (Platform.OS !== 'web') {
          attachAssets([placeholderUploadIntent]);
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.5,
          exif: false,
        });

        if (!result.canceled) {
          // Replace the placeholder with the real image data
          const realAsset = result.assets[0];

          removePlaceholderAttachment();
          const atts = [
            Attachment.UploadIntent.fromImagePickerAsset(realAsset),
          ];
          attachAssets(atts);
          onAttach?.(atts);
        } else {
          // If user canceled, remove the placeholder
          clearAttachments();
        }
      } catch (e) {
        console.error('Error taking picture', e);
        logger.trackError('Error taking picture', e);
        // In case of error, remove the placeholder
        clearAttachments();
      }
    }, 50); // Small delay to ensure the sheet closes first
  }, [
    attachAssets,
    clearAttachments,
    onAttach,
    onOpenChange,
    cameraPermissionStatus,
    requestCameraPermission,
    placeholderUploadIntent,
    removePlaceholderAttachment,
  ]);

  const audioRecorder = useAudioRecorderController({
    async onSubmit({ audioFilePath, waveformPreview }) {
      const duration = await (async () => {
        try {
          return await fs.getAudioFileDurationSeconds(audioFilePath);
        } catch {
          return undefined;
        }
      })();
      addAttachment({
        type: 'voicememo',
        localUri: audioFilePath,
        size: fs.getFileSize(audioFilePath) ?? -1,
        waveformPreview,
        duration: duration ?? undefined,
        mimeType: fs.getMimeType(audioFilePath) ?? undefined,
      });
      audioRecorder.dismiss();
    },
  });
  const startRecordingVoiceMemo = useCallback(() => {
    // Close the sheet immediately
    onOpenChange(false);
    audioRecorder.present();
  }, [onOpenChange, audioRecorder]);
  const [videoUploadPlayback] = useFeatureFlag('videoUploadPlayback');
  const useVideoInMediaPicker = mediaType === 'all' && videoUploadPlayback;

  const asUploadIntent = useCallback(
    (
      asset: ImagePicker.ImagePickerAsset
    ): Attachment.UploadIntent | null => {
      if (asset.type === 'video') {
        const resolvedSize = resolveVideoSize(asset.fileSize ?? undefined, asset.uri);
        const validation = validateVideo({
          mimeType: asset.mimeType ?? undefined,
          size: resolvedSize,
          name: asset.fileName ?? undefined,
          uri: asset.uri,
        });
        if (!validation.valid) {
          logger.trackError('video validation failed', validation);
          setAttachmentErrorMessage(
            validation.reason ?? 'Unable to attach video'
          );
          return null;
        }
        return {
          type: 'fileUri',
          localUri: asset.uri,
          name: asset.fileName ?? undefined,
          size: resolvedSize ?? -1,
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

  const normalizeUploadIntents = useCallback(
    (uploadIntents: Attachment.UploadIntent[]) => {
      return uploadIntents.flatMap((uploadIntent) => {
        if (!videoUploadPlayback) {
          return [uploadIntent];
        }
        if (uploadIntent.type === 'image') {
          return [uploadIntent];
        }
        if (uploadIntent.type === 'file') {
          const isVideo = isLikelyVideo({
            mimeType: uploadIntent.file.type,
            name: uploadIntent.file.name,
          });
          if (!isVideo) {
            return [uploadIntent];
          }
          const validation = validateVideo({
            mimeType: uploadIntent.file.type || undefined,
            size: uploadIntent.file.size,
            name: uploadIntent.file.name,
          });
          if (!validation.valid) {
            logger.trackError('video validation failed', validation);
            setAttachmentErrorMessage(
              validation.reason ?? 'Unable to attach video'
            );
            return [];
          }
          return [
            {
              ...uploadIntent,
              video: {},
            },
          ];
        }
        if (uploadIntent.type === 'fileUri') {
          if (uploadIntent.voiceMemo) {
            return [uploadIntent];
          }
          const resolvedSize = resolveVideoSize(
            uploadIntent.size,
            uploadIntent.localUri
          );
          const isVideo = isLikelyVideo({
            mimeType: uploadIntent.mimeType,
            name: uploadIntent.name,
            uri: uploadIntent.localUri,
          });
          if (!isVideo) {
            return [uploadIntent];
          }
          const validation = validateVideo({
            mimeType: uploadIntent.mimeType,
            size: resolvedSize,
            name: uploadIntent.name,
            uri: uploadIntent.localUri,
          });
          if (!validation.valid) {
            logger.trackError('video validation failed', validation);
            setAttachmentErrorMessage(
              validation.reason ?? 'Unable to attach video'
            );
            return [];
          }
          return [
            {
              ...uploadIntent,
              size: resolvedSize ?? uploadIntent.size,
              video: uploadIntent.video ?? {},
            },
          ];
        }
        return [];
      });
    },
    [videoUploadPlayback]
  );

  const pickImage = useCallback(() => {
    // Close the sheet immediately
    onOpenChange(false);

    // Then initiate the actual image picking process after a small delay to ensure sheet is closed
    setTimeout(async () => {
      let placeholderTimeout: ReturnType<typeof setTimeout> | null = null;

      try {
        if (mediaLibraryPermissionStatus?.granted === false) {
          const permissionResult = await requestMediaLibraryPermission();
          if (!permissionResult.granted) {
            return;
          }
        }

        // Wait for the attachment sheet to pop, then set the placeholder attachment to show in the UI
        // skip on web, the browser doesn't like trying to load a file that doesn't exist
        placeholderTimeout = setTimeout(() => {
          if (Platform.OS !== 'web') {
            attachAssets([placeholderUploadIntent]);
          }
        }, 200);

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: useVideoInMediaPicker ? ['images', 'videos'] : ['images'],
          allowsEditing: false,
          quality: 0.5,
          exif: false,
        });

        if (!result.canceled) {
          // Replace the placeholder with the real image data
          const realAsset = result.assets[0];
          const uploadIntent = asUploadIntent(realAsset);

          removePlaceholderAttachment();
          if (uploadIntent) {
            const atts = normalizeUploadIntents([uploadIntent]);
            if (atts.length > 0) {
              setAttachmentErrorMessage(null);
              attachAssets(atts);
              onAttach?.(atts);
            }
          }
        } else {
          // If user canceled, remove the placeholder
          clearAttachments();
        }
      } catch (e) {
        console.error('Error picking image', e);
        logger.trackError('Error picking image', e);

        // In case of error, remove the placeholder
        clearAttachments();
      } finally {
        if (placeholderTimeout) {
          clearTimeout(placeholderTimeout);
        }
      }
    }, 50); // Small delay to ensure the sheet closes first
  }, [
    attachAssets,
    clearAttachments,
    onAttach,
    onOpenChange,
    mediaLibraryPermissionStatus,
    requestMediaLibraryPermission,
    placeholderUploadIntent,
    removePlaceholderAttachment,
    useVideoInMediaPicker,
    asUploadIntent,
    normalizeUploadIntents,
    setAttachmentErrorMessage,
  ]);

  const startFilePicker = useCallback(async () => {
    onOpenChange(false);

    const uploadIntents = await pickFile();
    const normalized = normalizeUploadIntents(uploadIntents);
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
            title:
              useVideoInMediaPicker
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
            title: 'Take a Photo',
            description: 'Use your camera to take a photo',
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
