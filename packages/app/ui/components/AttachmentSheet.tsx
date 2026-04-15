import {
  Attachment,
  PLACEHOLDER_ASSET_URI,
  VoiceMemoAttachment,
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
import { Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isWeb } from 'tamagui';

import {
  imagePickerAssetToUploadIntent,
  normalizeUploadIntents,
  pickFile,
} from '../../utils/filepicker';
import {
  getAudioFileDurationSeconds,
  getFileSize,
  getMimeType,
} from '../../utils/files';
import { normalizeImagePickerAssetForUpload } from '../../utils/imagePickerAsset';
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
import { useDraftInputContext } from './draftInputs/shared';

const logger = createDevLogger('AttachmentSheet', true);

export default function AttachmentSheet({
  isOpen: showAttachmentSheet,
  onOpenChange: onOpenChange,
  showClearOption,
  onClearAttachments,
  onAttach,
  mediaType,
  allowVideoInMediaPicker,
}: {
  isOpen: boolean;
  showClearOption?: boolean;
  onClearAttachments?: () => void;
  onOpenChange: (open: boolean) => void;
  onAttach?: (assets: Attachment.UploadIntent[]) => void;
  mediaType: 'image' | 'all';
  allowVideoInMediaPicker?: boolean;
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
    uploadAssets,
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

  const useVideoInMediaPicker = allowVideoInMediaPicker ?? mediaType === 'all';
  const pickerMediaTypes: ImagePicker.MediaType[] = useMemo(
    () => (useVideoInMediaPicker ? ['images', 'videos'] : ['images']),
    [useVideoInMediaPicker]
  );

  const attachNormalizedUploadIntents = useCallback(
    async (uploadIntents: Attachment.UploadIntent[]) => {
      const { uploadIntents: normalizedUploadIntents, errorMessage } =
        await normalizeUploadIntents(uploadIntents);

      if (errorMessage) {
        Alert.alert('Unable to attach', errorMessage);
      }

      if (normalizedUploadIntents.length > 0) {
        attachAssets(normalizedUploadIntents);
        onAttach?.(normalizedUploadIntents);
      }
    },
    [attachAssets, onAttach]
  );

  const takePicture = useCallback(
    (cameraMediaTypes: ImagePicker.MediaType[] = pickerMediaTypes) => {
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
            mediaTypes: cameraMediaTypes,
            allowsEditing: false,
            quality: 0.5,
            exif: false,
          });

          if (!result.canceled) {
            // Replace the placeholder with the real image data
            const realAsset = result.assets[0];

            removePlaceholderAttachment();
            await attachNormalizedUploadIntents([
              imagePickerAssetToUploadIntent(
                normalizeImagePickerAssetForUpload(realAsset)
              ),
            ]);
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
    },
    [
      attachAssets,
      clearAttachments,
      onOpenChange,
      cameraPermissionStatus,
      pickerMediaTypes,
      requestCameraPermission,
      placeholderUploadIntent,
      attachNormalizedUploadIntents,
      removePlaceholderAttachment,
    ]
  );

  const takePhoto = useCallback(() => takePicture(['images']), [takePicture]);
  const takeVideo = useCallback(() => takePicture(['videos']), [takePicture]);

  const draftInputContext = useDraftInputContext();
  const audioRecorder = useAudioRecorderController({
    async onSubmit({ audioFilePath, waveformPreview }) {
      const duration = await (async () => {
        try {
          return await getAudioFileDurationSeconds(audioFilePath);
        } catch {
          return undefined;
        }
      })();
      const attachment: VoiceMemoAttachment = {
        type: 'voicememo',
        localUri: filePathToFileUri(audioFilePath),
        size: getFileSize(audioFilePath) ?? -1,
        waveformPreview,
        duration: duration ?? undefined,
        mimeType: getMimeType(audioFilePath) ?? undefined,
      };
      audioRecorder.dismiss();

      // If possible, try sending post immediately.
      if (draftInputContext != null) {
        const ui = Attachment.toUploadIntent(attachment);
        if (ui.needsUpload) {
          uploadAssets([ui], {
            // without this flag, attachment context tries to add the uploaded
            // attachment to the context's attachment list, which ends up
            // showing in the draft box. we want to skip the preview entirely.
            skipAddToAttachmentList: true,
          });
        }
        await draftInputContext.sendPostFromDraft({
          channelId: draftInputContext.channel.id,
          channelType: draftInputContext.channel.type,
          content: [],
          attachments: [attachment],
          ...(draftInputContext.editingPost == null
            ? {
                isEdit: false,
              }
            : {
                isEdit: true,
                editTargetPostId: draftInputContext.editingPost.id,
              }),
          replyToPostId: null,
        });
      } else {
        // otherwise, add attachment to draft
        addAttachment(attachment);
      }
    },
  });
  const startRecordingVoiceMemo = useCallback(() => {
    // Close the sheet immediately
    onOpenChange(false);
    audioRecorder.present();
  }, [onOpenChange, audioRecorder]);

  const pickImage = useCallback(() => {
    const openImagePicker = async () => {
      try {
        if (mediaLibraryPermissionStatus?.granted === false) {
          const permissionResult = await requestMediaLibraryPermission();
          if (!permissionResult.granted) {
            return;
          }
        }

        // Show loading placeholder as soon as the sheet closes, before waiting
        // on the native media picker round-trip.
        if (Platform.OS !== 'web') {
          attachAssets([placeholderUploadIntent]);
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: pickerMediaTypes,
          allowsEditing: false,
          quality: 0.5,
          exif: false,
        });

        if (!result.canceled) {
          const realAsset = result.assets[0];
          const normalizedAsset = normalizeImagePickerAssetForUpload(realAsset);

          const { uploadIntents: normalizedUploadIntents, errorMessage } =
            await normalizeUploadIntents([
              imagePickerAssetToUploadIntent(normalizedAsset),
            ]);

          // Remove placeholder before attaching the selected media so validation
          // does not reject the real attachment as "extra".
          removePlaceholderAttachment();

          if (errorMessage) {
            Alert.alert('Unable to attach', errorMessage);
          }

          if (normalizedUploadIntents.length > 0) {
            attachAssets(normalizedUploadIntents);
            onAttach?.(normalizedUploadIntents);
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
      }
    };

    // Close the sheet immediately
    onOpenChange(false);

    if (Platform.OS === 'web') {
      // File picker must open in the same user gesture on web.
      void openImagePicker();
      return;
    }

    // Native: wait for close animation to complete before opening picker.
    setTimeout(() => {
      void openImagePicker();
    }, 50);
  }, [
    attachAssets,
    clearAttachments,
    onOpenChange,
    mediaLibraryPermissionStatus,
    pickerMediaTypes,
    requestMediaLibraryPermission,
    placeholderUploadIntent,
    onAttach,
    removePlaceholderAttachment,
  ]);

  const startFilePicker = useCallback(async () => {
    onOpenChange(false);

    const { uploadIntents, errorMessage } = await pickFile();
    if (errorMessage) {
      Alert.alert('Unable to attach', errorMessage);
      return;
    }
    await attachNormalizedUploadIntents(uploadIntents);
  }, [attachNormalizedUploadIntents, onOpenChange]);

  const actionGroups: ActionGroup[] = useMemo(
    () =>
      createActionGroups(
        [
          'neutral',
          // The sheet is only shown on mobile — on web, AttachmentButton
          // skips straight to the system file picker.
          {
            title: useVideoInMediaPicker ? 'Media Library' : 'Photo Library',
            description: useVideoInMediaPicker
              ? 'Choose a photo or video from your library'
              : 'Choose a photo from your library',
            action: pickImage,
          },
          !isWeb &&
            Platform.OS !== 'android' && {
              title: useVideoInMediaPicker
                ? 'Capture Photo or Video'
                : 'Take a Photo',
              description: useVideoInMediaPicker
                ? 'Use your camera to capture a photo or video'
                : 'Use your camera to take a photo',
              action: takePicture,
            },
          Platform.OS === 'android' && {
            title: 'Capture photo',
            description: 'Use your camera to capture a photo',
            action: takePhoto,
          },
          Platform.OS === 'android' &&
            useVideoInMediaPicker && {
              title: 'Capture video',
              description: 'Use your camera to capture a video',
              action: takeVideo,
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
      onClearAttachments,
      pickImage,
      startFilePicker,
      showClearOption,
      takePhoto,
      takeVideo,
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

function filePathToFileUri(filePath: string) {
  try {
    // if this is already a valid URI, return it as-is
    return new URL(filePath).toString();
  } catch {
    // otherwise, assume it's a file path and convert to file URI
    // if there was some other kind of error, this will likely also fail, but we'll let that error propagate
    return new URL(`file://${filePath}`).toString();
  }
}
