import { Upload } from '@tloncorp/shared/dist/urbit';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';

import { Add, Camera, ChannelGalleries } from '../../assets/icons';
import { Popover, Separator, Spinner, View, YGroup } from '../../core';
import { Button } from '../Button';

export default function AttachmentButton({
  setImage,
  uploadedImage,
}: {
  setImage: (uri: string | null) => void;
  uploadedImage?: Upload | null;
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
      allowsEditing: true,
      quality: 1,
      exif: false,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  useEffect(() => {
    if (mediaLibraryPermissionStatus?.granted === false) {
      requestMediaLibraryPermission();
    }

    if (cameraPermissionStatus?.granted === false) {
      requestCameraPermission();
    }
  }, [mediaLibraryPermissionStatus]);

  return (
    <Popover
      open={showPopover}
      onOpenChange={(open: boolean) => setShowPopover(open)}
      placement="top"
      allowFlip={false}
      stayInFrame={true}
    >
      <Popover.Trigger>
        <Button.Icon>
          {uploadedImage && uploadedImage.url === '' ? (
            <View alignItems="center" padding="$m">
              <Spinner />
            </View>
          ) : (
            <Add />
          )}
        </Button.Icon>
      </Popover.Trigger>
      <Popover.Content
        borderWidth={1}
        borderColor="$positiveBorder"
        enterStyle={{ y: -10, opacity: 0 }}
        exitStyle={{ y: -10, opacity: 0 }}
        elevate
        animation={[
          // @ts-expect-error this is fine
          'quick',
          {
            opacity: {
              overshootClamping: true,
            },
          },
        ]}
      >
        <YGroup separator={<Separator borderColor="$positiveBorder" />}>
          <YGroup.Item>
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
          </YGroup.Item>
          <YGroup.Item>
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
          </YGroup.Item>
        </YGroup>
      </Popover.Content>
    </Popover>
  );
}
