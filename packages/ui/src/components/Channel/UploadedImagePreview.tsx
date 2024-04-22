import { Upload } from '@tloncorp/shared/dist/urbit';
import { ImageBackground } from 'react-native';

import { Close } from '../../assets/icons';
import { View, XStack } from '../../core';
import { Button } from '../Button';

export default function UploadedImagePreview({
  uploadedImage,
  resetImageAttachment,
}: {
  uploadedImage: Upload;
  resetImageAttachment: () => void;
}) {
  return (
    <XStack
      padding="$l"
      borderRadius="$xl"
      backgroundColor="$background"
      flex={1}
    >
      <ImageBackground
        source={{
          uri: uploadedImage.url,
        }}
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'flex-end',
        }}
        imageStyle={{
          borderRadius: 16,
        }}
      >
        <XStack paddingTop="$xl" paddingHorizontal="$l" alignItems="flex-end">
          <View>
            <Button
              onPress={() => {
                resetImageAttachment();
              }}
              borderRadius="$radius.4xl"
              backgroundColor="$background"
            >
              <Button.Icon>
                <Close />
              </Button.Icon>
            </Button>
          </View>
        </XStack>
      </ImageBackground>
    </XStack>
  );
}
