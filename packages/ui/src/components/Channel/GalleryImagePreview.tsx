import { useCallback } from 'react';
import { ImageBackground } from 'react-native';

import { Close } from '../../assets/icons';
import {
  ImageAttachment,
  useMessageInputContext,
} from '../../contexts/messageInput';
import { Spinner, View, XStack } from '../../core';
import { Button } from '../Button';

export default function GalleryImagePreview({
  onReset,
}: {
  onReset: () => void;
}) {
  const { attachments, resetAttachments } = useMessageInputContext();
  const imageAttachment = attachments.filter(
    (a): a is ImageAttachment => a.type === 'image'
  )[0];

  const handleClosePressed = useCallback(() => {
    resetAttachments([]);
    onReset();
  }, [resetAttachments, onReset]);

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
            uri: imageAttachment?.file.uri,
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
                onPress={handleClosePressed}
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
        {imageAttachment?.uploadState?.status === 'uploading' && (
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
