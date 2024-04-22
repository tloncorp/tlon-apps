import { Upload } from '@tloncorp/shared/dist/urbit';
import { useState } from 'react';
import { ImageBackground } from 'react-native';

import { Close } from '../../assets/icons';
import { Spinner, View, XStack } from '../../core';
import { Button } from '../Button';

export default function UploadedImagePreview({
  uploadedImage,
  resetImageAttachment,
}: {
  uploadedImage: Upload;
  resetImageAttachment: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <XStack
      padding="$l"
      borderRadius="$xl"
      backgroundColor="$background"
      flex={1}
    >
      <View flex={1} position="relative">
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
          onLoadEnd={() => {
            setIsLoading(false);
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
        {isLoading && (
          <View
            position="absolute"
            top="50%"
            left="50%"
            justifyContent="center"
            alignItems="center"
          >
            <Spinner size="large" color="$text" />
          </View>
        )}
      </View>
    </XStack>
  );
}
