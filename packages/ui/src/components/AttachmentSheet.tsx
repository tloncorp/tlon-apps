import { MessageAttachments } from '@tloncorp/shared/dist/api';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo } from 'react';

import { ActionGroup, ActionSheet, createActionGroup } from './ActionSheet';
import { ListItem } from './ListItem';

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
    onOpenChange(false);
    // The image picker is attempting to mount inside the sheet, but
    // the sheet closes before the picker can mount. This adds
    // a slight timeout to let the picker have enough time to mount.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      exif: false,
    });

    if (!result.canceled) {
      onAttachmentsSet(result.assets);
    }
  }, [onAttachmentsSet, onOpenChange]);

  const pickImage = useCallback(async () => {
    onOpenChange(false);
    // See the comment above about the picker not mounting in time.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      exif: false,
    });

    if (!result.canceled) {
      onAttachmentsSet(result.assets);
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
