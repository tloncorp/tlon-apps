import { Upload } from '@tloncorp/shared/dist/api';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';

import { Add } from '../../assets/icons';
import { Spinner, View } from '../../core';
import ActionSheet, { Action } from '../ActionSheet';
import { IconButton } from '../IconButton';

export default function AttachmentButton({
  setImage,
  uploadedImage,
}: {
  setImage: (uri: string | null) => void;
  uploadedImage?: Upload | null;
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
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
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
      setImage(result.assets[0].uri);
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

  return (
    <>
      {uploadedImage && uploadedImage.url === '' ? (
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
        sheetTitle="Add an attachment"
        actions={
          [
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
          ] as Action[]
        }
      />
    </>
  );
}
