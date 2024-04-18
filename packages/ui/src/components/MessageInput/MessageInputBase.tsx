import { JSONContent } from '@tiptap/core';
import { PropsWithChildren } from 'react';

import { ArrowUp } from '../../assets/icons';
import { XStack } from '../../core';
import { IconButton } from '../IconButton';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: JSONContent, channelId: string) => void;
  channelId: string;
}

export const MessageInputContainer = ({
  children,
  onPressSend,
}: PropsWithChildren<{ onPressSend?: () => void }>) => {
  return (
    <XStack
      paddingHorizontal="$m"
      paddingVertical="$s"
      gap="$l"
      alignItems="center"
    >
      <XStack flex={1} gap="$l" alignItems="center">
        {children}
        <IconButton onPress={onPressSend}>
          {/* TODO: figure out what send button should look like */}
          <ArrowUp />
        </IconButton>
      </XStack>
    </XStack>
  );
};
