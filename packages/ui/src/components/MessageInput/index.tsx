import { useState } from 'react';

import { TextArea } from '../../core';
import { MessageInputProps } from './MessageInputBase';
import { MessageInputContainer } from './MessageInputBase';

export function MessageInput({
  shouldBlur,
  setShouldBlur,
  send,
  channelId,
  // setImageAttachment,
  // uploadedImage,
  // canUpload,
  uploadInfo,
  groupMembers,
}: MessageInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <MessageInputContainer
      // setImageAttachment={setImageAttachment}
      // canUpload={canUpload}
      uploadInfo={uploadInfo}
      containerHeight={0}
      groupMembers={groupMembers}
      onSelectMention={() => {}}
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
