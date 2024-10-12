import { createDevLogger } from '@tloncorp/shared/dist';
import { MessageAttachments } from '@tloncorp/shared/dist/api';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo } from 'react';

import { ActionGroup, ActionSheet, createActionGroup } from './ActionSheet';
import { ListItem } from './ListItem';

const logger = createDevLogger('AttachmentSheet', true);

export default function AttachmentSheet({
  isOpen: showAttachmentSheet,
  onOpenChange: onOpenChange,
  showClearOption,
  onClearAttachments,
  onAttachmentsSet: onAttachmentsSet,
}: {
  isOpen: boolean;
  showClearOption?: boolean;
  onClearAttachments?: () => void;
  onOpenChange: (open: boolean) => void;
  onAttachmentsSet: (attachments: MessageAttachments) => void;
}) {
  const [mediaLibraryPermissionStatus, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [cameraPermissionStatus, requestCameraPermission] =
    ImagePicker.useCameraPermissions();

  const takePicture = useCallback(async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
        exif: false,
      });

      onOpenChange(false);

      if (!result.canceled) {
        onAttachmentsSet(result.assets);
      }
    } catch (e) {
      console.error('Error taking picture', e);
      logger.trackError('Error taking picture', { error: e });
    }
  }, [onAttachmentsSet, onOpenChange]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
        exif: false,
      });

      onOpenChange(false);

      if (!result.canceled) {
        onAttachmentsSet(result.assets);
      }
    } catch (e) {
      console.error('Error picking image', e);
      logger.trackError('Error picking image', { error: e });
    }
  }, [onAttachmentsSet, onOpenChange]);

  useEffect(() => {
    if (
      showAttachmentSheet &&
      mediaLibraryPermissionStatus?.granted === false
    ) {
      requestMediaLibraryPermission();
    }

    if (showAttachmentSheet && cameraPermissionStatus?.granted === false) {
      requestCameraPermission();
    }
  }, [
    mediaLibraryPermissionStatus,
    showAttachmentSheet,
    cameraPermissionStatus,
    requestMediaLibraryPermission,
    requestCameraPermission,
  ]);

  const actionGroups: ActionGroup[] = useMemo(
    () => [
      createActionGroup(
        'neutral',
        {
          title: 'Photo Library',
          description: 'Choose a photo from your library',
          action: pickImage,
        },
        {
          title: 'Take a Photo',
          description: 'Use your camera to take a photo',
          action: takePicture,
        },
        showClearOption && {
          title: 'Clear',
          description: 'Remove attached media',
          action: onClearAttachments,
        }
      ),
    ],
    [onClearAttachments, pickImage, showClearOption, takePicture]
  );

  const title = 'Attach a file';
  const subtitle = 'Choose a file to attach';

  return (
    <ActionSheet
      open={showAttachmentSheet}
      onOpenChange={(open: boolean) => onOpenChange(open)}
    >
      <ActionSheet.Header>
        <ListItem.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
        </ListItem.MainContent>
      </ActionSheet.Header>
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
