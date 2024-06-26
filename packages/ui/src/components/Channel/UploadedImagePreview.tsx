import { useState } from 'react';
import { ImageBackground } from 'react-native';

import { Close } from '../../assets/icons';
import { Spinner, View, XStack } from '../../core';
import { Button } from '../Button';

export default function UploadedImagePreview({
  imageAttachment,
  resetImageAttachment,
  uploading,
}: {
  imageAttachment: string;
  resetImageAttachment: () => void;
  uploading?: boolean;
}) {
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
            uri: imageAttachment,
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
        {uploading && (
          <View
            position="absolute"
            top={0}
            justifyContent="center"
            width="100%"
            height="100%"
            alignItems="center"
            backgroundColor="$translucentBlack"
            borderRadius="$l"
          >
            <Spinner size="large" color="$primaryText" />
          </View>
        )}
      </View>
    </XStack>
  );
}
