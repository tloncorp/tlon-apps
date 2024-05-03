import { useState } from 'react';

import { TextArea } from '../../core';
import { MessageInputProps } from './MessageInputBase';
import { MessageInputContainer } from './MessageInputBase';

export function MessageInput({
  shouldBlur,
  setShouldBlur,
  send,
  channelId,
  setImageAttachment,
  uploadedImage,
  canUpload,
}: MessageInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <MessageInputContainer
      setImageAttachment={setImageAttachment}
      canUpload={canUpload}
      containerHeight={0}
    >
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
    </MessageInputContainer>
  );
}
