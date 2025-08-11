import { ImageAttachment } from '@tloncorp/shared';
import { ImageBackground } from 'react-native';
import { Spinner, View, XStack } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';

function GalleryImagePreview() {
  const { attachments } = useAttachmentContext();
  const imageAttachment = attachments.filter(
    (a): a is ImageAttachment => a.type === 'image'
  )[0];

  return (
    <XStack backgroundColor="$background" flex={1}>
      <View flex={1} position="relative">
        <ImageBackground
          source={{
            uri: imageAttachment?.file.uri,
          }}
          style={{
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            opacity:
              imageAttachment?.uploadState?.status === 'uploading' ? 0.5 : 1,
          }}
          resizeMode="contain"
        >
          {imageAttachment?.uploadState?.status === 'uploading' && (
            <View
              top={0}
              justifyContent="center"
              padding="$xl"
              alignItems="center"
              backgroundColor="$translucentBlack"
              borderRadius="$m"
            >
              <Spinner size="large" color="$primaryText" />
            </View>
          )}
        </ImageBackground>
      </View>
    </XStack>
  );
}

export default GalleryImagePreview;
