import { JSONContent } from '@tiptap/core';
import { PropsWithChildren } from 'react';

import { Attachment, Camera, ChannelGalleries, Send } from '../../assets/icons';
import { XStack } from '../../core';
import { IconButton } from '../IconButton';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: JSONContent, channelId: string) => void;
  channelId: string;
}

export const MessageInputContainer = ({ children }: PropsWithChildren) => {
  return (
    <XStack
      paddingHorizontal="$m"
      paddingVertical="$s"
      gap="$l"
      alignItems="center"
    >
      <XStack gap="$l">
        <IconButton onPress={() => {}}>
          <Camera />
        </IconButton>
        <IconButton onPress={() => {}}>
          <Attachment />
        </IconButton>
        <IconButton onPress={() => {}}>
          <ChannelGalleries />
        </IconButton>
      </XStack>
      <XStack flex={1} gap="$l" alignItems="center">
        {children}
        <IconButton onPress={() => {}}>
          {/* TODO: figure out what send button should look like */}
          <Send />
        </IconButton>
      </XStack>
    </XStack>
  );
};
