import { MessageAttachments } from '@tloncorp/shared/dist/api';
import * as ImagePicker from 'expo-image-picker';
import { useEffect } from 'react';

import { ActionGroup, ActionSheet } from './ActionSheetV2';
import { ListItem } from './ListItem';

export default function AttachmentSheet({
  showAttachmentSheet,
  setShowAttachmentSheet,
  setImage,
}: {
  showAttachmentSheet: boolean;
  setShowAttachmentSheet: (open: boolean) => void;
  setImage: (attachments: MessageAttachments) => void;
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

  const actionGroups: ActionGroup[] = [
    {
      accent: 'neutral',
      actions: [
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
      ],
    },
  ];

  const title = 'Attach a file';
  const subtitle = 'Choose a file to attach';

  return (
    <ActionSheet
      open={showAttachmentSheet}
      onOpenChange={(open: boolean) => setShowAttachmentSheet(open)}
    >
      <ActionSheet.Header>
        <ListItem.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
        </ListItem.MainContent>
      </ActionSheet.Header>
      <ActionSheet.ScrollView>
        {actionGroups.map((group, i) => {
          return (
            <ActionSheet.ActionGroup key={i} accent={group.accent}>
              {group.actions.map((action, index) => (
                <ActionSheet.Action key={index} action={action} />
              ))}
            </ActionSheet.ActionGroup>
          );
        })}
      </ActionSheet.ScrollView>
    </ActionSheet>
  );
}
