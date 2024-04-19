import { JSONContent } from '@tiptap/core';
import { Upload } from '@tloncorp/shared/dist/urbit';
import * as ub from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren } from 'react';
import { ImageBackground } from 'react-native';

import { ArrowUp, Close } from '../../assets/icons';
import { View, XStack, YStack } from '../../core';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import AttachmentButton from './AttachmentButton';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: JSONContent, channelId: string, blocks: ub.Block[]) => void;
  channelId: string;
  setImageAttachment: (image: string | null) => void;
  imageAttachment: string | null;
  uploadedImage?: Upload | null;
  resetImageAttachment: () => void;
}

export const MessageInputContainer = ({
  children,
  onPressSend,
  setImageAttachment,
  uploadedImage,
  resetImageAttachment,
}: PropsWithChildren<{
  onPressSend?: () => void;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  resetImageAttachment: () => void;
}>) => {
  return (
    <YStack>
      {uploadedImage && uploadedImage.url !== '' && (
        <ImageBackground
          source={{
            uri: uploadedImage.url,
          }}
          style={{
            width: '100%',
            height: 500,
            borderRadius: 16,
          }}
        >
          <XStack alignItems="flex-end">
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
      )}
      <XStack
        paddingHorizontal="$m"
        paddingVertical="$s"
        gap="$l"
        alignItems="center"
      >
        <XStack gap="$l">
          <AttachmentButton
            uploadedImage={uploadedImage}
            setImage={setImageAttachment}
          />
        </XStack>
        <XStack flex={1} gap="$l" alignItems="center">
          {children}
          <IconButton onPress={onPressSend}>
            {/* TODO: figure out what send button should look like */}
            <ArrowUp />
          </IconButton>
        </XStack>
      </XStack>
    </YStack>
  );
};
