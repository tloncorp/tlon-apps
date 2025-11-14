import {
  Attachment,
  PLACEHOLDER_ASSET_URI,
  createDevLogger,
} from '@tloncorp/shared';
import { Button } from '@tloncorp/ui';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { isWeb } from 'tamagui';

import { pickFile } from '../../utils/filepicker';
import { useAttachmentContext } from '../contexts';
import {
  createImageAssetFromClipboardData,
  getClipboardImageWithFallbacks,
} from '../utils';
import { ActionGroup, ActionSheet, createActionGroups } from './ActionSheet';
import { ListItem } from './ListItem';

const logger = createDevLogger('AttachmentSheet', true);

export default function AttachmentSheet({
  isOpen: showAttachmentSheet,
  onOpenChange: onOpenChange,
  showClearOption,
  onClearAttachments,
  onAttach,
}: {
  isOpen: boolean;
  showClearOption?: boolean;
  onClearAttachments?: () => void;
  onOpenChange: (open: boolean) => void;
  onAttach?: (assets: ImagePicker.ImagePickerAsset[]) => void;
}) {
  const [mediaLibraryPermissionStatus, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [cameraPermissionStatus, requestCameraPermission] =
    ImagePicker.useCameraPermissions();

  const { attachAssets, clearAttachments, removeAttachment } =
    useAttachmentContext();

  const [hasClipboardImage, setHasClipboardImage] = useState(false);

  const getClipboardImageData = useCallback(async (): Promise<{
    data: string;
    mimeType: string;
  } | null> => {
    try {
      return await getClipboardImageWithFallbacks();
    } catch (error) {
      logger.trackError('Clipboard access failed', { error });
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

        // TODO: we're doing two layers of conversion here - and
        // createImageAssetFromClipboardData in particular lies about the
        // image's dimensions. could probably remove one layer.
        const clipboardAsset = createImageAssetFromClipboardData(clipboardData);
        attachAssets([
          Attachment.UploadIntent.fromImagePickerAsset(clipboardAsset),
        ]);
        onAttach?.([clipboardAsset]);
      } catch (error) {
        logger.trackError('Error pasting from clipboard', { error });
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
          attachAssets([
            Attachment.UploadIntent.fromImagePickerAsset(realAsset),
          ]);
          onAttach?.(result.assets);
        } else {
          // If user canceled, remove the placeholder
          clearAttachments();
        }
      } catch (e) {
        console.error('Error taking picture', e);
        logger.trackError('Error taking picture', { error: e });
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

  const pickImage = useCallback(() => {
    // Close the sheet immediately
    onOpenChange(false);

    // Then initiate the actual image picking process after a small delay to ensure sheet is closed
    setTimeout(async () => {
      try {
        if (mediaLibraryPermissionStatus?.granted === false) {
          const permissionResult = await requestMediaLibraryPermission();
          if (!permissionResult.granted) {
            return;
          }
        }

        // Wait for the attachment sheet to pop, then set the placeholder attachment to show in the UI
        // skip on web, the browser doesn't like trying to load a file that doesn't exist
        setTimeout(() => {
          if (Platform.OS !== 'web') {
            attachAssets([placeholderUploadIntent]);
          }
        }, 200);

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.5,
          exif: false,
        });

        if (!result.canceled) {
          // Replace the placeholder with the real image data
          const realAsset = result.assets[0];

          removePlaceholderAttachment();
          attachAssets([
            Attachment.UploadIntent.fromImagePickerAsset(realAsset),
          ]);
          onAttach?.(result.assets);
        } else {
          // If user canceled, remove the placeholder
          clearAttachments();
        }
      } catch (e) {
        console.error('Error picking image', e);
        logger.trackError('Error picking image', { error: e });

        // In case of error, remove the placeholder
        clearAttachments();
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
  ]);

  const startFilePicker = useCallback(async () => {
    onOpenChange(false);

    const files = await pickFile();
    if (files.length > 0) {
      const uploadIntents = files.map((entry): Attachment.UploadIntent => {
        switch (entry.type) {
          case 'file': {
            return {
              type: 'file',
              file: entry.file,
            };
          }

          case 'uri': {
            return {
              type: 'fileUri',
              localUri: entry.uri,
            };
          }
        }
      });

      attachAssets(uploadIntents);
    }
  }, [attachAssets, onOpenChange]);

  const actionGroups: ActionGroup[] = useMemo(
    () =>
      createActionGroups(
        [
          'neutral',
          {
            title: isWeb ? 'Upload an image' : 'Photo Library',
            description: isWeb
              ? 'Upload an image from your computer'
              : 'Choose a photo from your library',
            action: pickImage,
          },
          {
            title: 'Upload a file',
            action: startFilePicker,
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
      onClearAttachments,
      pickImage,
      startFilePicker,
      showClearOption,
      takePicture,
      hasClipboardImage,
      createAssetFromClipboard,
    ]
  );

  const title = 'Attach a file';
  const subtitle = 'Choose a file to attach';

  return (
    <ActionSheet
      open={showAttachmentSheet}
      onOpenChange={(open: boolean) => onOpenChange(open)}
      modal
    >
      <ActionSheet.Header>
        <ListItem.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
        </ListItem.MainContent>
        <ListItem.EndContent
          onPress={() => onOpenChange(false)}
          testID="AttachmentSheetCloseButton"
        >
          <Button
            minimal
            onPress={() => onOpenChange(false)}
            testID="AttachmentSheetCloseButton"
          >
            <Button.Text>Cancel</Button.Text>
          </Button>
        </ListItem.EndContent>
      </ActionSheet.Header>
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
