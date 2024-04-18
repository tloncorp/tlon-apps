import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import { ComponentProps, useState } from 'react';
import { Dimensions, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image, View, XStack, YStack } from '../core';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export function PreviewableImage(
  props: ComponentProps<typeof Image> & {
    source: { uri: string; height?: number; width?: number };
  }
) {
  const { top } = useSafeAreaInsets();
  const [previewOpen, setPreviewOpen] = useState(false);
  const { source, ...rest } = props;

  return (
    <>
      <Button onPress={() => setPreviewOpen(true)} borderWidth={0}>
        <Image source={source} {...rest} />
      </Button>
      <Modal visible={previewOpen} onDismiss={() => setPreviewOpen(false)}>
        <YStack
          zIndex="$l"
          flex={1}
          backgroundColor="$black"
          justifyContent="center"
          alignItems="center"
          paddingHorizontal={20}
        >
          <XStack
            width="100%"
            paddingTop={top}
            borderWidth={1}
            borderColor="orange"
          ></XStack>
          <ImageZoom
            style={{ flex: 1 }}
            uri={source.uri}
            width={Dimensions.get('window').width - 40}
          />
        </YStack>
      </Modal>
    </>
  );
}
