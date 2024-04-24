import { Upload } from '@tloncorp/shared/dist/api';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';

import { Add, Camera, ChannelGalleries } from '../../assets/icons';
import { Spinner, View, YStack } from '../../core';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Sheet } from '../Sheet';

export default function AttachmentButton({
  setImage,
  uploadedImage,
  paddingBottom,
}: {
  setImage: (uri: string | null) => void;
  uploadedImage?: Upload | null;
  paddingBottom: number;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const [mediaLibraryPermissionStatus, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const [cameraPermissionStatus, requestCameraPermission] =
    ImagePicker.useCameraPermissions();

  const takePicture = async () => {
    setShowPopover(false);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      exif: false,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    setShowPopover(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      exif: false,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  useEffect(() => {
    if (showPopover && mediaLibraryPermissionStatus?.granted === false) {
      requestMediaLibraryPermission();
    }

    if (showPopover && cameraPermissionStatus?.granted === false) {
      requestCameraPermission();
    }
  }, [
    mediaLibraryPermissionStatus,
    showPopover,
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
        <IconButton onPress={() => setShowPopover(true)}>
          <Add />
        </IconButton>
      )}
      <Sheet
        open={showPopover}
        onOpenChange={(open: boolean) => setShowPopover(open)}
        modal
        animation="quick"
        dismissOnSnapToBottom
        snapPointsMode="fit"
      >
        <Sheet.Overlay animation="quick" />
        <Sheet.Frame>
          <Sheet.Handle paddingTop="$xl" />
          <YStack
            paddingBottom={paddingBottom}
            gap="$xl"
            paddingHorizontal="$xl"
            paddingTop="$xl"
          >
            <Button
              borderWidth={0}
              alignItems="center"
              gap="$s"
              onPress={pickImage}
              padding="$xs"
            >
              <Button.Icon>
                <ChannelGalleries />
              </Button.Icon>
              <Button.Text size="$s">Photo Library</Button.Text>
            </Button>
            <Button
              borderWidth={0}
              alignItems="center"
              gap="$s"
              onPress={takePicture}
              padding="$xs"
            >
              <Button.Icon>
                <Camera />
              </Button.Icon>
              <Button.Text size="$s">Take a Photo</Button.Text>
            </Button>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
