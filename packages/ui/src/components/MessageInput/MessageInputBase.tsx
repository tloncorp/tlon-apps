import { Story } from '@tloncorp/shared/dist/urbit';
import { Upload } from 'packages/shared/dist/api';
import { PropsWithChildren, useCallback, useMemo } from 'react';

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
  const hasUploadedImage = useMemo(
    () => !!(uploadedImage && uploadedImage.url !== ''),
    [uploadedImage]
  );
  const uploadIsLoading = useMemo(
    () => uploadedImage?.status === 'loading',
    [uploadedImage]
  );
  const sendIconColor = useMemo(
    () => (uploadIsLoading ? '$secondaryText' : '$primaryText'),
    [uploadIsLoading]
  );

  return (
    <YStack>
      <XStack
        paddingHorizontal="$m"
        paddingVertical="$s"
        gap="$l"
        alignItems="center"
      >
        {hasUploadedImage ? null : canUpload ? (
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
          <IconButton
            color={sendIconColor}
            disabled={uploadIsLoading}
            onPress={onPressSend}
          >
            {/* TODO: figure out what send button should look like */}
            <ArrowUp />
          </IconButton>
        </XStack>
      </XStack>
    </YStack>
  );
};
