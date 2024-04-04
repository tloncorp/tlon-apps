import { useState } from 'react';

import { Attachment, Camera, ChannelGalleries, Send } from '../../assets/icons';
import { TextArea, XStack } from '../../core';
import { IconButton } from '../IconButton';

export default function MessageInput() {
  const [isFocused, setIsFocused] = useState(false);

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
        <TextArea
          flexGrow={1}
          borderRadius="$xl"
          borderWidth={0}
          fontWeight="$s"
          backgroundColor="$secondaryBackground"
          size="$m"
          height="auto"
          placeholder="Message"
          enterKeyHint="send"
          multiline={true}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <IconButton onPress={() => {}}>
          {/* TODO: figure out what send button should look like */}
          <Send />
        </IconButton>
      </XStack>
    </XStack>
  );
}
