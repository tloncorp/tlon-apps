import { useState } from 'react';

import { TextArea } from '../../core';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';

export function MessageInput({
  shouldBlur,
  setShouldBlur,
  send,
  channelId,
  uploadInfo,
  groupMembers,
}: MessageInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <MessageInputContainer
      uploadInfo={uploadInfo}
      containerHeight={0}
      groupMembers={groupMembers}
      onSelectMention={() => {}}
      editorIsEmpty={true}
      onPressSend={() => {}}
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
