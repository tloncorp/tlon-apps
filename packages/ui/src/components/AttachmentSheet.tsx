import { MessageAttachments } from '@tloncorp/shared/dist/api';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect } from 'react';

import { ActionSheet } from './ActionSheet';

export default function AttachmentSheet({
  showAttachmentSheet,
  setShowAttachmentSheet,
  setImage,
  onStartDrawing,
}: {
  showAttachmentSheet: boolean;
  setShowAttachmentSheet: (open: boolean) => void;
  setImage: (attachments: MessageAttachments) => void;
  onStartDrawing: () => void;
}) {
  const [mediaLibraryPermissionStatus, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [cameraPermissionStatus, requestCameraPermission] =
    ImagePicker.useCameraPermissions();

  const takePicture = async () => {
    setShowAttachmentSheet(false);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      exif: false,
    });

    if (!result.canceled) {
      setImage(result.assets);
    }
  };

  const pickImage = async () => {
    setShowAttachmentSheet(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      exif: false,
    });

    if (!result.canceled) {
      setImage(result.assets);
    }
  };

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

  const startDrawing = useCallback(() => {
    setShowAttachmentSheet(false);
    onStartDrawing();
  }, [onStartDrawing, setShowAttachmentSheet]);

  const actions = [
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
    {
      title: 'Drawing',
      description: 'Create a drawing',
      action: startDrawing,
    },
  ];

  return (
    <ActionSheet
      open={showAttachmentSheet}
      onOpenChange={(open: boolean) => setShowAttachmentSheet(open)}
    >
      <ActionSheet.Header>
        <ActionSheet.Title>Attach a file</ActionSheet.Title>
        <ActionSheet.Description>
          Choose a file to attach
        </ActionSheet.Description>
      </ActionSheet.Header>
      {actions.map((action, index) => (
        <ActionSheet.Action key={index} action={action.action}>
          <ActionSheet.ActionTitle>{action.title}</ActionSheet.ActionTitle>
          <ActionSheet.ActionDescription>
            {action.description}
          </ActionSheet.ActionDescription>
        </ActionSheet.Action>
      ))}
    </ActionSheet>
  );
}
