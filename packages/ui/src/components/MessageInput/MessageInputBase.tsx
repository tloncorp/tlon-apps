import { Story } from '@tloncorp/shared/dist/urbit';
import { Upload } from 'packages/shared/dist/api';
import { PropsWithChildren } from 'react';

import { ArrowUp } from '../../assets/icons';
import { XStack, YStack } from '../../core';
import { IconButton } from '../IconButton';
import AttachmentButton from './AttachmentButton';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: Story, channelId: string) => void;
  channelId: string;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  paddingBottom?: number;
  canUpload?: boolean;
}

export const MessageInputContainer = ({
  children,
  onPressSend,
  setImageAttachment,
  uploadedImage,
  paddingBottom,
  canUpload,
}: PropsWithChildren<{
  onPressSend?: () => void;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  paddingBottom?: number;
  canUpload?: boolean;
}>) => {
  return (
    <YStack>
      <XStack
        paddingHorizontal="$m"
        paddingVertical="$s"
        gap="$l"
        alignItems="center"
      >
        {uploadedImage && uploadedImage.url !== '' ? null : canUpload ? (
          <XStack gap="$l" animation="quick">
            <AttachmentButton
              uploadedImage={uploadedImage}
              setImage={setImageAttachment}
              paddingBottom={paddingBottom ?? 0}
            />
          </XStack>
        ) : null}
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
