import {
  MessageAttachments,
  Upload,
  UploadInfo,
} from '@tloncorp/shared/dist/api';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';

import { Add } from '../../assets/icons';
import { Spinner, View } from '../../core';
import { ActionSheet } from '../ActionSheet';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  uploadInfo,
}: {
  uploadInfo: UploadInfo;
}) {
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [mediaLibraryPermissionStatus, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [cameraPermissionStatus, requestCameraPermission] =
    ImagePicker.useCameraPermissions();

  const takePicture = async () => {
    setShowInputSelector(false);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      exif: false,
      base64: true,
    });

    if (!result.canceled) {
      uploadInfo.setAttachments(result.assets);
    }
  };

  const pickImage = async () => {
    setShowInputSelector(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      exif: false,
    });

    if (!result.canceled) {
      uploadInfo.setAttachments(result.assets);
    }
  };

  useEffect(() => {
    if (showInputSelector && mediaLibraryPermissionStatus?.granted === false) {
      requestMediaLibraryPermission();
    }

    if (showInputSelector && cameraPermissionStatus?.granted === false) {
      requestCameraPermission();
    }
  }, [
    mediaLibraryPermissionStatus,
    showInputSelector,
    cameraPermissionStatus,
    requestMediaLibraryPermission,
    requestCameraPermission,
  ]);

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
  ];

  return (
    <>
      {uploadInfo.uploadedImage && uploadInfo.uploadedImage.url === '' ? (
        <View alignItems="center" padding="$m">
          <Spinner />
        </View>
      ) : (
        <IconButton onPress={() => setShowInputSelector(true)}>
          <Add />
        </IconButton>
      )}
      <ActionSheet
        open={showInputSelector}
        onOpenChange={(open: boolean) => setShowInputSelector(open)}
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
    </>
  );
}
